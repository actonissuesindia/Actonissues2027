const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const otpService = require('../services/otpService');
const firebaseAdmin = require('../services/firebaseAdminService');
const { isValidEmail, isValidPassword, isValidUserId, PASSWORD_RULES_TEXT, USER_ID_RULES_TEXT } = require('../utils/accountValidation');
const { normalizePhone } = require('../utils/normalizePhone');

// Only touch GCS when it's actually configured — required lazily so local
// dev without any Google Cloud credentials never loads config/gcs.js at all.
const useGCS = !!process.env.GCS_BUCKET;
const gcs = useGCS ? require('../services/gcsService') : null;

// This is a public identifier, not a secret — safe to be visible in the
// frontend's JS bundle too (see src/config.js). Registered once under
// Google Cloud Console > APIs & Services > Credentials for this project.
const GOOGLE_CLIENT_ID = '458645747669-30fvbrdm54kj18gl437n51ung4rak1er.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Store a lean, serializable user object on the session.
function sessionUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    userId: user.userId,
    userIdChangeCount: user.userIdChangeCount,
    role: user.role,
    avatar: user.avatar,
    banner: user.banner,
    isDisabled: user.isDisabled,
    hasPassword: !!user.password,
    mustChangePassword: !!user.mustChangePassword,
    hasSeenWelcomeTour: !!user.hasSeenWelcomeTour,
    preferredLanguage: user.preferredLanguage
  };
}

// A client-side-only checkbox can be bypassed by anyone calling the API
// directly, so self-registration is rejected here too unless acceptedTerms
// is explicitly true — checked at every path that can create a brand-new
// account (password, phone, first-time OTP, first-time Google sign-in).
// Admin-created accounts (userAdminController) are exempt — that's an
// internal action taken on the platform's behalf, not self-registration.
function requireAcceptedTerms(req, res) {
  if (req.body.acceptedTerms !== true) {
    res.status(400).json({ success: false, message: 'You must accept the Terms of Use and Disclaimer to create an account' });
    return false;
  }
  return true;
}

