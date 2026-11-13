const STYLES = {
  Pending: 'badge-status-progress',
  Rejected: 'badge-status-rejected'
};

const LABELS = {
  Pending: 'Pending Review',
  Rejected: 'Not Approved'
};

// Only renders for non-Approved posts — Approved posts show no extra badge,
// since that's the normal, expected state once something is public.
export default function ModerationBadge({ status }) {
  if (!status || status === 'Approved') return null;
  return <span className={`badge-pill ${STYLES[status] || 'badge-status-rejected'}`}>{LABELS[status] || status}</span>;
}
