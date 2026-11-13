import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../common/Avatar';
import { CATEGORY_ICONS, hueFor } from '../common/IssuePlaceholder';

// mobileOpen/onSelectCategory together also control the mobile "Categories"
// trigger button, which lives up in Feed's single-line filter row instead
// of here — this card supplies the dropdown panel it opens, and stays
// fully expanded (no toggle) on desktop.
//
// The file, component and props still say "tags" (as does the tagsSidebar
// toggle key it's shown/hidden by): that's the stored name this thing has
// always had, and renaming it would mean changing a key already saved in the
// database. Same split as Escalated/"Acknowledged" elsewhere — stored name
// inside, the word people actually use on screen.
export default function TagsSidebar({ categories, activeCategory, onSelectCategory, onPostIssue, mobileOpen, showTags = true }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="d-flex flex-column gap-3">
      {showTags && (
        <div className={`card feed-sidebar-card p-3 ${mobileOpen ? '' : 'd-none d-lg-block'}`}>
          {/* "Categories" is what these are everywhere else in the app — the
              field on an issue, the Raise an Issue form, the admin filters —
              so calling them tags here was the odd one out. The flame icon
              went with it: it read as "trending", which this list isn't; it's
              the full category list with counts. */}
          <div className="eyebrow mb-2 d-none d-lg-block"><i className="bi bi-collection-fill me-1"></i>Categories</div>
          <div className={`d-lg-flex flex-column gap-2 tag-list ${mobileOpen ? 'd-flex' : 'd-none'}`}>
            <button
              className={`tag-embossed justify-content-between ${!activeCategory ? 'active' : ''}`}
              onClick={() => onSelectCategory('')}
            >
              <span><i className="bi bi-grid-fill me-2"></i>All issues</span>
            </button>
            {categories.map(c => (
              <button
                key={c.category}
                className={`tag-embossed justify-content-between ${activeCategory === c.category ? 'active' : ''}`}
                onClick={() => onSelectCategory(c.category)}
                style={{ '--chip-hue': hueFor(c.category) }}
              >
                <span><i className={`bi ${CATEGORY_ICONS[c.category] || CATEGORY_ICONS.Other} me-2`}></i>{c.category}</span>
                <span className="count">{c.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Redundant on mobile — profile is in the navbar, and Raise an Issue
          already has its own button there too. Keep it on desktop where the
          sidebar has room to spare. */}
      <div className="card feed-sidebar-card p-3 text-center d-none d-lg-block">
        {user ? (
          <>
            <Avatar name={user.name} size="lg" />
            <div className="fw-semibold mt-2 mb-3">{user.name}</div>
            <button className="btn btn-gradient w-100" onClick={onPostIssue}>
              <i className="bi bi-megaphone-fill me-1"></i>Raise an issue
            </button>
          </>
        ) : (
          <>
            <div className="fw-semibold mb-2">Join the conversation</div>
            <p className="text-muted small">Log in to post issues, comment, and support your neighbours.</p>
            <button className="btn btn-gradient w-100" onClick={() => navigate('/login')}>Log in</button>
          </>
        )}
      </div>
    </div>
  );
}
