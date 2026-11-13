import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import TopNav from '../../components/layout/TopNav';
import TagsSidebar from '../../components/feed/TagsSidebar';
import AdSidebar from '../../components/feed/AdSidebar';
import GooglePlacesLocationSearch from '../../components/feed/GooglePlacesLocationSearch';
import IssueCard from '../../components/feed/IssueCard';
import PostIssueModal from '../../components/create/PostIssueModal';
import SkeletonCard from '../../components/common/SkeletonCard';
import EmptyState from '../../components/common/EmptyState';
import FloatingActionButton from '../../components/common/FloatingActionButton';
import ScrollTopBottomButton from '../../components/common/ScrollTopBottomButton';
import usePageBlocks from '../../hooks/usePageBlocks';
import usePageTitle from '../../hooks/usePageTitle';

const FILTERS = [
  { key: 'latest', label: 'Latest' },
  { key: 'hot', label: 'Trending' },
  { key: 'escalated', label: 'Acknowledged' },
  { key: 'resolved', label: 'Resolved' }
];

// The feed used to fetch every matching issue on every filter/category/
// search change, unbounded — fine at a handful of posts, but it only gets
// slower as the collection grows since the whole thing gets re-fetched,
// re-transmitted and re-rendered every time. Paginated in pages of this
// size instead, with a "Load more" button for anyone who wants to keep
// scrolling past the first page.
const PAGE_SIZE = 20;