// GET /api/auth/check-availability?email=...  or  ?phone=...  or  ?userId=...
// Lets the registration form (or the User ID editor in Profile Settings)
// tell someone their email/phone/user ID is already taken as they type,
// instead of only finding out after submitting the whole form.
// Rate-limited by the general API limiter like everything else under /api
// — fine here since, unlike forgot-password, the person typing is checking
// their own address/ID, not probing someone else's account.
exports.checkAvailability = async (req, res, next) => {
  try {
    const email = (req.query.email || '').trim().toLowerCase();
    const phone = (req.query.phone || '').trim();
    const userId = (req.query.userId || '').trim().toLowerCase();
    if (!email && !phone && !userId) {
      return res.status(400).json({ success: false, message: 'email, phone, or userId is required' });
    }
    if (email) {
      const exists = await User.findOne({ email });
      return res.json({ success: true, available: !exists });
    }
    if (phone) {
      const exists = await User.findOne({ phone });
      return res.json({ success: true, available: !exists });
    }
    const exists = await User.findOne({ userId });
    res.json({ success: true, available: !exists });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/google  (body: { credential } — the ID token from Google's
// Sign In With Google button). Finds an existing account by Google ID, then
// by matching email (linking Google onto it), or creates a brand-new
// Citizen account — same three-way pattern as verifyOtp below.
exports.googleSignIn = async (req, res, next) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ success: false, message: 'Missing Google credential' });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ success: false, message: 'Could not verify Google sign-in — please try again' });
    }
    if (!payload.email_verified) {
      return res.status(401).json({ success: false, message: 'Your Google account\'s email is not verified' });
    }

    let user = await User.findOne({ googleId: payload.sub });
    if (!user) {
      user = await User.findOne({ email: payload.email.toLowerCase() });
      if (user) {
        user.googleId = payload.sub;
        await user.save();
      }
    }
    if (!user) {
      if (!requireAcceptedTerms(req, res)) return;
      user = await User.create({
        name: payload.name || payload.email.split('@')[0],
        email: payload.email.toLowerCase(),
        googleId: payload.sub,
        avatar: payload.picture || undefined,
        role: 'Citizen',
        acceptedTermsAt: new Date()
      });
    }
    if (user.isDisabled) return res.status(403).json({ success: false, message: 'This account has been disabled' });

    req.session.user = sessionUser(user);
    res.json({ success: true, user: req.session.user });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/firebase-phone  (body: { idToken, name } — idToken is from
// Firebase's client-side signInWithPhoneNumber flow, which sends and
// verifies the SMS code itself; the server never sees the code, only this
// already-verified token). Same find-by-identifier-or-create pattern as
// verifyOtp above, keyed on the token's verified phone number instead of a
// server-checked code.
exports.verifyFirebasePhone = async (req, res, next) => {
  try {
    const { idToken, name } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Missing phone verification token' });
    }

    let decoded;
    try {
      decoded = await firebaseAdmin.verifyIdToken(idToken);
    } catch (err) {
      console.error('Firebase phone token verification failed:', err.message);
      return res.status(401).json({ success: false, message: 'Could not verify phone sign-in — please try again' });
    }
    const phone = decoded.phone_number;
    if (!phone) {
      return res.status(401).json({ success: false, message: 'That sign-in has no verified phone number' });
    }

    // Firebase always returns E.164 (e.g. "+917013381144"), but some
    // accounts predate the normalizePhone pre-validate hook or were written
    // by a path that bypassed it (a direct query-level update, an old import)
    // and still have the bare-digits form in the DB — fall back to matching
    // that too, the same way password login already does (see login below).
    //
    // Two lookups rather than one $or over both forms: $or lets Mongo return
    // whichever document it reaches first, so if the same number exists twice
    // — once normalized, once legacy — sign-in could land on the stale copy.
    // The normalized record is the real identity, so it wins.
    const legacyPhone = phone.replace(/^\+91/, '');
    let user = await User.findOne({ phone }) || await User.findOne({ phone: legacyPhone });

    if (!user) {
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Name is required to create an account' });
      }
      if (!requireAcceptedTerms(req, res)) return;
      user = await User.create({ name: name.trim(), phone, role: 'Citizen', acceptedTermsAt: new Date() });
    } else if (user.phone !== phone) {
      // Heal the legacy record now that we know its normalized identity —
      // same as fixing the bug once, permanently, for this account.
      //
      // Best effort, deliberately: this is a repair, not part of proving who
      // the caller is. The save can fail for reasons that have nothing to do
      // with this sign-in — a duplicate account already holding the E.164
      // form (unique index), or a record old enough to be missing a field
      // that became required since. Awaiting it bare meant any of those threw
      // past the response as an unhandled error, and someone who had just
      // received and entered a valid SMS code was told "Something went wrong.
      // Please try again in a moment." on every single attempt, permanently
      // locked out of an account they demonstrably own.
      const storedPhone = user.phone;
      user.phone = phone;
      try {
        await user.save();
      } catch (err) {
        // Put the document back the way the database still has it, so the
        // session below doesn't advertise a number that was never written.
        user.phone = storedPhone;
        console.error(`Phone normalization failed for user ${user._id} ("${storedPhone}" -> "${phone}") — signing in anyway:`, err.message);
      }
    }
    if (user.isDisabled) return res.status(403).json({ success: false, message: 'This account has been disabled' });

    req.session.user = sessionUser(user);
    res.json({ success: true, user: req.session.user });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/register-with-phone  (the only self-registration path —
// name/User ID/password/email are all collected up front, but the account
// isn't actually created until the phone number is verified via Firebase,
// same idToken handoff as verifyFirebasePhone above). Unlike
// verifyFirebasePhone, this never logs into an existing account — a phone/
// email/User ID already in use is always rejected, since the caller is
// explicitly trying to create a brand-new account with brand-new details.
exports.registerWithPhone = async (req, res, next) => {
  try {
    const { idToken, firstName, lastName, userId, password, email } = req.body;
    if (!(firstName || '').trim() || !(lastName || '').trim()) {
      return res.status(400).json({ success: false, message: 'First and last name are both required' });
    }
    const name = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'A valid email address is required' });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ success: false, message: `Password must be ${PASSWORD_RULES_TEXT}` });
    }
    const normalizedUserId = (userId || '').trim().toLowerCase();
    if (!isValidUserId(normalizedUserId)) {
      return res.status(400).json({ success: false, message: `User ID must be ${USER_ID_RULES_TEXT}` });
    }
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'Missing phone verification token' });
    }
    if (!requireAcceptedTerms(req, res)) return;

    let decoded;
    try {
      decoded = await firebaseAdmin.verifyIdToken(idToken);
    } catch (err) {
      console.error('Firebase phone token verification failed:', err.message);
      return res.status(401).json({ success: false, message: 'Could not verify phone sign-in — please try again' });
    }
    const phone = decoded.phone_number;
    if (!phone) {
      return res.status(401).json({ success: false, message: 'That sign-in has no verified phone number' });
    }

    // Checked explicitly (rather than relying on the schema's unique index
    // throwing a duplicate-key error) so each conflict gets its own clear
    // message instead of one generic "something went wrong."
    const [emailTaken, phoneTaken, userIdTaken] = await Promise.all([
      User.findOne({ email: email.toLowerCase() }),
      // Same bare-digits fallback as verifyFirebasePhone above — without it,
      // a legacy unnormalized record wouldn't match this E.164 phone and a
      // second account could be created for the same real phone number.
      User.findOne({ $or: [{ phone }, { phone: phone.replace(/^\+91/, '') }] }),
      User.findOne({ userId: normalizedUserId })
    ]);
    if (emailTaken) return res.status(409).json({ success: false, message: 'Email already registered' });
    if (phoneTaken) return res.status(409).json({ success: false, message: 'Phone number already registered' });
    if (userIdTaken) return res.status(409).json({ success: false, message: 'That User ID is already taken' });

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      userId: normalizedUserId,
      password,
      role: 'Citizen',
      acceptedTermsAt: new Date()
    });

    req.session.user = sessionUser(user);
    res.status(201).json({ success: true, user: req.session.user });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login  (identifier = user ID, email, or phone, + password)
