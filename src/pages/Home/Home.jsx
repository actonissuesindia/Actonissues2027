import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import TopNav from '../../components/layout/TopNav';
import Footer from '../../components/layout/Footer';
import Avatar from '../../components/common/Avatar';
import StatusBadge from '../../components/common/StatusBadge';
import StatusStamp from '../../components/common/StatusStamp';
import IssuePlaceholder from '../../components/common/IssuePlaceholder';
import RotatingCarousel from '../../components/common/RotatingCarousel';
import Reveal from '../../components/common/Reveal';
import BlurImage from '../../components/common/BlurImage';
import RadialProgress from '../../components/common/RadialProgress';
import FloatingActionButton from '../../components/common/FloatingActionButton';
import TiltCard from '../../components/common/TiltCard';
import HotTopicsCarousel from '../../components/feed/HotTopicsCarousel';
import LatestIssuesCarousel from '../../components/feed/LatestIssuesCarousel';
import PostIssueModal from '../../components/create/PostIssueModal';
import AnnouncementBanner from '../../components/common/AnnouncementBanner';
import HeroHeadline from '../../components/common/HeroHeadline';
import timeAgo from '../../utils/timeAgo';
import { isVideoAttachment } from '../../utils/attachmentType';
import usePageBlocks from '../../hooks/usePageBlocks';
import useSectionPreview from '../../hooks/useSectionPreview';
import { renderBlockList } from '../../components/pageBuilder/BlockRenderer';
import SectionPreviewBadge from '../../components/pageBuilder/SectionPreviewBadge';

// Icons only here — title/text come from t() inside the component, since
// module-level code runs before any LanguageContext is available.
const STEP_ICONS = ['bi-geo-alt-fill', 'bi-heart-fill', 'bi-signpost-split-fill', 'bi-check-lg'];

const STAFF_ROLES = ['Admin', 'Authority'];

