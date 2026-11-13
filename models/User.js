const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { generateUniqueUserId } = require('../utils/generateUserId');
const { normalizePhone } = require('../utils/normalizePhone');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // A user needs at least one of email/phone (enforced below) — either can be
  // used to register, log in with a password, or (email only) log in via OTP.
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  phone: { type: String, unique: true, sparse: true, trim: true },
  // A third password-login identifier, alongside email/phone — auto-assigned
  // as "<name-slug>@aoi" on account creation (see the pre-save hook below),
  // editable afterward from Profile Settings up to userIdChangeCount times.
  userId: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  // Capped at 3 in the PATCH /api/auth/me/user-id handler — once reached,
  // the user ID is permanently locked, so it can't be used to keep
  // rebranding/impersonating over time.
  userIdChangeCount: { type: Number, default: 0 },
  // Optional: accounts created via OTP or Google sign-in have no password
  // until they set one.
  password: { type: String, select: false },
  // Google's stable per-account ID — set the first time someone signs in
  // with Google, whether that creates a brand-new account or links onto
  // an existing one matched by email.
  googleId: { type: String, unique: true, sparse: true },
  role: { type: String, enum: ['Citizen', 'Authority', 'Admin', 'Lawyer'], default: 'Citizen' },
  avatar: String,
  banner: String,
  isDisabled: { type: Boolean, default: false },
  // Set whenever an Admin/Authority hands a user a password directly
  // (new account or reset) — forces a mandatory change-password prompt on
  // that user's next login, since the admin now knows their password.
  mustChangePassword: { type: Boolean, default: false },
  // Gates the guided "how everything works" tour shown to a first-time
  // Citizen (see src/components/common/WelcomeTourModal.jsx) — set true once
  // they finish or explicitly skip it, so it doesn't reappear on every
  // future login. Defaults false so every brand-new signup sees it; accounts
  // that already existed before this feature shipped were backfilled to
  // true by scripts/backfillWelcomeTourSeen.js, so it doesn't suddenly pop
  // up for people who already know the site.
  hasSeenWelcomeTour: { type: Boolean, default: false },
  // Set when a User self-registers and ticks the Terms/Disclaimer checkbox
  // (see controllers/authController.js). Left unset for accounts an Admin
  // creates directly — that's an internal action, not self-registration.
  acceptedTermsAt: Date,
  // Only meaningful for the Citizen-scoped role (stored 'Authority',
  // displayed "Admin" — see utils/roleLabel.js). The owner (stored 'Admin',
  // displayed "Authority") grants this per account, individually, to let
  // that one person create new Citizen profiles themselves — off by
  // default, revocable at any time.
  canCreateCitizens: { type: Boolean, default: false },
  // Same shape as canCreateCitizens above — only meaningful for role
  // 'Authority' (displayed "Admin"), granted per account by the Super
  // Admin (stored 'Admin') to let that one Authority account browse the
  // citizen-facing Home and Issues feed pages. Off by default, revocable
  // at any time. See controllers/issueController.js's list handler and
  // src/pages/Home/Home.jsx / src/pages/Feed/Feed.jsx.
  canAccessHomeFeed: { type: Boolean, default: false },
  // Synced from localStorage the moment a signed-in user picks a language
  // (see src/components/common/LanguageSwitcher.jsx) so the choice follows
  // their account across devices, not just the one browser. Citizen-facing
  // UI only (see src/context/LanguageContext.jsx) — Admin/Authority tooling
  // stays English regardless of this value.
  preferredLanguage: { type: String, enum: ['en', 'hi', 'te', 'ta', 'mr', 'or', 'ml', 'kn'], default: 'en' },

  // Meaningful for role: 'Lawyer' (always eligible) and role: 'Admin' (the
  // Super Admin/owner can *also* act as a lawyer alongside full admin
  // powers, opted in via `isListed` below — not automatic, since a future
  // second Admin account shouldn't be assumed to want this). Self-managed
  // via PATCH /api/lawyers/me (controllers/lawyerController.js), shown
  // publicly on the "Find a Lawyer" directory (name/bio/specializations/
  // contact only — never upiId/bankDetails, which are only ever attached
  // to a specific RTIRequest response once that citizen's request reaches
  // a fee-quoted stage or later, not exposed on the public directory
  // listing at all).
  lawyerProfile: {
    // Shown on the "Find a Lawyer" directory and everywhere else a citizen
    // sees this lawyer, in place of the account's real `name` — lets an
    // Admin acting as a lawyer (or any Lawyer account) present under a
    // distinct professional name rather than their real/admin identity.
    // Falls back to the account's real name if left blank.
    displayName: { type: String, trim: true },
    bio: { type: String, trim: true },
    specializations: [String],
    contactPhone: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    upiId: { type: String, trim: true },
    // Controls "Find a Lawyer" directory visibility + assignability.
    // Undefined is treated as: listed by default for role 'Lawyer'
    // (that's the whole point of the account), NOT listed by default for
    // role 'Admin' (an opt-in, see lawyerController.js's query) — so this
    // field only needs to be set explicitly to *override* that default in
    // either direction (a Lawyer pausing availability, or an Admin
    // opting in), never as a required setup step.
    isListed: Boolean,
    bankDetails: {
      accountName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifsc: { type: String, trim: true },
      bankName: { type: String, trim: true }
    }
  }
}, { timestamps: true });

UserSchema.pre('validate', function (next) {
  // Normalizes to E.164 (e.g. "7842456778" -> "+917842456778") whichever
  // path set/changed phone — self-registration, admin-created accounts,
  // profile edits — so it always matches what Firebase Phone Auth verifies
  // to and what password login by phone compares against. See
  // scripts/normalizePhoneNumbers.js for the one-off fix to existing data.
  if (this.isModified('phone') && this.phone) {
    this.phone = normalizePhone(this.phone);
  }
  if (!this.email && !this.phone) {
    return next(new Error('An email or phone number is required'));
  }
  next();
});

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Every account gets a userId eventually, even ones created before this
// field existed — self-heals on the next save rather than needing every
// account to go through the one-off backfill script (scripts/backfillUserIds.js)
// immediately.
UserSchema.pre('save', async function (next) {
  if (this.userId) return next();
  try {
    this.userId = await generateUniqueUserId(this.name, (candidate) => this.constructor.exists({ userId: candidate }));
    next();
  } catch (err) {
    next(err);
  }
});

UserSchema.methods.comparePassword = function (candidate) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

// Never leak the password hash when serialized to JSON.
UserSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    return ret;
  }
});

module.exports = mongoose.model('User', UserSchema);