export default function Feed() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || '';
  const filter = params.get('filter') || 'latest';
  usePageTitle(category ? `${category} Issues` : 'Feed');
  const status = params.get('status') || '';
  const location = params.get('location') || '';
  // Set together with `location` (see setParamsMulti below) whenever a
  // Google Places suggestion is picked — drive the $near radius query on
  // the backend instead of the plain-text substring match `location` alone
  // used to do.
  const locLat = params.get('locLat') || '';
  const locLng = params.get('locLng') || '';
  const radiusKm = Number(params.get('radius')) || 10;
  // Deliberately NOT synced to the URL like the other filters above — a
  // search term can contain personal/sensitive text a visitor typed, and
  // putting it in the address bar means it ends up in browser history and
  // in anything copied/shared/screenshotted from that bar. Kept as plain
  // component state instead: it still drives the same /api/issues?q=...
  // request (that's an internal request the address bar never shows), it
  // just doesn't round-trip through the visible URL.
  const [q, setQ] = useState('');

  const [issues, setIssues] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  // Search + location filters don't fit side by side on a phone as full
  // text inputs (one wraps below, cut off) — on mobile they collapse to a
  // pair of icon buttons instead, and tapping one expands it in place.
  // null = both collapsed, 'search' | 'location' = that one is expanded.
  const [mobileFilterOpen, setMobileFilterOpen] = useState(null);
  // Tags don't take over the row like search/location do (a category list
  // needs its own dropdown panel, not a single-line input) — tracked
  // separately so the trigger row stays visible with the panel open below it.
  const [mobileTagsOpen, setMobileTagsOpen] = useState(false);

  // Page Builder toggles (Super Admin only) — see
  // scripts/seedPageBlocks/seedFeedToggles.js. Everything defaults to shown
  // if the toggles haven't loaded/been seeded yet, so a fetch hiccup never
  // silently removes working functionality.
  const feedToggleBlocks = usePageBlocks('feed-toggles');
  const isToggleOn = (key) => {
    if (feedToggleBlocks === null || feedToggleBlocks.length === 0) return true;
    const block = feedToggleBlocks.find(b => b.config.key === key);
    return block ? block.visible : true;
  };
  const showSearch = isToggleOn('search');
  const showLocationFilter = isToggleOn('locationFilter');
  const showTagsSidebar = isToggleOn('tagsSidebar');
  const showFab = isToggleOn('fab');
  const showScrollTop = isToggleOn('scrollTop');

  // The Super Admin (stored 'Admin') always has full access to every page
  // on the site, the feed included — never bounced. Authority ("Admin" in
  // the UI) only sees the control panel instead, unless the Super Admin has
  // granted that individual account access (per-account checkbox in Admin
  // Dashboard > Users — User.canAccessHomeFeed, not a site-wide toggle).
  useEffect(() => {
    if (user && user.role === 'Authority' && !user.canAccessHomeFeed) {
      navigate('/author', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    api.get('/issues/category-counts').then(res => setCategories(res.data.categories)).catch(() => {});
  }, []);

  // Deep link from the welcome tour's "Raise your first issue" button
  // (?post=1) — open the post-issue modal straight away, then drop the
  // param so it doesn't reopen on a back-navigation or refresh.
  useEffect(() => {
    if (params.get('post') === '1' && user) {
      setShowModal(true);
      const next = new URLSearchParams(params);
      next.delete('post');
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const buildParams = (pageNum) => {
    const apiParams = { limit: PAGE_SIZE, page: pageNum };
    if (category) apiParams.category = category;
    if (q) apiParams.q = q;
    if (status) apiParams.status = status;
    else if (filter === 'resolved') apiParams.status = 'Resolved';
    else if (filter === 'escalated') apiParams.status = 'Escalated';
    // A picked Google Places suggestion (locLat/locLng) drives a precise
    // $near query on the backend, which is strictly more accurate than the
    // plain-text `location` substring match — send both when present so an
    // old bookmarked link with only `location` still works.
    if (location) apiParams.location = location;
    if (locLat && locLng) { apiParams.lat = locLat; apiParams.lng = locLng; apiParams.radiusKm = radiusKm; }
    return apiParams;
  };

  useEffect(() => {
    setLoading(true);
    setPage(1);
    api.get('/issues', { params: buildParams(1) })
      .then(res => { setIssues(res.data.issues); setTotal(res.data.total ?? res.data.issues.length); })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, filter, q, status, location, locLat, locLng, radiusKm, user]);

  const loadMore = () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    api.get('/issues', { params: buildParams(nextPage) })
      .then(res => { setIssues(prev => [...prev, ...res.data.issues]); setPage(nextPage); })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  const visibleIssues = useMemo(() => {
    let list = [...issues];
    if (filter === 'hot') list.sort((a, b) => (b.supportCount ?? 0) - (a.supportCount ?? 0));
    return list;
  }, [issues, filter]);

  // Infinite scroll: fetch the next page automatically once the sentinel
  // below the grid nears the viewport, instead of waiting for a click.
  const loadMoreRef = useRef(null);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);
  hasMoreRef.current = issues.length < total;
  loadingMoreRef.current = loadingMore;

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMoreRef.current && !loadingMoreRef.current) {
        loadMore();
      }
    }, { rootMargin: '400px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleIssues.length]);

  const badgeCount = total;
  const hasMore = issues.length < total;

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  };

  // setParam reads `params` fresh each call, so calling it several times in
  // a row within the same handler (e.g. location label + lat + lng + radius
  // together) would have each call clobber the previous one's still-pending
  // update. This applies them all against one snapshot in a single commit.
  const setParamsMulti = (entries) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(entries)) {
      if (value) next.set(key, value); else next.delete(key);
    }
    setParams(next);
  };

  const selectLocation = ({ label, lat, lng }) => {
    setParamsMulti({ location: label, locLat: String(lat), locLng: String(lng), radius: String(radiusKm) });
  };

  const clearLocation = () => {
    setParamsMulti({ location: '', locLat: '', locLng: '', radius: '' });
  };

  // Switching filter tabs has to also drop any leftover status= (e.g. from
  // following a "status=Open" link off the Home page's stat cards) —
  // otherwise that stale status wins in the fetch effect below and a tab
  // like Escalated silently shows whatever status was still in the URL
  // instead of its own.
  const selectFilter = (key) => {
    const next = new URLSearchParams(params);
    if (key === 'latest') next.delete('filter'); else next.set('filter', key);
    next.delete('status');
    setParams(next);
  };

  const submitSearch = (e) => {
    e.preventDefault();
    setQ(searchInput.trim());
  };

  const openPostModal = () => {
    if (!user) { window.location.href = '/login'; return; }
    setShowModal(true);
  };

  return (
    <div>
      <TopNav onPostIssue={openPostModal} />

      <div className="container-fluid px-4 px-lg-5 py-2 py-lg-4">
        {/* Mobile: the two filters don't fit side by side as full inputs
            (one wraps below, cut off) — collapsed to a pair of icon
            buttons instead, tapping one expands it in place. */}
        {(showSearch || showLocationFilter || showTagsSidebar) && (
        <form onSubmit={submitSearch} className="d-flex d-md-none gap-2 mb-2">
          {mobileFilterOpen === null && (
            <>
              {showSearch && (
                <button
                  type="button"
                  className="btn btn-pill-outline flex-fill d-flex align-items-center justify-content-center gap-1 px-2"
                  onClick={() => { setMobileFilterOpen('search'); setMobileTagsOpen(false); }}
                >
                  <i className="bi bi-search"></i>
                  {searchInput ? <span className="text-truncate small">{searchInput}</span> : <span className="small">Search</span>}
                </button>
              )}
              {showLocationFilter && (
                <button
                  type="button"
                  className="btn btn-pill-outline flex-fill d-flex align-items-center justify-content-center gap-1 px-2"
                  onClick={() => { setMobileFilterOpen('location'); setMobileTagsOpen(false); }}
                >
                  <i className="bi bi-geo-alt"></i>
                  {location ? <span className="text-truncate small">{location}</span> : <span className="small">Location</span>}
                </button>
              )}
              {showTagsSidebar && (
                <button
                  type="button"
                  className="btn btn-pill-outline flex-fill d-flex align-items-center justify-content-center gap-1 px-2"
                  onClick={() => setMobileTagsOpen(o => !o)}
                >
                  <i className="bi bi-collection-fill"></i>
                  <span className="text-truncate small">{category || 'Categories'}</span>
                  <i className={`bi bi-chevron-down small flex-shrink-0`} style={{ transform: mobileTagsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}></i>
                </button>
              )}
            </>
          )}
          {mobileFilterOpen === 'search' && (
            <div className="d-flex align-items-center gap-2 w-100">
              <button type="button" className="btn btn-pill-ghost p-2 flex-shrink-0" aria-label="Back" onClick={() => setMobileFilterOpen(null)}>
                <i className="bi bi-arrow-left"></i>
              </button>
              <div className="position-relative flex-grow-1">
                <button type="submit" aria-label="Search" className="position-absolute top-50 translate-middle-y ms-3 text-muted border-0 bg-transparent p-0" style={{ zIndex: 2 }}>
                  <i className="bi bi-search"></i>
                </button>
                <input
                  className="form-control ps-5 rounded-pill"
                  placeholder="Search issues, categories, cities…"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}
          {mobileFilterOpen === 'location' && (
            <div className="d-flex align-items-center gap-2 w-100">
              <button type="button" className="btn btn-pill-ghost p-2 flex-shrink-0" aria-label="Back" onClick={() => setMobileFilterOpen(null)}>
                <i className="bi bi-arrow-left"></i>
              </button>
              <div className="flex-grow-1">
                <GooglePlacesLocationSearch
                  value={location}
                  radiusKm={radiusKm}
                  onSelect={(picked) => { selectLocation(picked); setMobileFilterOpen(null); }}
                  onRadiusChange={(km) => setParam('radius', String(km))}
                  onClear={clearLocation}
                />
              </div>
            </div>
          )}
        </form>
        )}
        {showLocationFilter && location && (
          <div className="mb-2">
            <span className="chip active">
              Location: {location}{locLat && locLng ? ` (within ${radiusKm} km)` : ''}
              <button type="button" className="btn btn-link p-0 ms-1 text-decoration-none" style={{ lineHeight: 1, color: 'inherit' }}
                onClick={clearLocation} title="Clear location filter">
                <i className="bi bi-x-lg small"></i>
              </button>
            </span>
          </div>
        )}

        <div className="row g-2 g-lg-4">
          <div className="col-lg-3">
            <TagsSidebar
              categories={categories}
              activeCategory={category}
              onSelectCategory={(c) => { setParam('category', c); setMobileTagsOpen(false); }}
              onPostIssue={openPostModal}
              mobileOpen={mobileTagsOpen}
              showTags={showTagsSidebar}
            />
          </div>

          <div className="col-lg-9 col-xl-7">
            {/* Sized to this column on purpose — it's exactly as wide as the
                two-card grid below it (col-md-6 + col-md-6 + gutter), so the
                search bar tracks "two post cards side by side" at every
                breakpoint without any manual width math. Desktop only —
                mobile keeps the collapsed icon-toggle search above. */}
            {(showSearch || showLocationFilter) && (
              <form onSubmit={submitSearch} className="d-none d-md-flex gap-2 mb-3 flex-wrap feed-search-sticky">
                {showSearch && (
                  <div className="position-relative flex-grow-1" style={{ minWidth: 220 }}>
                    <button
                      type="submit"
                      aria-label="Search"
                      className="position-absolute top-50 translate-middle-y ms-3 text-muted border-0 bg-transparent p-0"
                      style={{ zIndex: 2 }}
                    >
                      <i className="bi bi-search"></i>
                    </button>
                    <input
                      className="form-control ps-5 rounded-pill"
                      placeholder="Search issues, categories, cities…"
                      value={searchInput}
                      onChange={e => setSearchInput(e.target.value)}
                    />
                  </div>
                )}
                {showLocationFilter && (
                  <GooglePlacesLocationSearch
                    value={location}
                    radiusKm={radiusKm}
                    onSelect={selectLocation}
                    onRadiusChange={(km) => setParam('radius', String(km))}
                    onClear={clearLocation}
                  />
                )}
              </form>
            )}

            <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
              <div className="filter-pill-group">
                {FILTERS.map(f => (
                  <button key={f.key} className={filter === f.key ? 'active' : ''} onClick={() => selectFilter(f.key)}>
                    {f.label}
                    {filter === f.key && !loading && (
                      <span className="badge rounded-pill ms-1" style={{ background: 'var(--grad-a)', color: '#fff' }}>{badgeCount}</span>
                    )}
                  </button>
                ))}
              </div>
              {status && (
                <span className="chip active">
                  Status: {status}
                  <button type="button" className="btn btn-link p-0 ms-1 text-decoration-none" style={{ lineHeight: 1, color: 'inherit' }}
                    onClick={() => setParam('status', '')} title="Clear status filter">
                    <i className="bi bi-x-lg small"></i>
                  </button>
                </span>
              )}
            </div>

            {loading ? (
              <div className="row g-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div className="col-md-6" key={i}><SkeletonCard /></div>
                ))}
              </div>
            ) : visibleIssues.length === 0 ? (
              <EmptyState icon="bi-inbox" title="No issues found" subtitle="Try a different filter or search term." />
            ) : (
              <>
                <div className="row g-2">
                  {visibleIssues.map(issue => (
                    <div className="col-md-6" key={issue._id}><IssueCard issue={issue} /></div>
                  ))}
                </div>
                {hasMore && (
                  <div ref={loadMoreRef} className="text-center mt-3 py-2">
                    {loadingMore && <span className="spinner-border spinner-border-sm text-muted" role="status" aria-label="Loading more issues"></span>}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="col-xl-2 d-none d-xl-block">
            <AdSidebar />
          </div>
        </div>
      </div>

      <PostIssueModal show={showModal} onClose={() => setShowModal(false)} onCreated={(issue) => { setIssues(list => [issue, ...list]); setTotal(t => t + 1); }} />
      {showFab && <FloatingActionButton onClick={openPostModal} />}
      {showScrollTop && <ScrollTopBottomButton />}
    </div>
  );
}
