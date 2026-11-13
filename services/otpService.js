const bcrypt = require('bcryptjs');
const Otp = require('../models/Otp');
const email = require('./emailService');

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isEmail(identifier) {
  return /\S+@\S+\.\S+/.test(identifier);
}

exports.isEmail = isEmail;

// Email-only — phone verification goes through Firebase Phone Auth instead
// (see services/firebaseAdminService.js / POST /api/auth/firebase-phone),
// which sends and checks the SMS code itself rather than through this
// server-side code+hash flow.
exports.requestOtp = async (identifier) => {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  // Invalidate any earlier unconsumed codes for this identifier first.
  await Otp.updateMany({ identifier, consumed: false }, { consumed: true });
  await Otp.create({ identifier, channel: 'email', codeHash, expiresAt });

  await email.sendMail(
    identifier,
    'Your Act On Issues verification code',
    `<p>Your verification code is <b>${code}</b>. It expires in ${CODE_TTL_MINUTES} minutes.</p>`
  );
};

// Verifies a submitted code against the most recent unconsumed OTP for that identifier.
exports.verifyOtp = async (identifier, code) => {
  const otp = await Otp.findOne({ identifier, consumed: false }).sort({ createdAt: -1 });
  if (!otp) return { valid: false, reason: 'No active code found. Request a new one.' };
  if (otp.expiresAt < new Date()) return { valid: false, reason: 'Code expired. Request a new one.' };
  if (otp.attempts >= MAX_ATTEMPTS) return { valid: false, reason: 'Too many attempts. Request a new one.' };

  const match = await bcrypt.compare(code, otp.codeHash);
  if (!match) {
    otp.attempts += 1;
    await otp.save();
    return { valid: false, reason: 'Incorrect code.' };
  }

  otp.consumed = true;
  await otp.save();
  return { valid: true };
};
