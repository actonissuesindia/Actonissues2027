const mongoose = require('mongoose');

const OtpSchema = new mongoose.Schema({
  // Normalized identifier the code was sent to (email or phone).
  identifier: { type: String, required: true, index: true },
  channel: { type: String, enum: ['email', 'sms'], required: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  consumed: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });

// MongoDB TTL index: documents are auto-deleted once expiresAt passes.
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Otp', OtpSchema);
