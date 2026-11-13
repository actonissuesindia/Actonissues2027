// Session-based auth guards for the JSON API. These return 401/403 JSON
// responses instead of redirecting, since the client is a separate SPA.

// Three-tier role model. NOTE: stored role names are display-swapped in the
// UI (see utils/roleLabel.js) — "Admin" here is shown to users as
// "Authority", and "Authority" is shown as "Admin".
//   Citizen   - create/manage own issues, view all issues read-only.
//   Authority - regulate/moderate any issue; user management scoped to
//               Citizen accounts only (see userAdminController.canManage).
//   Admin     - everything: regulates any issue, manages every account
//               including role assignment, system settings, and the audit log.
const STAFF_ROLES = ['Admin', 'Authority'];

// RTI requests are managed by staff (Admin/Authority) and by the Lawyer
// role, which has no other access beyond its own dedicated dashboard.
const LEGAL_ROLES = ['Admin', 'Authority', 'Lawyer'];

// Sessions live for 7 days (server.js cookie maxAge), but should also end
// early after an hour of no activity — a stolen/left-open cookie shouldn't
// stay usable indefinitely just because the 7-day ceiling hasn't hit yet.
// `lastActivityAt` isn't set at login (authController has too many
// login-ish paths to touch individually) — it's simply initialized here on
// whatever the first authenticated request after login happens to be, then
// refreshed on every one after that.
const IDLE_TIMEOUT_MS = 60 * 60 * 1000;

function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    const now = Date.now();
    if (req.session.lastActivityAt && now - req.session.lastActivityAt > IDLE_TIMEOUT_MS) {
      return req.session.destroy(() => {
        // Without this, the browser keeps resending a session ID that no
        // longer exists in the store on every future request, so the
        // session middleware tries (and fails) to touch/refresh a deleted
        // session document on every single page load from that browser.
        res.clearCookie('connect.sid');
        res.status(401).json({ success: false, message: 'Signed out due to inactivity', idleTimeout: true });
      });
    }
    req.session.lastActivityAt = now;
    req.user = req.session.user;
    return next();
  }
  return res.status(401).json({ success: false, message: 'Authentication required' });
}

// Populates req.user when a session exists, but never blocks the request —
// for routes that are public but need to behave differently for a logged-in
// owner or staff member (e.g. seeing your own pending posts).
function identify(req, res, next) {
  if (req.session && req.session.user) {
    req.user = req.session.user;
  }
  next();
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    next();
  };
}

// Shorthand for routes open to both Admin and Authority (the "staff" tiers).
function authorizeStaff() {
  return authorize(...STAFF_ROLES);
}

function isStaff(user) {
  return !!user && STAFF_ROLES.includes(user.role);
}

// Shorthand for routes open to staff (Admin/Authority) plus Lawyer — used
// by RTI request management, where all three can act on a request, just
// through different frontend surfaces (AdminDashboard tab vs. the
// dedicated Lawyer dashboard).
function authorizeLegal() {
  return authorize(...LEGAL_ROLES);
}

function isLegalStaff(user) {
  return !!user && LEGAL_ROLES.includes(user.role);
}

module.exports = {
  isAuthenticated, identify, authorize, authorizeStaff, isStaff, STAFF_ROLES,
  authorizeLegal, isLegalStaff, LEGAL_ROLES
};
