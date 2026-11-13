const crypto = require('crypto');
const User = require('../models/User');
const Role = require('../models/Role');
const EmailLog = require('../models/EmailLog');
const audit = require('./auditController');
const email = require('../services/emailService');
const { buildEmailHtml } = require('../services/emailTemplate');
const { isValidEmail, isValidPassword, isValidUserId, PASSWORD_RULES_TEXT, USER_ID_RULES_TEXT } = require('../utils/accountValidation');
const { normalizePhone } = require('../utils/normalizePhone');
const roleLabel = require('../utils/roleLabel');

// IMPORTANT: the stored role "Admin" displays to users as "Authority", and
// stored "Authority" displays as "Admin" (see utils/roleLabel.js). The
// "final owner" role the product wants — full reach over every account,
// including granting roles — is the one displayed as "Authority", which is
// the STORED VALUE 'Admin'. The scoped-down role — Citizen accounts only —
// is displayed as "Admin", stored as 'Authority'. Every check below is
// written against the stored value, so read it with that swap in mind.

// Generates a random 12-character temporary password that always satisfies
// the site's password policy (one of each character class) — ambiguous
// characters (I/l/1/O/0) are left out so it's easy to read and retype.
function generateTempPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%^&*';
  const all = upper + lower + digits + special;
  const pick = (chars) => chars[crypto.randomInt(chars.length)];

  const chars = [pick(upper), pick(lower), pick(digits), pick(special)];
  while (chars.length < 12) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

// Stored 'Admin' (displayed "Authority") manages every account. Stored
// 'Authority' (displayed "Admin") is scoped down to Citizen accounts only —
// enforced here, not just hidden in the UI, so a direct API call can't do
// what the list view hides.
function canManage(requesterRole, targetRole) {
  return requesterRole === 'Admin' || targetRole === 'Citizen';
}

// GET /api/admin/users
exports.users = async (req, res, next) => {
  try {
    const filter = req.user.role === 'Authority' ? { role: 'Citizen' } : {};
    const users = await User.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/users  -> creates a new account directly, with a chosen
// role, instead of it going through public self-registration. The owner
// (stored 'Admin', displayed "Authority") can create any role. The scoped
// role (stored 'Authority', displayed "Admin") can only ever create Citizen
// profiles, and only if the owner has individually granted that specific
// account permission via User.canCreateCitizens (see updateUser below) —
// off by default, not a blanket setting for every scoped account.
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, phone, role } = req.body;
    const validRoles = ['Citizen', 'Authority', 'Admin', 'Lawyer'];
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    if (!email && !phone) {
      return res.status(400).json({ success: false, message: 'An email or phone number is required' });
    }
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'A valid role is required' });
    }
    if (req.user.role === 'Authority') {
      if (role !== 'Citizen') {
        return res.status(403).json({ success: false, message: `${roleLabel('Authority')} accounts can only create ${roleLabel('Citizen')} profiles` });
      }
      // Checked fresh, not trusted from the session, so a revoke by the
      // owner takes effect immediately rather than after the next login.
      const requester = await User.findById(req.user._id).select('canCreateCitizens');
      if (!requester?.canCreateCitizens) {
        return res.status(403).json({ success: false, message: `Account creation is currently disabled for your account. Ask the ${roleLabel('Admin')} to enable it for you.` });
      }
    }
    if (email) {
      if (!isValidEmail(email)) {
        return res.status(400).json({ success: false, message: 'Enter a valid email address' });
      }
      const exists = await User.findOne({ email: email.toLowerCase() });
      if (exists) return res.status(409).json({ success: false, message: 'Email already registered' });
    }
    if (phone) {
      const exists = await User.findOne({ phone });
      if (exists) return res.status(409).json({ success: false, message: 'Phone number already registered' });
    }

    const password = generateTempPassword();
    const user = await User.create({
      name: name.trim(),
      email: email || undefined,
      phone: phone || undefined,
      role,
      password,
      mustChangePassword: true
    });

    await audit.log({
      user: req.user._id,
      action: 'user_create',
      entity: 'User',
      entityId: user._id,
      ip: req.ip,
      details: `Created ${role} account: ${user.email || user.phone}`
    });

    // Same one-time-only pattern as resetPassword — never stored or logged again.
    res.status(201).json({ success: true, user, generatedPassword: password });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/users/:id  -> change a user's role, grant/revoke that
