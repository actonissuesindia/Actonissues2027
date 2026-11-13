// Shared validation for anything that sets an account's email or password —
// used by both self-service (register, reset/change password) and
// admin-driven (create user, reset a user's password) flows, so the rule
// is enforced consistently everywhere a password can be set, not just at
// the one place someone happened to add a check first.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_RE = /^.{6,16}$/;

// Letters, numbers, dots, underscores, hyphens, and @ — matches the
// auto-generated "name@aoi" shape but doesn't require it.
const USER_ID_RE = /^[a-z0-9._@-]{3,30}$/;

exports.PASSWORD_RULES_TEXT = '6-16 characters.';

exports.USER_ID_RULES_TEXT = '3-30 characters — letters, numbers, dots, underscores, hyphens, and @ only.';

exports.isValidEmail = (email) => EMAIL_RE.test(String(email || ''));

exports.isValidPassword = (password) => PASSWORD_RE.test(String(password || ''));

exports.isValidUserId = (userId) => USER_ID_RE.test(String(userId || ''));
