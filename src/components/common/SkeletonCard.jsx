// A card-shaped placeholder shown while real content is loading — reads as
// faster than a spinner even though the actual load time is identical.
export default function SkeletonCard() {
  return (
    <div className="card issue-card p-3 mb-3 h-100" aria-hidden="true">
      <div className="d-flex align-items-center gap-2 mb-3">
        <div className="skeleton-shimmer skeleton-avatar"></div>
        <div className="flex-grow-1">
          <div className="skeleton-shimmer skeleton-line" style={{ width: '55%' }}></div>
          <div className="skeleton-shimmer skeleton-line mt-2" style={{ width: '35%', height: 9 }}></div>
        </div>
      </div>
      <div className="skeleton-shimmer skeleton-line mb-2" style={{ width: '30%', height: 20, borderRadius: 999 }}></div>
      <div className="skeleton-shimmer skeleton-line mb-1"></div>
      <div className="skeleton-shimmer skeleton-line mb-3" style={{ width: '75%' }}></div>
      <div className="skeleton-shimmer" style={{ aspectRatio: '16 / 10', borderRadius: 14 }}></div>
    </div>
  );
}
