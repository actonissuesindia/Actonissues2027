export default function EmptyState({ icon = 'bi-inbox', title, subtitle, action }) {
  return (
    <div className="empty-state text-center py-5">
      <div className="empty-state-icon mb-3"><i className={`bi ${icon}`}></i></div>
      <div className="fw-semibold mb-1">{title}</div>
      {subtitle && <div className="text-muted small mb-3">{subtitle}</div>}
      {action}
    </div>
  );
}
