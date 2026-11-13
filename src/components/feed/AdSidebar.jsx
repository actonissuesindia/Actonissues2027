import { Link } from 'react-router-dom';

// Placeholder ad slot for the Feed's right rail — no ad-serving logic yet,
// just reserving the layout space so real inventory can slot in here later
// without a layout change. Links to the existing About page rather than a
// dedicated advertiser contact channel, since there isn't one yet. Visibility
// at the xl breakpoint is controlled by the grid column in Feed.jsx, not here.
export default function AdSidebar() {
  return (
    <div className="card feed-sidebar-card p-3 text-center">
      <div
        className="d-flex flex-column align-items-center justify-content-center gap-2 text-muted"
        style={{ border: '2px dashed var(--bs-border-color)', borderRadius: 14, minHeight: 250, padding: '1rem' }}
      >
        <i className="bi bi-megaphone" style={{ fontSize: '1.75rem' }}></i>
        <div className="small fw-semibold">Advertisement space</div>
        <div className="small">Reach citizens actively reporting issues in your area.</div>
        <Link to="/about" className="btn btn-sm btn-pill-outline mt-1">Learn more</Link>
      </div>
    </div>
  );
}
