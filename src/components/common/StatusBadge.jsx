const STATUS_CLASS = {
  'Open': 'badge-status-open',
  'In Progress': 'badge-status-progress',
  'Escalated': 'badge-status-escalated',
  'Resolved': 'badge-status-resolved',
  'Rejected': 'badge-status-rejected'
};

// Stored value stays 'Escalated' (business logic, filters, DB records all
// still key off that) — only the text shown to users is renamed, same
// display-only pattern as moderationStatus's Rejected/Refused elsewhere.
const DISPLAY_LABELS = { 'Escalated': 'Acknowledged' };

export default function StatusBadge({ status }) {
  return <span className={`badge-pill ${STATUS_CLASS[status] || 'badge-status-rejected'}`}>{DISPLAY_LABELS[status] || status}</span>;
}

// RTI requests have their own status set (Submitted/Fee Quoted/Accepted/
// Filed/Resolved/Rejected/Cancelled) — mapped onto the same underlying
// open/progress/resolved/rejected visual buckets as STATUS_CLASS above,
// not reused directly, since e.g. Issue's "Escalated" and RTI's "Filed"
// are unrelated concepts that shouldn't share a class key by coincidence.
const RTI_STATUS_CLASS = {
  'Submitted': 'badge-status-open',
  'Fee Quoted': 'badge-status-progress',
  'Accepted': 'badge-status-progress',
  'Filed': 'badge-status-progress',
  'Resolved': 'badge-status-resolved',
  'Rejected': 'badge-status-rejected',
  'Cancelled': 'badge-status-rejected'
};

export function RTIStatusBadge({ status }) {
  return <span className={`badge-pill ${RTI_STATUS_CLASS[status] || 'badge-status-rejected'}`}>{status}</span>;
}
