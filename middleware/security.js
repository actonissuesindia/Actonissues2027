const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// A single-page app easily fires 5-10 API calls per page view (issues, stats,
// category counts, top reporters, notifications, ...), so a low general cap
// blocks normal browsing — not just abuse. This is generous on purpose;
// dedicated limiters (like otpLimiter below) guard the genuinely costly routes.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 600 : 3000,
  standardHeaders: true,
  legacyHeaders: false
});

// Password guessing needs a much tighter cap than general API traffic — the
// general limiter's 600/15min is fine for normal browsing but would happily
// let an attacker try hundreds of passwords against one account. Keyed by
// IP (the default): a genuine user mistyping their password a few times
// stays well under this; credential-stuffing at scale does not.
// The ceiling only matters where the traffic is real and hostile. Raised
// outside production for the same reason the general limiter above is: the
// test suite signs in dozens of times from one address within seconds, and
// local development does much the same, neither of which is credential
// stuffing. Same production value as before.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Try again in a few minutes.' }
});

// OTP requests can trigger a real SMS/email send, so cap them tighter than
// general API traffic to limit abuse cost.
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  message: { success: false, message: 'Too many code requests. Try again in a few minutes.' }
});

// Online Ludo polls every ~2s per active game. Keyed by user id (not IP,
// the default) so players sharing one household/mobile-carrier IP each get
// their own budget instead of exhausting a shared one — an IP-keyed limit
// here would let one game throttle every other player on the same network.
const gameLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user?._id ? String(req.user._id) : req.ip)
});

// Link-preview images (/og/...) are public and unauthenticated by necessity —
// a crawler can't sign in — and each *uncached* one costs a photo download
// plus a decode. Cached repeats are nearly free, so this only needs to be
// tight enough to stop someone walking thousands of distinct ids, while
// staying far above what a burst of real crawlers (one share can wake several
// at once) would ever use.
const ogImageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  helmet,
  limiter,
  loginLimiter,
  otpLimiter,
  gameLimiter,
  ogImageLimiter
};
