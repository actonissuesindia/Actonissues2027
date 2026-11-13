const mongoose = require('mongoose');

// One document per "Escalate to Authority" action from an issue's page —
// scoped to a single Issue (unlike EmailLog, which is the Users tab's
// User-recipient-shaped bulk-email audit trail). Also holds any replies the
// authority sends back, captured via the Brevo inbound-parsing webhook (see
// routes/webhookRoutes.js) — matched to this document by its derived
// reply-to address `esc-<_id>@INBOUND_REPLY_DOMAIN`, not stored separately.
const ReplySchema = new mongoose.Schema({
  from: String,
  subject: String,
  body: String, // just what the sender typed — the quoted original is split off on the way in (utils/quotedReply.js)
  quotedBody: String, // the original escalation email their client quoted back at us, kept for reference but collapsed in the UI
  receivedAt: { type: Date, default: Date.now }
}, { _id: false });

// Extra images staff attach specifically to this escalation (in addition to
// whichever of the issue's own photos already qualify — see
// controllers/escalationController.js), same shape as Issue's own
// AttachmentSchema for consistency.
const EscalationAttachmentSchema = new mongoose.Schema({
  fileName: String,
  originalName: String,
  url: String
}, { _id: false, timestamps: true });

const IssueEscalationSchema = new mongoose.Schema({
  issue: { type: mongoose.Schema.Types.ObjectId, ref: 'Issue', required: true, index: true },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorityName: String,
  authorityEmail: { type: String, required: true, trim: true },
  ccEmails: [{ type: String, trim: true }], // additional recipients on the same email, e.g. a second department or the reporter's own copy
  subject: { type: String, required: true },
  message: { type: String, required: true }, // the HTML actually sent, for later reference
  attachments: [EscalationAttachmentSchema],
  status: { type: String, enum: ['Sent', 'Failed'], default: 'Sent' },
  error: String,
  replies: [ReplySchema]
}, { timestamps: true });

IssueEscalationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('IssueEscalation', IssueEscalationSchema);