exports.login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    const id = (identifier || '').trim();
    // Someone typing their phone number at login has no reason to know it's
    // stored with a country code (that's only visible once normalized on
    // save) — try both the raw and normalized form so "7842456778" still
    // finds an account stored as "+917842456778".
    const user = await User.findOne({
      $or: [{ email: id.toLowerCase() }, { phone: id }, { phone: normalizePhone(id) }, { userId: id.toLowerCase() }]
    }).select('+password');
    if (!user || !(await user.comparePassword(password || ''))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (user.isDisabled) return res.status(403).json({ success: false, message: 'This account has been disabled' });
    req.session.user = sessionUser(user);
    res.json({ success: true, user: req.session.user });
  } catch (err) {
    next(err);
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
};

exports.me = (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ success: true, user: req.session.user });
  }
  res.status(401).json({ success: false, message: 'Not authenticated' });
};

// POST /api/auth/otp/request  (identifier = email — phone OTP goes through
// /api/auth/firebase-phone instead, see verifyFirebasePhone below)
exports.requestOtp = async (req, res, next) => {
  try {
    const identifier = (req.body.identifier || '').trim();
    if (!identifier) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }
    if (!otpService.isEmail(identifier)) {
      return res.status(400).json({ success: false, message: 'Use the Phone OTP option to verify a phone number' });
    }
    await otpService.requestOtp(identifier.toLowerCase());
    res.json({ success: true, message: 'Verification code sent' });
  } catch (err) {
    if (err.message?.startsWith('Email delivery')) {
      return res.status(503).json({ success: false, message: err.message });
    }
    next(err);
  }
};

// POST /api/auth/otp/verify  (identifier = email, code, name for first-time signup)
exports.verifyOtp = async (req, res, next) => {
  try {
    const identifier = (req.body.identifier || '').trim().toLowerCase();
    const { code, name } = req.body;
    if (!identifier || !code) {
      return res.status(400).json({ success: false, message: 'Identifier and code are required' });
    }

    const result = await otpService.verifyOtp(identifier, code);
    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.reason });
    }

    let user = await User.findOne({ email: identifier });
    if (!user) {
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Name is required to create an account' });
      }
      if (!requireAcceptedTerms(req, res)) return;
      user = await User.create({ name: name.trim(), email: identifier, role: 'Citizen', acceptedTermsAt: new Date() });
    }
    if (user.isDisabled) return res.status(403).json({ success: false, message: 'This account has been disabled' });
    req.session.user = sessionUser(user);
    res.json({ success: true, user: req.session.user });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/forgot-password  (email only — sends a reset code)
// Always responds the same way whether or not the email is registered — an
// account-specific message here would let anyone check which emails have
// accounts on the site just by trying them.
exports.forgotPassword = async (req, res, next) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email || !otpService.isEmail(email)) {
      return res.status(400).json({ success: false, message: 'A valid email address is required' });
    }
    const user = await User.findOne({ email });
    if (user) await otpService.requestOtp(email);
    res.json({ success: true, message: 'If that email has an account, a reset code has been sent to it' });
  } catch (err) {
    if (err.message?.startsWith('Email delivery')) {
      return res.status(503).json({ success: false, message: err.message });
    }
    next(err);
  }
};

