const mongoose = require('mongoose');

// Mirrors the Panchayati Raj Institution's real 3-tier structure (as used
// by lgdirectory.gov.in's own "PRI Localbody Email IDs" report: Zilla
// Parishad -> Mandal Panchayat -> Grama Panchayat) so a contact's level is
// explicit rather than folded into one freeform text field. 'Other' covers
// non-PRI contacts (Municipal Corporation, Electricity Board, etc.) that
// don't belong to this hierarchy at all.
const LEVELS = ['District', 'Mandal', 'Village', 'Other'];

// A staff-maintained address book of local authority/department contacts
// (e.g. a specific Gram Panchayat office, Municipal Corporation ward,
// Electricity Board division) — picked from a dropdown in
// EscalateIssueModal.jsx instead of typing an email from memory every
// time, matched against an issue's own state/district/mandal so the most
// specific level (Village over Mandal over District) is suggested first.
// Deliberately staff-editable rather than hardcoded or scraped: real
// department emails vary by state/district/panchayat and change over time,
// so only local staff who actually escalate issues in that area can keep
// this current. See docs/DEPLOYMENT.md's note on lgdirectory.gov.in (the
// Ministry of Panchayati Raj's own directory) as the authoritative place to
// look up a Panchayat's official email before adding it here.
const DepartmentContactSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
  phone: { type: String, trim: true, maxlength: 30 },
  level: { type: String, enum: LEVELS, default: 'Other' },
  state: { type: String, trim: true, maxlength: 80 },
  district: { type: String, trim: true, maxlength: 80 },
  mandal: { type: String, trim: true, maxlength: 80 }, // blank for a District-level or Other contact
  notes: { type: String, trim: true, maxlength: 300 },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

DepartmentContactSchema.index({ state: 1, district: 1, mandal: 1, name: 1 });

module.exports = mongoose.model('DepartmentContact', DepartmentContactSchema);
module.exports.LEVELS = LEVELS;
