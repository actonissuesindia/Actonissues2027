// Persistent circular "raise an issue" button, mobile only — the equivalent
// top-nav button is easy to lose track of once you've scrolled a long feed.
export default function FloatingActionButton({ onClick }) {
  return (
    <button type="button" className="fab-post-issue d-md-none" onClick={onClick} title="Raise an issue" aria-label="Raise an issue">
      <i className="bi bi-plus-lg"></i>
    </button>
  );
}
