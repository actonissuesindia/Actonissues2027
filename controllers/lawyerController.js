const User = require('../models/User');

// `name` (the real account name) is deliberately NOT in here — the public
// directory only ever shows the computed effective display name (below),
// never the underlying account identity, so an Admin acting as a lawyer
// can't have their real name recovered by inspecting the API response
// even if the UI itself doesn't render it. Also excludes lawyerProfile.
// upiId/bankDetails, which only ever get attached to a specific
// RTIRequest response (see rtiRequestController.js's `get`) once that
// citizen's request has an actual fee quoted, never shown here.
const PUBLIC_FIELDS = 'name avatar role lawyerProfile.displayName lawyerProfile.bio lawyerProfile.specializations lawyerProfile.contactPhone lawyerProfile.contactEmail';

// A role can potentially act as a lawyer if it's 'Lawyer' (always) or
// 'Admin' (the Super Admin/owner opting in — see the isListed comment in
// models/User.js). Directory *visibility* additionally depends on
// isListed's default-by-role semantics, applied in the $or below —
// unset means "listed" for Lawyer, "not listed" for Admin.
const DIRECTORY_FILTER = {
  isDisabled: { $ne: true },
  $or: [
    { role: 'Lawyer', 'lawyerProfile.isListed': { $ne: false } },
    { role: 'Admin', 'lawyerProfile.isListed': true }
  ]
};

const canActAsLawyer = (user) => user.role === 'Lawyer' || user.role === 'Admin';

// Reshapes a fetched user doc into the public directory shape: `name`
// becomes the effective display name (lawyerProfile.displayName if the
// lawyer set one, otherwise the real account name — fine for a genuine
// Lawyer account, and exactly what an Admin sets a displayName to avoid),
// and the real account name never appears anywhere else in the payload.
function toPublicLawyer(user) {
  const obj = user.toObject ? user.toObject() : user;
  const { displayName, ...restProfile } = obj.lawyerProfile || {};
  return {
    _id: obj._id,
    avatar: obj.avatar,
    name: displayName || obj.name,
    lawyerProfile: restProfile
  };
}

// GET /api/lawyers — public "Find a Lawyer" directory
exports.list = async (req, res, next) => {
  try {
    const lawyers = await User.find(DIRECTORY_FILTER).select(PUBLIC_FIELDS).sort({ name: 1 });
    res.json({ success: true, lawyers: lawyers.map(toPublicLawyer) });
  } catch (err) {
    next(err);
  }
};

// GET /api/lawyers/:id
exports.get = async (req, res, next) => {
  try {
    const lawyer = await User.findOne({ _id: req.params.id, ...DIRECTORY_FILTER }).select(PUBLIC_FIELDS);
    if (!lawyer) return res.status(404).json({ success: false, message: 'Lawyer not found' });
    res.json({ success: true, lawyer: toPublicLawyer(lawyer) });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/lawyers/me  (Lawyer, or Admin opting in — self-service
// profile + payment details + directory listing toggle)
exports.updateProfile = async (req, res, next) => {
  try {
    if (!canActAsLawyer(req.user)) {
      return res.status(403).json({ success: false, message: 'Only a Lawyer or Admin account can update a lawyer profile' });
    }
    const { displayName, bio, specializations, contactPhone, contactEmail, upiId, bankDetails, isListed } = req.body;
    const user = await User.findById(req.user._id);
    // Merge onto a plain copy of the existing profile rather than building
    // a fresh object with `field: possiblyUndefined` — Mongoose casts an
    // explicit `undefined` value on a nested-object path (bankDetails) as
    // a real assignment attempt and throws, rather than treating it as
    // "leave unchanged"; only actually-provided fields should ever touch
    // the object at all.
    const updated = { ...(user.lawyerProfile?.toObject?.() || user.lawyerProfile || {}) };
    if (displayName !== undefined) updated.displayName = displayName;
    if (bio !== undefined) updated.bio = bio;
    if (specializations !== undefined) updated.specializations = specializations;
    if (contactPhone !== undefined) updated.contactPhone = contactPhone;
    if (contactEmail !== undefined) updated.contactEmail = contactEmail;
    if (upiId !== undefined) updated.upiId = upiId;
    if (isListed !== undefined) updated.isListed = isListed;
    if (bankDetails !== undefined) updated.bankDetails = bankDetails;
    user.lawyerProfile = updated;
    await user.save();
    res.json({ success: true, lawyerProfile: user.lawyerProfile });
  } catch (err) {
    next(err);
  }
};

// GET /api/lawyers/me  (Lawyer, or Admin opting in — own full profile
// including payment details and the directory-listing toggle; safe to
// include the real `name` here since this is the account's own view)
exports.getMyProfile = async (req, res, next) => {
  try {
    if (!canActAsLawyer(req.user)) {
      return res.status(403).json({ success: false, message: 'Only a Lawyer or Admin account has a lawyer profile' });
    }
    const user = await User.findById(req.user._id).select('name avatar role lawyerProfile');
    res.json({ success: true, role: user.role, accountName: user.name, lawyerProfile: user.lawyerProfile || {} });
  } catch (err) {
    next(err);
  }
};
