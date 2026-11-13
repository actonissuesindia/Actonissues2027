const LABELS = { Resolved: 'Resolved', Rejected: 'Rejected', Escalated: 'Acknowledged' };
const TONES = { Resolved: 'stamp-resolved', Rejected: 'stamp-rejected', Escalated: 'stamp-escalated' };

export default function StatusStamp({ status, size = 'md' }) {
  if (!LABELS[status]) return null;
  const tone = TONES[status];
  return (
    <div className={`status-stamp ${tone} ${size === 'lg' ? 'status-stamp-lg' : ''}`}>
      {LABELS[status]}
    </div>
  );
}