// POST /api/auth/reset-password  (email, code, newPassword)
exports.resetPassword = async (req, res, next) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const { code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, code and a new password are required' });
    }
    if (!isValidPassword(newPassword)) {
      return res.status(400).json({ success: false, message: `Password must be ${PASSWORD_RULES_TEXT}` });
    }
    const result = await otpService.verifyOtp(email, code);
    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.reason });
    }
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with that email' });
    }
    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();
    req.session.user = sessionUser(user);
    res.json({ success: true, user: req.session.user });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/auth/me  -> update the signed-in user's own profile (name only)
exports.updateProfile = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }
    const user = await User.findByIdAndUpdate(req.user._id, { name: name.trim() }, { new: true }).select('+password');
    req.session.user = sessionUser(user);
    res.json({ success: true, user: req.session.user });
  } catch (err) {
    next(err);
  }
};

const SUPPORTED_LANGUAGES = ['en', 'hi', 'te', 'ta', 'mr', 'or', 'ml', 'kn'];

// PATCH /api/auth/me/language — syncs a signed-in user's language choice
// (set instantly in localStorage by src/context/LanguageContext.jsx) onto
// their account, so it follows them across devices/browsers.
exports.updateLanguage = async (req, res, next) => {
  try {
    const { language } = req.body;
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      return res.status(400).json({ success: false, message: 'Unsupported language' });
    }
    const user = await User.findByIdAndUpdate(req.user._id, { preferredLanguage: language }, { new: true }).select('+password');
    req.session.user = sessionUser(user);
    res.json({ success: true, user: req.session.user });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/me/tour-seen — called once the guided welcome tour is
// finished or explicitly skipped, so it doesn't reappear on future logins.
// Also doubles as the "retake the tour" action from Profile Settings, via
// { seen: false } — same endpoint, just flipping the flag the other way.
exports.markWelcomeTourSeen = async (req, res, next) => {
  try {
    const seen = req.body.seen !== false;
    const user = await User.findByIdAndUpdate(req.user._id, { hasSeenWelcomeTour: seen }, { new: true }).select('+password');
    req.session.user = sessionUser(user);
    res.json({ success: true, user: req.session.user });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/auth/me/user-id  -> change the signed-in user's own User ID.
// Capped at 3 changes for the lifetime of the account (userIdChangeCount),
// so it can't be used to keep rebranding/impersonating over time.
exports.updateUserId = async (req, res, next) => {
  try {
    const newUserId = (req.body.userId || '').trim().toLowerCase();
    if (!isValidUserId(newUserId)) {
      return res.status(400).json({ success: false, message: `User ID must be ${USER_ID_RULES_TEXT}` });
    }
    const user = await User.findById(req.user._id).select('+password');
    if (newUserId === user.userId) {
      return res.json({ success: true, user: req.session.user });
    }
    if (user.userIdChangeCount >= 3) {
      return res.status(403).json({ success: false, message: "You've already used all 3 User ID changes allowed on this account." });
    }
    const taken = await User.findOne({ userId: newUserId });
    if (taken) {
      return res.status(409).json({ success: false, message: 'That User ID is already taken.' });
    }
    user.userId = newUserId;
    user.userIdChangeCount += 1;
    await user.save();
    req.session.user = sessionUser(user);
    res.json({ success: true, user: req.session.user });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/me/avatar  (multipart, field name "avatar")
exports.uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const url = useGCS ? (await gcs.uploadFile(req.file)).url : '/uploads/' + req.file.filename;
    const user = await User.findByIdAndUpdate(req.user._id, { avatar: url }, { new: true }).select('+password');
    req.session.user = sessionUser(user);
    res.json({ success: true, user: req.session.user });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/me/banner  (multipart, field name "banner")
exports.uploadBanner = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const url = useGCS ? (await gcs.uploadFile(req.file)).url : '/uploads/' + req.file.filename;
    const user = await User.findByIdAndUpdate(req.user._id, { banner: url }, { new: true }).select('+password');
    req.session.user = sessionUser(user);
    res.json({ success: true, user: req.session.user });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/change-password  (also handles setting a first password for OTP-only accounts)
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!isValidPassword(newPassword)) {
      return res.status(400).json({ success: false, message: `Password must be ${PASSWORD_RULES_TEXT}` });
    }
    const user = await User.findById(req.user._id).select('+password');
    if (user.password) {
      if (!currentPassword || !(await user.comparePassword(currentPassword))) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect' });
      }
    }
    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();
    req.session.user = sessionUser(user);
    res.json({ success: true, user: req.session.user });
  } catch (err) {
    next(err);
  }
};