// account's ability to create Citizen profiles, and/or correct their User ID
// or phone number.
// Role and canCreateCitizens stay owner-only (stored 'Admin', displayed
// "Authority") — pieces of "full" user management that don't extend to the
// scoped role. User ID / phone corrections follow the same scoping as the
// rest of user management (setStatus/deleteUser/resetPassword below):
// both roles can do it, but the scoped role (stored 'Authority', displayed
// "Admin") only on Citizen accounts.
exports.updateUser = async (req, res, next) => {
  try {
    const { role, canCreateCitizens, canAccessHomeFeed, userId, phone } = req.body;

    if ((role !== undefined || canCreateCitizens !== undefined || canAccessHomeFeed !== undefined) && req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: `Only ${roleLabel('Admin')} accounts can change user roles` });
    }

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });

    if ((userId !== undefined || phone !== undefined) && !canManage(req.user.role, target.role)) {
      return res.status(403).json({ success: false, message: `${roleLabel('Authority')} accounts can only manage ${roleLabel('Citizen')} accounts` });
    }

    const validRoles = ['Citizen', 'Authority', 'Admin', 'Lawyer'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    if (role && role !== target.role) {
      const previousRole = target.role;
      target.role = role;
      await audit.log({
        user: req.user._id,
        action: 'role_change',
        entity: 'User',
        entityId: target._id,
        ip: req.ip,
        details: `${target.email || target.phone}: ${previousRole} -> ${role}`
      });
    }

    if (typeof canCreateCitizens === 'boolean' && canCreateCitizens !== target.canCreateCitizens) {
      target.canCreateCitizens = canCreateCitizens;
      await audit.log({
        user: req.user._id,
        action: 'permission_change',
        entity: 'User',
        entityId: target._id,
        ip: req.ip,
        details: `${target.email || target.phone}: create-${roleLabel('Citizen')} permission ${canCreateCitizens ? 'granted' : 'revoked'}`
      });
    }

    if (typeof canAccessHomeFeed === 'boolean' && canAccessHomeFeed !== target.canAccessHomeFeed) {
      target.canAccessHomeFeed = canAccessHomeFeed;
      await audit.log({
        user: req.user._id,
        action: 'permission_change',
        entity: 'User',
        entityId: target._id,
        ip: req.ip,
        details: `${target.email || target.phone}: Home/Issues feed access ${canAccessHomeFeed ? 'granted' : 'revoked'}`
      });
    }

    // Administrative override — doesn't count against the account's own
    // 3-change budget (see PATCH /api/auth/me/user-id), and doesn't require
    // the caller to already know the current value.
    if (userId !== undefined) {
      const newUserId = userId.trim().toLowerCase();
      if (!isValidUserId(newUserId)) {
        return res.status(400).json({ success: false, message: `User ID must be ${USER_ID_RULES_TEXT}` });
      }
      if (newUserId !== target.userId) {
        const taken = await User.findOne({ userId: newUserId, _id: { $ne: target._id } });
        if (taken) return res.status(409).json({ success: false, message: 'That User ID is already taken.' });
        const previousUserId = target.userId;
        target.userId = newUserId;
        await audit.log({
          user: req.user._id,
          action: 'userid_change',
          entity: 'User',
          entityId: target._id,
          ip: req.ip,
          details: `${target.email || target.phone}: User ID ${previousUserId} -> ${newUserId} (by admin)`
        });
      }
    }

    if (phone !== undefined) {
      const newPhone = normalizePhone(phone.trim());
      if (!newPhone && !target.email) {
        return res.status(400).json({ success: false, message: "Can't remove this account's phone number — it has no email either." });
      }
      if (newPhone !== target.phone) {
        if (newPhone) {
          const taken = await User.findOne({ phone: newPhone, _id: { $ne: target._id } });
          if (taken) return res.status(409).json({ success: false, message: 'That phone number is already registered to another account.' });
        }
        const previousPhone = target.phone;
        target.phone = newPhone || undefined;
        await audit.log({
          user: req.user._id,
          action: 'phone_change',
          entity: 'User',
          entityId: target._id,
          ip: req.ip,
          details: `${target.email || previousPhone}: phone ${previousPhone || '(none)'} -> ${newPhone || '(none)'} (by admin)`
        });
      }
    }

    await target.save();
    res.json({ success: true, user: target });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/users/:id/status  -> enable or disable a user's account
// Admin and Authority both (enforced by the route middleware) — unlike role
// assignment, this doesn't need to be Admin-exclusive.
exports.setStatus = async (req, res, next) => {
  try {
    const { isDisabled } = req.body;
    if (typeof isDisabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isDisabled must be true or false' });
    }
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    if (String(target._id) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'You cannot disable your own account' });
    }
    if (!canManage(req.user.role, target.role)) {
      return res.status(403).json({ success: false, message: `${roleLabel('Authority')} accounts can only manage ${roleLabel('Citizen')} accounts` });
    }

    target.isDisabled = isDisabled;
    await target.save();
    await audit.log({
      user: req.user._id,
      action: isDisabled ? 'account_disable' : 'account_enable',
      entity: 'User',
      entityId: target._id,
      ip: req.ip,
      details: `${target.email || target.phone}: ${isDisabled ? 'disabled' : 'enabled'}`
    });
    res.json({ success: true, user: target });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/users/:id
// Admin and Authority both (enforced by the route middleware).
exports.deleteUser = async (req, res, next) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    if (String(target._id) === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }
    if (!canManage(req.user.role, target.role)) {
      return res.status(403).json({ success: false, message: `${roleLabel('Authority')} accounts can only manage ${roleLabel('Citizen')} accounts` });
    }

    await target.deleteOne();
    await audit.log({
      user: req.user._id,
      action: 'account_delete',
      entity: 'User',
      entityId: target._id,
      ip: req.ip,
      details: `${target.email || target.phone}: account deleted`
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/users/:id/reset-password  -> Admin or Authority sets or
// generates a user's password (enforced by the route middleware — role
// assignment itself stays Admin-only, see updateUser above). Bypasses the
// normal "current password" check entirely, since this is an
// administrative override.
exports.resetPassword = async (req, res, next) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    if (!canManage(req.user.role, target.role)) {
      return res.status(403).json({ success: false, message: `${roleLabel('Authority')} accounts can only manage ${roleLabel('Citizen')} accounts` });
    }

    let { newPassword } = req.body;
    const generated = !newPassword;
    if (generated) {
      newPassword = generateTempPassword();
    } else if (!isValidPassword(newPassword)) {
      return res.status(400).json({ success: false, message: `Password must be ${PASSWORD_RULES_TEXT}` });
    }

    target.password = newPassword;
    target.mustChangePassword = true;
    await target.save();

    await audit.log({
      user: req.user._id,
      action: 'password_reset',
      entity: 'User',
      entityId: target._id,
      ip: req.ip,
      details: `${target.email || target.phone}: password reset by admin${generated ? ' (auto-generated)' : ''}`
    });

    // The plaintext password is only ever returned here, once, so the admin
    // can hand it to the user out of band — it is never stored or logged.
    res.json({ success: true, ...(generated ? { generatedPassword: newPassword } : {}) });
  } catch (err) {
    next(err);
  }
};

// POST /api/admin/users/email  body: { userIds: string[], subject, message }
// Admin and Authority both (enforced by the route middleware), scoped to
// Citizen targets for Authority the same way delete/status/reset-password
// are — see canManage above. Uses allSettled so one bad address (or a
// transient SMTP hiccup) doesn't block the rest of the batch; the response
// reports exactly how many actually went out.
exports.sendBulkEmail = async (req, res, next) => {
  try {
    const { userIds, subject, message } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Select at least one user' });
    }
    if (!subject || !subject.trim() || !message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Subject and message are required' });
    }

    const targets = await User.find({ _id: { $in: userIds } });
    const manageable = targets.filter(t => canManage(req.user.role, t.role));
    const withEmail = manageable.filter(t => t.email);

    // messageIsHtml: true — this comes from the admin's rich-text compose
    // box (bold/italic/lists/color), not plain text, so it's inserted as
    // sanitized HTML rather than escaped (see services/emailTemplate.js).
    const html = buildEmailHtml({ title: subject.trim(), message: message.trim(), messageIsHtml: true });
    const results = await Promise.allSettled(withEmail.map(t => email.sendMail(t.email, subject.trim(), html)));
    const sentCount = results.filter(r => r.status === 'fulfilled').length;
    const failedCount = withEmail.length - sentCount;
    const skippedCount = targets.length - withEmail.length;

    // Per-recipient outcome — the Email Log tab shows exactly who got it and
    // who didn't (and why), not just the aggregate counts.
    const recipients = withEmail.map((t, i) => ({
      user: t._id,
      name: t.name,
      email: t.email,
      status: results[i].status === 'fulfilled' ? 'sent' : 'failed',
      error: results[i].status === 'rejected' ? (results[i].reason?.message || 'Unknown error') : undefined
    }));
    await EmailLog.create({
      subject: subject.trim(),
      message: html,
      sentBy: req.user._id,
      recipients,
      sentCount,
      failedCount,
      skippedCount
    });

    await audit.log({
      user: req.user._id,
      action: 'bulk_email',
      entity: 'User',
      entityId: req.user._id,
      ip: req.ip,
      details: `Sent "${subject.trim()}" to ${sentCount}/${targets.length} selected user(s)`
    });

    res.json({ success: true, sentCount, failedCount, skippedCount });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/email-log — most recent bulk sends first, capped at 100 so
// this never grows into a slow, unbounded query as the log accumulates.
exports.emailLog = async (req, res, next) => {
  try {
    const logs = await EmailLog.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('sentBy', 'name')
      .lean();
    res.json({ success: true, logs });
  } catch (err) {
    next(err);
  }
};

// GET /api/admin/roles
exports.roles = async (req, res, next) => {
  try {
    const roles = await Role.find().sort({ name: 1 });
    res.json({ success: true, roles });
  } catch (err) {
    next(err);
  }
};
