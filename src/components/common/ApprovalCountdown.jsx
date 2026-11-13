import { useEffect, useState } from 'react';

function formatRemaining(ms) {
  if (ms <= 0) return 'now';
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

// A small, self-contained pill showing the live countdown to a Pending
// post's auto-approval deadline. The deadline is computed from the post's
// createdAt plus the *current* admin-configured window (days/hours/minutes,
// from GET /issues/meta) rather than a value frozen when the post was
// created — so changing the setting is reflected immediately for every
// already-pending post, not just new ones. Ticks every minute — the
// deadline itself is minutes-to-days away, so per-second updates would
// just be wasted re-renders.
export default function ApprovalCountdown({ createdAt, days = 0, hours = 0, minutes = 0 }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  if (!createdAt) return null;
  const windowMs = ((days * 24 + hours) * 60 + minutes) * 60 * 1000;
  if (windowMs <= 0) return null;
  const remaining = new Date(createdAt).getTime() + windowMs - now;

  return (
    <span
      className="d-inline-flex align-items-center gap-1 rounded-pill px-2 py-1"
      style={{ background: 'var(--badge-progress-bg, #fef3c7)', color: 'var(--badge-progress-text, #b45309)', fontSize: '.72rem', fontWeight: 600, lineHeight: 1 }}
      title="Automatically published if no one reviews it before this timer runs out"
    >
      <i className="bi bi-stopwatch"></i>
      {formatRemaining(remaining)}
    </span>
  );
}
