const mongoose = require('mongoose');

// One document per "Send Email" action from the Users tab (not the
// per-issue/comment notification emails — those fire far too often to be a
// useful audit trail and already have their own in-app Notification record).
// `recipients` captures a per-user delivery outcome so a Staff member can
// see exactly who got the email and who didn't, not just an aggregate count.
const RecipientSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  email: String,
  status: { type: String, enum: ['sent', 'failed'], required: true },
  error: String
}, { _id: false });

const EmailLogSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  message: { type: String, required: true }, // the HTML actually sent, for later reference
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipients: [RecipientSchema],
  sentCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  skippedCount: { type: Number, default: 0 }
}, { timestamps: true });

EmailLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('EmailLog', EmailLogSchema);
