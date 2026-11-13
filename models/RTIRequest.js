const mongoose = require('mongoose');
const Counter = require('./Counter');
const { INDIAN_STATES } = require('./Issue');

// Not imported from Issue.js — its AttachmentSchema isn't exported, and
// models/IssueEscalation.js already establishes the precedent of
// duplicating this exact shape rather than trying to share it.
const RTIAttachmentSchema = new mongoose.Schema({
  fileName: String,
  originalName: String,
  url: String
}, { timestamps: true });

// A lawyer's dated progress update on a request — the "work notes /
// workflow" the citizen sees, separate from (and more frequent than) the
// discrete status transitions below.
const WorkNoteSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  note: { type: String, required: true, trim: true }
}, { timestamps: true });

const STATUSES = ['Submitted', 'Fee Quoted', 'Accepted', 'Rejected', 'Filed', 'Resolved', 'Cancelled'];
const JURISDICTIONS = ['Central', 'State'];
const REJECTED_BY = ['Citizen', 'Lawyer'];
// Despite the model/route name (kept as "RTIRequest"/"rti-requests" to
// avoid a disruptive rename of already-shipped code) this now covers any
// "act on my behalf" legal request, not just RTI filings — REQUEST_TYPES
// is what actually surfaces to citizens as the request's real subject.
const REQUEST_TYPES = ['RTI', 'Criminal Case', 'Civil Case', 'Registration', 'Land Dispute', 'Mortgage/Sale', 'Other'];

const RTIRequestSchema = new mongoose.Schema({
  requestNumber: { type: String, unique: true, index: true },
  requestType: { type: String, enum: REQUEST_TYPES, default: 'RTI' },

  citizen: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Null until a Lawyer claims it (self-serve), a citizen requests a
  // specific one directly (Find a Lawyer), or staff assigns one.
  lawyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  subject: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  // The four fields below are RTI Act 2005 filing requirements, not
  // universal to every request type — required only when requestType is
  // 'RTI' (enforced in the controller, not the schema, since Mongoose's
  // static `required` can't easily branch on a sibling field).
  publicAuthority: { type: String, trim: true },
  jurisdiction: { type: String, enum: JURISDICTIONS },
  state: { type: String, enum: INDIAN_STATES },
  applicantAddress: { type: String, trim: true },

  attachments: [RTIAttachmentSchema],
  responseAttachments: [RTIAttachmentSchema],
  workNotes: [WorkNoteSchema],

  status: { type: String, enum: STATUSES, default: 'Submitted' },

  quotedFee: Number,
  // Explicit rather than inferring "free" from quotedFee === 0, so a
  // lawyer choosing to do the work for free reads as a deliberate choice,
  // not an unset/zero value.
  isFree: { type: Boolean, default: false },
  quoteNote: { type: String, trim: true },
  quotedAt: Date,
  quotedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  decisionAt: Date,
  rejectedBy: { type: String, enum: REJECTED_BY },
  rejectionReason: { type: String, trim: true },

  filedAt: Date,
  filedReferenceNumber: { type: String, trim: true },

  resolvedAt: Date,
  responseSummary: { type: String, trim: true },

  cancelledAt: Date,

  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Auto-generate a human-friendly request number like LR-000123, same
// atomic-counter pattern as Issue.issueNumber (see Issue.js). Kept on the
// same 'rtiRequestNumber' counter key used before this generalization —
// changing the display prefix doesn't affect the persisted counter value,
// only which string gets built from it.
RTIRequestSchema.pre('save', async function (next) {
  if (this.requestNumber) return next();
  try {
    const seq = await Counter.getNextSequence('rtiRequestNumber', async () => {
      const last = await this.constructor.findOne({}, 'requestNumber').sort({ requestNumber: -1 });
      const match = last && /^(?:LR|RTI)-(\d+)$/.exec(last.requestNumber || '');
      return match ? parseInt(match[1], 10) : 0;
    });
    this.requestNumber = 'LR-' + String(seq).padStart(6, '0');
    next();
  } catch (err) {
    next(err);
  }
});

const RTIRequest = mongoose.model('RTIRequest', RTIRequestSchema);
RTIRequest.STATUSES = STATUSES;
RTIRequest.JURISDICTIONS = JURISDICTIONS;
RTIRequest.REJECTED_BY = REJECTED_BY;
RTIRequest.REQUEST_TYPES = REQUEST_TYPES;

module.exports = RTIRequest;