export default function Home() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const STEPS = [
    { icon: STEP_ICONS[0], title: t('home.step1Title'), text: t('home.step1Text') },
    { icon: STEP_ICONS[1], title: t('home.step2Title'), text: t('home.step2Text') },
    { icon: STEP_ICONS[2], title: t('home.step3Title'), text: t('home.step3Text') },
    { icon: STEP_ICONS[3], title: t('home.step4Title'), text: t('home.step4Text') }
  ];

  // Page Builder overrides — see scripts/seedPageBlocks/seedHome.js. Falls
  // back to this file's original hardcoded content when null/empty. The
  // hero's eyebrow/description/headline stay on their existing
  // SystemSetting/HeroQuote system (below) — not part of this feature.
  const howItWorksBlocks = usePageBlocks('home-how-it-works');
  const ctaBannerBlocks = usePageBlocks('home-cta-banner');
  // Live-data sections below can't have their content edited (it comes from
  // real issues/reporters, not static config) but can still be shown/hidden
  // and reordered relative to each other and to the two block-driven
  // sections above — see scripts/seedPageBlocks/seedHome.js.
  const homeLayoutBlocks = usePageBlocks('home-layout');

  const [stats, setStats] = useState(null);
  // Set when the count can't be fetched at all, so the hero drops that line
  // rather than claiming a number or waiting on one that isn't coming.
  const [statsUnavailable, setStatsUnavailable] = useState(false);
  const [categories, setCategories] = useState([]);
  const [feed, setFeed] = useState([]);
  const [reporters, setReporters] = useState([]);
  // null while the request is in flight, [] once the answer is "none" — the
  // two used to be the same value, so "No trending topics yet" was shown to
  // everyone for a moment before the trending posts appeared in its place.
  const [hotTopics, setHotTopics] = useState(null);
  const [showModal, setShowModal] = useState(false);
  // Super Admin-configurable hero section (Control Panel > Hero Quotes /
  // Settings). `heroQuotes` is null while loading (HeroHeadline treats that
  // the same as "none saved" and shows the default headline); the eyebrow/
  // description strings are '' when Super Admin hasn't set an override.
  const [heroQuotes, setHeroQuotes] = useState(null);
  const [heroEyebrow, setHeroEyebrow] = useState('');
  const [heroDescription, setHeroDescription] = useState('');

  // Page Builder's eye-preview button (PageBuilderPanel.jsx) links here with
  // ?preview=1 so a Super Admin can see the citizen-facing page without
  // being bounced to the control panel, and without the staff-only sections
  // (e.g. "Platform at a glance" below) taking the place of the ones they're
  // actually trying to look at (e.g. "Real impact" is hidden from staff).
  const { isPreview, previewTargetKey } = useSectionPreview([stats, feed, categories, hotTopics, reporters]);
  const effectiveIsStaff = !!(user && STAFF_ROLES.includes(user.role) && !isPreview);

  // The Super Admin (stored 'Admin') always has full access to every page
  // on the site, Home included — never bounced. Authority ("Admin" in the
  // UI) only sees the control panel instead, unless the Super Admin has
  // granted that individual account access (per-account checkbox in Admin
  // Dashboard > Users — User.canAccessHomeFeed, not a site-wide toggle).
  useEffect(() => {
    if (!isPreview && user && user.role === 'Authority' && !user.canAccessHomeFeed) {
      navigate('/author', { replace: true });
    }
  }, [user, navigate, isPreview]);

  useEffect(() => {
    // Each of these has to end in a definite state, success or failure —
    // "still waiting" is now drawn as a placeholder, so a request that fails
    // silently would leave that placeholder shimmering forever.
    api.get('/issues/stats').then(res => setStats(res.data.stats)).catch(() => setStatsUnavailable(true));
    api.get('/issues/category-counts').then(res => setCategories(res.data.categories)).catch(() => {});
    api.get('/issues/top-reporters').then(res => setReporters(res.data.reporters)).catch(() => {});
    // An empty list on failure, so the panel settles on "nothing trending"
    // rather than waiting on a request that already gave up.
    api.get('/issues/featured').then(res => setHotTopics(res.data.issues)).catch(() => setHotTopics([]));
    // Fetches a bigger pool than the old 3-card grid did — the portrait
    // carousel's sliding window needs enough slides on either side of the
    // active one to look right (it was designed around a 12-item list).
    // Asks the server for exactly that many via `limit` rather than fetching
    // every approved issue and slicing client-side — that used to mean this
    // one carousel pulled down the entire, ever-growing issues collection.
    api.get('/issues', { params: { limit: 12 } }).then(res => setFeed(res.data.issues)).catch(() => {});
    api.get('/hero-quotes').then(res => {
      setHeroQuotes(res.data.quotes || []);
      setHeroEyebrow(res.data.eyebrowText || '');
      setHeroDescription(res.data.descriptionText || '');
    }).catch(() => setHeroQuotes([]));
  }, []);

  // React Router's client-side navigation doesn't trigger the browser's
  // native #hash scroll (that only happens on a real page load) — so
  // "Top Voices" links elsewhere in the app (e.g. TopNav's /#top-voices)
  // would land on Home without ever scrolling down. Also waits on
  // `reporters` since that section doesn't render at all until the data
  // arrives, so scrolling to it immediately on navigation would be a
  // no-op if the element doesn't exist yet.
  useEffect(() => {
    if (location.hash === '#top-voices' && reporters.length > 0) {
      document.getElementById('top-voices')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location.hash, reporters]);

  const handlePostIssue = () => {
    if (user) setShowModal(true);
    else navigate('/login');
  };

  const resolutionRate = stats && stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;

  return (
    <div>
      <TopNav onPostIssue={user ? () => setShowModal(true) : undefined} />
      <AnnouncementBanner />

      {/* Hero */}
      <section className="hero-section">
        <div className="container-fluid px-4 px-lg-5">
          <div className="row g-5 align-items-center">
            <div className="col-lg-6">
              {/* The eyebrow arrives in the same response as the headline
                  quotes, so heroQuotes === null is the signal that neither is
                  known yet — without this the built-in line showed first and
                  was swapped out a moment later, alongside the headline. */}
              <div className="eyebrow mb-3" style={heroQuotes === null ? { visibility: 'hidden' } : undefined}>
                {heroQuotes === null ? ' ' : (heroEyebrow || t('home.heroEyebrowDefault'))}
              </div>
              <HeroHeadline quotes={heroQuotes} />
              <p className="text-muted mb-4" style={{ maxWidth: 480 }}>
                {heroDescription || t('home.heroDescriptionDefault')}
              </p>
              <div className="d-flex flex-wrap gap-3 mb-4">
                <button className="btn btn-gradient d-inline-flex align-items-center gap-2" onClick={handlePostIssue}>
                  <i className="bi bi-camera-fill"></i>{t('home.raiseIssue')}
                </button>
                <Link to="/feed" className="btn btn-pill-outline">{t('home.browseIssues')}</Link>
              </div>
              <div className="d-flex align-items-center gap-3">
                <div className="avatar-stack">
                  {reporters.slice(0, 4).map(r => <Avatar key={r.userId} name={r.name} size="sm" />)}
                </div>
                {/* "0 issues reported" is a claim about the site, and it was
                    being made confidently for the second or so before the
                    real count arrived — on a site with 114 reports. Nothing
                    is asserted until the number is known; the shimmer holds
                    the space so the line doesn't jump when it lands. */}
                <span className="small">
                  {stats && <><strong>{stats.total}</strong> <span className="text-muted">{t('home.issuesReportedCounting')}</span></>}
                  {!stats && !statsUnavailable && (
                    <span className="skeleton-shimmer d-inline-block rounded" style={{ width: 190, height: 18, verticalAlign: 'middle' }} />
                  )}
                </span>
              </div>
            </div>

            <div className="col-lg-6">
              {hotTopics === null ? (
                <div className="card p-4 skeleton-shimmer" style={{ minHeight: 420 }} aria-hidden="true" />
              ) : hotTopics.length === 0 ? (
                <div className="card p-4 text-center text-muted">
                  {t('home.noTrendingTopics')}
                </div>
              ) : (
                <RotatingCarousel
                  items={hotTopics}
                  itemKey={issue => issue._id}
                  renderItem={(issue, isActive) => (
                    <div className={`card stamped-card p-3 ${isActive ? '' : 'pe-none'}`}>
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div className="d-flex align-items-center gap-2">
                          <Avatar name={issue.reporter?.name} size="md" />
                          <div>
                            <div className="fw-semibold">{issue.reporter?.name || t('home.member')}</div>
                            <div className="text-muted small">{timeAgo(issue.createdAt)}</div>
                          </div>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <span className="badge-solid-gradient"><i className="bi bi-fire me-1"></i>{t('home.trending')}</span>
                          <StatusBadge status={issue.status} />
                        </div>
                      </div>
                      <Link to={`/issues/${issue._id}`} className="hashtag d-block mb-2">#{issue.category}</Link>
                      <p className="issue-desc">{issue.description}</p>
                      <div className="issue-media mb-2">
                        <StatusStamp status={issue.status} />
                        {issue.attachments?.[0]?.url
                          ? (isVideoAttachment(issue.attachments[0])
                            ? (
                              <>
                                <video src={issue.attachments[0].url} className="w-100 h-100" style={{ objectFit: 'contain', background: '#eee' }} preload="metadata" muted playsInline />
                                <i className="bi bi-play-circle-fill position-absolute top-50 start-50 translate-middle text-white" style={{ fontSize: '2rem', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}></i>
                              </>
                            )
                            : <BlurImage src={issue.attachments[0].url} alt="" />)
                          : <IssuePlaceholder category={issue.category} />}
                      </div>
                      <div className="d-flex align-items-center gap-3 pt-1">
                        <span className="text-danger small fw-semibold"><i className="bi bi-heart-fill me-1"></i>{issue.supportCount ?? 0} {t('home.support')}</span>
                        <Link to={`/issues/${issue._id}`} className="text-muted small"><i className="bi bi-chat-left-text me-1"></i>{t('home.comments')}</Link>
                      </div>
                    </div>
                  )}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Staff insights — internal metrics, visible to Admin/Authority only
          (hidden during a Page Builder preview, since the whole point is to
          see the citizen-facing "Real impact" section in its place). */}
      {stats && effectiveIsStaff && (
      <Reveal>
        <section className="stats-strip">
          <div className="container-fluid px-4 px-lg-5">
            <div className="eyebrow mb-2"><i className="bi bi-graph-up me-1"></i>Staff insights</div>
            <h2 className="display-heading fs-2 mb-4">Platform at a glance</h2>
            <div className="row g-3">
              {[
                { label: 'Reports', value: stats.total, icon: 'bi-collection', color: 'text-primary', to: '/feed' },
                { label: 'Open', value: stats.open, icon: 'bi-exclamation-circle', color: 'text-warning', to: '/feed?status=Open' },
                { label: 'In Progress', value: stats.inProgress, icon: 'bi-hourglass-split', color: 'text-info', to: '/feed?status=In%20Progress' },
                { label: 'Resolved', value: stats.resolved, icon: 'bi-check-circle', color: 'text-success', to: '/feed?status=Resolved' },
                // "Acknowledged" is what the stored 'Escalated' status is
                // called everywhere a citizen or staff member sees it (see
                // StatusBadge's DISPLAY_LABELS) — the filter link still has to
                // use the stored name. This was a resolution-rate percentage,
                // but the same number is already one card along as Resolved
                // over Reports, and it left the one status this row didn't
                // account for missing entirely.
                { label: 'Acknowledged', value: stats.escalated, icon: 'bi-send-check-fill', style: { color: 'var(--badge-escalated-text)' }, to: '/feed?status=Escalated' },
                { label: 'Categories tracked', value: categories.length, icon: 'bi-tags-fill', color: 'text-secondary', to: '/feed' }
              ].map(s => (
                <div className="col-6 col-lg-2" key={s.label}>
                  <TiltCard as={Link} to={s.to} className="card stat-card d-block p-3 h-100 text-decoration-none text-reset">
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <div className="text-muted small">{s.label}</div>
                        <div className="fs-3 fw-bold">{s.value}</div>
                      </div>
                      <i className={`bi ${s.icon} fs-2 ${s.color || ''}`} style={s.style}></i>
                    </div>
                  </TiltCard>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>
      )}

      {(() => {
        // Default order matches this page's original fixed layout exactly —
        // used until the Super Admin ever touches Page Builder's "Section
        // order" region for Home (or if that fetch fails), same defensive
        // fallback pattern as every other migrated region.
        const DEFAULT_LAYOUT_ORDER = ['realImpact', 'latestIssues', 'trendingChips', 'hotTopicsCarousel', 'topVoices', 'howItWorks', 'ctaBanner'];
        const layoutOrder = homeLayoutBlocks === null || homeLayoutBlocks.length === 0
          ? DEFAULT_LAYOUT_ORDER
          : homeLayoutBlocks.filter(b => b.visible).map(b => b.config.key);

        const SECTIONS = {
          // Public impact counter — the trust/social-proof signal every
          // visitor sees (not just logged-in staff), reusing the same
          // stat-card/TiltCard/RadialProgress treatment as the staff-only
          // insights strip above (that one stays out of Page Builder — it's
          // never shown to citizens, so it's not part of the public layout).
          realImpact: stats && !effectiveIsStaff && (
            <Reveal key="realImpact">
              <section className="stats-strip">
                <div className="container-fluid px-4 px-lg-5">
                  <div className="eyebrow mb-2"><i className="bi bi-graph-up me-1"></i>{t('home.realImpact')}</div>
                  <h2 className="display-heading fs-2 mb-4">{t('home.civicIssuesFixed')}</h2>
                  <div className="row g-3">
                    {[
                      { label: t('home.issuesReported'), value: stats.total, icon: 'bi-collection', color: 'text-primary', to: '/feed' },
                      { label: t('home.resolved'), value: stats.resolved, icon: 'bi-check-circle', color: 'text-success', to: '/feed?status=Resolved' },
                      { label: t('home.escalatedToAuthorities'), value: stats.escalated, icon: 'bi-send-fill', color: 'text-info', to: '/feed?status=Escalated' },
                      { label: t('home.resolutionRate'), value: `${resolutionRate}%`, radial: true, to: '/feed?status=Resolved' }
                    ].map(s => (
                      <div className="col-6 col-lg-3" key={s.label}>
                        <TiltCard as={Link} to={s.to} className="card stat-card d-block p-3 h-100 text-decoration-none text-reset">
                          <div className="d-flex align-items-center justify-content-between">
                            <div>
                              <div className="text-muted small">{s.label}</div>
                              <div className="fs-3 fw-bold">{s.value}</div>
                            </div>
                            {s.radial ? <RadialProgress percent={resolutionRate} size={48} stroke={5} /> : <i className={`bi ${s.icon} fs-2 ${s.color}`}></i>}
                          </div>
                        </TiltCard>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </Reveal>
          ),
          latestIssues: feed.length > 0 && (
            <Reveal key="latestIssues">
              <section className="py-4 py-lg-5">
                <div className="container-fluid px-4 px-lg-5">
                  <div className="d-flex justify-content-between align-items-end mb-3 flex-wrap gap-2">
                    <div>
                      <div className="eyebrow mb-2">{t('home.latestIssues')}</div>
                      <h2 className="display-heading fs-2">{t('home.whatPeoplePosting')}</h2>
                    </div>
                    <Link to="/feed" className="btn btn-pill-outline">{t('home.seeAllIssues')} <i className="bi bi-arrow-right ms-1"></i></Link>
                  </div>
                  <LatestIssuesCarousel issues={feed} />
                </div>
              </section>
            </Reveal>
          ),
          trendingChips: categories.length > 0 && (
            <Reveal key="trendingChips">
              <section className="py-4 py-lg-5">
                <div className="container-fluid px-4 px-lg-5">
                  <div className="eyebrow mb-2"><i className="bi bi-fire me-1"></i>{t('home.trendingInCity')}</div>
                  <div className="d-flex flex-wrap gap-2">
                    {categories.map(c => (
                      <button key={c.category} className="chip chip-embossed" onClick={() => navigate(`/feed?category=${encodeURIComponent(c.category)}`)}>
                        #{c.category} <span className="count">{c.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </Reveal>
          ),
          hotTopicsCarousel: <Reveal key="hotTopicsCarousel"><HotTopicsCarousel issues={hotTopics} /></Reveal>,
          topVoices: reporters.length > 0 && (
            <Reveal key="topVoices">
              <section className="py-4 py-lg-5 border-top" id="top-voices">
                <div className="container-fluid px-4 px-lg-5">
                  <div className="eyebrow mb-2">{t('home.mostActive')}</div>
                  <h2 className="display-heading fs-2 mb-4">{t('home.topVoicesInCity')}</h2>
                  <div className="row g-3">
                    {reporters.map(r => (
                      <div className="col-6 col-md-3 col-lg-2" key={r.userId}>
                        <TiltCard as={Link} to={`/reporters/${r.userId}`} className="card card-embossed rotating-glow p-3 text-center h-100 text-decoration-none text-reset">
                          <Avatar src={r.avatar} name={r.name} size="lg" />
                          <div className="fw-semibold mt-2">{r.name}</div>
                          <div className="text-muted small">{r.count} {t('home.reports')}</div>
                        </TiltCard>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </Reveal>
          ),
          howItWorks: (
            <Reveal key="howItWorks">
              <section className="py-4 py-lg-5 border-top">
                <div className="container-fluid px-4 px-lg-5">
                  {howItWorksBlocks === null || howItWorksBlocks.length === 0 ? (
                    <>
                      <div className="eyebrow mb-2">{t('home.howItWorks')}</div>
                      <h2 className="display-heading fs-2 mb-4">{t('home.fourSteps')}</h2>
                      <div className="row g-3">
                        {STEPS.map(s => (
                          <div className="col-md-3" key={s.title}>
                            <TiltCard className="card card-embossed rotating-glow p-3 h-100">
                              <span className="step-icon mb-3"><i className={`bi ${s.icon}`}></i></span>
                              <div className="fw-bold mb-1">{s.title}</div>
                              <div className="text-muted small">{s.text}</div>
                            </TiltCard>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : renderBlockList(howItWorksBlocks)}
                </div>
              </section>
            </Reveal>
          ),
          ctaBanner: (
            <Reveal key="ctaBanner">
              <section className="container-fluid px-4 px-lg-5 py-4 py-lg-5">
                <div className="cta-banner text-center">
                  {ctaBannerBlocks === null || ctaBannerBlocks.length === 0 ? (
                    <>
                      <h2 className="display-heading fs-1 mb-3">{t('home.beHeard')}</h2>
                      <p className="mb-4" style={{ opacity: 0.9 }}>
                        {t('home.joinCitizens')}
                      </p>
                    </>
                  ) : renderBlockList(ctaBannerBlocks)}
                  {/* This button's destination depends on live login state
                      (Go to Issues vs Create your account) — not expressible
                      as static block config, so it stays hardcoded here
                      rather than becoming a Button block, same as the
                      equivalent CTA banners on About/Founder's Message. */}
                  {user ? (
                    <Link to="/feed" className="btn btn-light fw-bold rounded-pill px-4 py-2" style={{ color: 'var(--grad-a)' }}>{t('home.goToIssues')}</Link>
                  ) : (
                    <Link to="/register" className="btn btn-light fw-bold rounded-pill px-4 py-2" style={{ color: 'var(--grad-a)' }}>{t('foundersMessage.createAccount')}</Link>
                  )}
                </div>
              </section>
            </Reveal>
          )
        };

        return layoutOrder.map(key => SECTIONS[key] ? (
          <div key={key} id={`section-${key}`} className={previewTargetKey === key ? 'section-preview-outline' : undefined}>
            <SectionPreviewBadge active={previewTargetKey === key} />
            {SECTIONS[key]}
          </div>
        ) : null);
      })()}

      {/* Fixed, not part of the admin-reorderable SECTIONS/layoutOrder system
          above — always renders regardless of what the Super Admin has
          customized in Page Builder's Home "Section order", same reasoning
          as why this wasn't just added as another layoutOrder key: doing so
          would silently stop rendering the moment an Admin saves a custom
          section order that doesn't happen to include it. */}
      <Reveal>
        <section className="py-4 py-lg-5 border-top">
          <div className="container-fluid px-4 px-lg-5">
            <TiltCard className="card card-embossed rotating-glow p-4 p-lg-5">
              <div className="row align-items-center g-4">
                <div className="col-lg-8">
                  <div className="eyebrow mb-2"><i className="bi bi-file-earmark-text me-1"></i>Legal Advice</div>
                  <h2 className="display-heading fs-2 mb-2">Need help with a legal matter?</h2>
                  <p className="text-muted mb-0">
                    General guidance on criminal cases, civil cases, property registration, RTI requests, land
                    disputes, and mortgage/sale issues — plus a directory of lawyers you can request help from
                    directly.
                  </p>
                </div>
                <div className="col-lg-4 d-flex flex-column flex-sm-row flex-lg-column gap-2">
                  <Link to="/p/legal-help" className="btn btn-gradient w-100">Browse Legal Advice</Link>
                  <Link to="/find-a-lawyer" className="btn btn-pill-outline w-100">Find a Lawyer</Link>
                </div>
              </div>
            </TiltCard>
          </div>
        </section>
      </Reveal>

      <Footer />

      <PostIssueModal show={showModal} onClose={() => setShowModal(false)} onCreated={() => navigate('/feed')} />
      <FloatingActionButton onClick={handlePostIssue} />
    </div>
  );
}
