import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import Avatar from '../common/Avatar';
import LanguageSwitcher from '../common/LanguageSwitcher';
import api from '../../services/api';
import usePushNotifications from '../../hooks/usePushNotifications';
import useLogoOverrides from '../../hooks/useLogoOverrides';
import usePageBlocks from '../../hooks/usePageBlocks';
import useGamesEnabled from '../../hooks/useGamesEnabled';
import NavLinks from './NavLinks';
import { withoutRetiredLinks } from '../../utils/retiredLinks';
import logoIcon from '../../assets/logo/aoi-icon-mark.png';

// Fallback when nothing's seeded yet / Page Builder is empty — reproduces
// today's fixed desktop nav-pill row exactly.
const DEFAULT_NAV_LINKS = [
  { _id: 'default-issues', config: { label: 'Issues', href: '/feed' } },
  { _id: 'default-trending', config: { label: 'Trending', href: '/feed?filter=hot' } },
  { _id: 'default-top-voices', config: { label: 'Top Voices', href: '/#top-voices' } },
  { _id: 'default-articles', config: { label: 'Related Topics', href: '/articles' } },
  { _id: 'default-games', config: { label: 'Games', href: '/games', requiresAuth: true } },
  { _id: 'default-about', config: { label: 'About', href: '/about' } }
];

const STAFF_ROLES = ['Admin', 'Authority'];

export default function TopNav({ onPostIssue }) {
  const { user, logout, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const push = usePushNotifications(user);
  const { header: headerLogoOverride } = useLogoOverrides();
  const navLinkBlocks = usePageBlocks('topnav-links');
  const gamesEnabled = useGamesEnabled();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [notifFlyoutPos, setNotifFlyoutPos] = useState(null);
  const menuRef = useRef(null);
  const notifRef = useRef(null);
  const notifFlyoutRef = useRef(null);
  const notifRowRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
      const insideDesktopBell = notifRef.current && notifRef.current.contains(e.target);
      const insideMobileFlyout = notifFlyoutRef.current && notifFlyoutRef.current.contains(e.target);
      if (!insideDesktopBell && !insideMobileFlyout) setNotifOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        setScrolled(window.scrollY > 24);
        raf = null;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    api.get('/notifications').then(res => setUnread(res.data.unread || 0)).catch(() => {});
  }, [user]);

  const fetchNotifications = () => {
    api.get('/notifications').then(res => {
      setNotifications(res.data.notifications || []);
      setUnread(res.data.unread || 0);
    }).catch(() => {});
  };

  const toggleNotifications = () => {
    const opening = !notifOpen;
    setNotifOpen(opening);
    setOpen(false);
    setMobileMenuOpen(false);
    if (opening) fetchNotifications();
  };

  // On mobile there's no separate bell button (see render below) — opening
  // the profile menu doubles as opening notifications, so it needs the same fetch.
  const toggleProfileMenu = () => {
    const opening = !open;
    setOpen(opening);
    setNotifOpen(false);
    setMobileMenuOpen(false);
    if (opening) fetchNotifications();
  };

  const FLYOUT_WIDTH = 300;
  const toggleNotifFlyout = (e) => {
    e.stopPropagation();
    const opening = !notifOpen;
    setNotifOpen(opening);
    if (!opening) return;
    fetchNotifications();
    // Computed in JS (not pure CSS) so it can flip sides and clamp within
    // the viewport — a fixed "open to the left" rule ran off-screen on
    // narrow phones where there's no room to the row's left.
    const rect = notifRowRef.current.getBoundingClientRect();
    const margin = 8;
    let left = rect.left - FLYOUT_WIDTH - margin;
    if (left < margin) left = rect.right + margin;
    left = Math.max(margin, Math.min(left, window.innerWidth - FLYOUT_WIDTH - margin));
    const top = Math.max(margin, Math.min(rect.top, window.innerHeight - margin - 100));
    setNotifFlyoutPos({ top, left });
  };

  const openNotification = async (n) => {
    if (!n.read) {
      try {
        await api.post(`/notifications/${n._id}/read`);
        setNotifications(list => list.map(x => x._id === n._id ? { ...x, read: true } : x));
        setUnread(u => Math.max(0, u - 1));
      } catch { /* ignore */ }
    }
    setNotifOpen(false);
    if (n.link) navigate(n.link);
  };

  const markAllNotificationsRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications(list => list.map(n => ({ ...n, read: true })));
      setUnread(0);
    } catch { /* ignore */ }
  };

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/');
  };

  const isStaff = user && STAFF_ROLES.includes(user.role);
  // The Super Admin (stored 'Admin') always has full Home/Feed access, like
  // any citizen — logo/nav point at '/'. Authority ("Admin" in the UI) only
  // gets that once the Super Admin has granted that individual account
  // access (per-account checkbox in Admin Dashboard > Users) — otherwise
  // its logo/nav point at its own control panel instead.
  const homeFeedAccessible = !isStaff || user.role === 'Admin' || (user.role === 'Authority' && user.canAccessHomeFeed);
  const homeLink = homeFeedAccessible ? '/' : '/author';
  // Separate from homeLink above — the "Control Panel" menu item always
  // goes to the actual dashboard regardless of Home/Feed access, unlike the
  // logo (which follows homeFeedAccessible so a Super Admin's logo click
  // behaves like any citizen's).
  const controlPanelLink = isStaff ? (user.role === 'Admin' ? '/admin' : '/author') : '/';

  // Shared between the desktop bell dropdown and the mobile profile dropdown
  // (mobile folds notifications into the profile menu instead of a separate icon).
  const notificationsPanel = (
    <>
      <div className="d-flex align-items-center justify-content-between gap-2 px-3 py-1">
        <div className="d-flex align-items-center gap-2">
          <span className="fw-semibold small">{t('topNav.notifications')}</span>
          {unread > 0 && (
            <button className="btn btn-link btn-sm p-0 text-decoration-none" onClick={markAllNotificationsRead}>
              {t('topNav.markAllRead')}
            </button>
          )}
        </div>
        <button
          type="button"
          className="btn-close btn-close-sm"
          style={{ fontSize: '0.65rem' }}
          aria-label={t('topNav.closeNotifications')}
          onClick={() => setNotifOpen(false)}
        ></button>
      </div>
      {push.supported && push.permission !== 'denied' && (
        <button
          type="button"
          className="btn btn-link btn-sm text-decoration-none d-flex align-items-center gap-2 px-3 py-2 w-100 text-start"
          disabled={push.busy}
          onClick={() => (push.subscribed ? push.disable() : push.enable())}
        >
          <i className={`bi ${push.subscribed ? 'bi-bell-fill text-primary' : 'bi-bell'}`}></i>
          <span className="flex-grow-1">{push.subscribed ? t('topNav.pushOn') : t('topNav.turnOnPush')}</span>
          {push.subscribed && <span className="badge bg-light text-muted fw-normal">{t('topNav.turnOff')}</span>}
        </button>
      )}
      {push.permission === 'denied' && (
        <div className="px-3 py-1 small text-muted">
          {t('topNav.pushBlocked')}
        </div>
      )}
      {notifications.length === 0 && (
        <div className="px-3 py-3 text-muted small text-center">{t('topNav.noNotifications')}</div>
      )}
      {notifications.map(n => (
        <button
          key={n._id}
          type="button"
          className={`notif-item d-flex align-items-start gap-2 w-100 text-start px-3 py-2 ${n.read ? 'notif-item-read' : 'notif-item-unread'}`}
          onClick={() => openNotification(n)}
        >
          <span className={`notif-dot mt-1 flex-shrink-0 ${n.read ? 'notif-dot-read' : 'notif-dot-unread'}`}></span>
          <span className="flex-grow-1 min-w-0">
            <span className={`d-block small ${n.read ? 'notif-text-read' : 'fw-semibold text-dark'}`}>{n.title}</span>
            {n.message && <span className={`d-block small ${n.read ? 'notif-text-read' : 'text-muted'}`}>{n.message}</span>}
          </span>
        </button>
      ))}
    </>
  );

  return (
    <nav className={`site-navbar ${scrolled ? 'site-navbar-scrolled' : ''}`}>
      <div className="container-fluid d-flex flex-nowrap align-items-center gap-3">
        <div className="d-flex flex-nowrap align-items-center gap-3 flex-shrink-0">
          <Link to={homeLink} className="d-flex align-items-center gap-2 flex-shrink-0 text-decoration-none">
            <span className="brand-mark-glow">
              <img src={headerLogoOverride || logoIcon} alt="" className="brand-mark-img" />
              <span className="brand-mark-divider"></span>
              <span className="brand-wordmark">ACT <span className="brand-wordmark-accent">ON</span> ISSUES</span>
            </span>
          </Link>
        </div>

        {homeFeedAccessible && (
          <div className="d-none d-md-flex align-items-center gap-1 mx-auto nav-links-row">
            {/* null means the configured links haven't arrived yet, which is
                not the same as there being none. Treating the two alike drew
                the built-in list first and replaced it a moment later, so the
                menu visibly changed under the reader — "Top Voices" becoming
                "Founder" and "Legal Advise" while they were looking at it.
                Nothing is drawn until the answer is known; the built-in list
                is still the fallback once we know none are configured. */}
            {/* withoutRetiredLinks drops menu items pointing at pages that no
                longer exist — the stored rows outlive the page, so a link an
                admin saved once keeps showing until somebody runs the cleanup
                script against production. See src/utils/retiredLinks.js. */}
            {navLinkBlocks !== null && (
              <NavLinks links={withoutRetiredLinks(navLinkBlocks.length === 0 ? DEFAULT_NAV_LINKS : navLinkBlocks).filter(l => gamesEnabled || l.config.href !== '/games')} user={user} />
            )}
          </div>
        )}

        <div className="ms-auto d-flex align-items-center gap-2 flex-shrink-0">
          <LanguageSwitcher />
          {/* Same reasoning for who's signed in: until the session has been
              checked, `user` is null for a signed-in visitor too, so drawing
              the signed-out buttons here flashed "Log in / Get started" at
              someone who was already logged in. */}
          {!authLoading && !user && (
            <div className="d-none d-md-flex align-items-center gap-2">
              <Link to="/login" className="btn btn-pill-outline btn-nav-auth flex-shrink-0 text-nowrap">{t('topNav.logIn')}</Link>
              <Link to="/register" className="btn btn-gradient btn-nav-auth flex-shrink-0 text-nowrap">
                <span className="d-none d-sm-inline">{t('topNav.getStarted')}</span>
                <span className="d-sm-none">{t('topNav.join')}</span>
              </Link>
            </div>
          )}

          {user && (
            <>
              {onPostIssue && !isStaff && (
                <button data-tour="raise-issue" className="btn btn-gradient d-none d-sm-inline-flex align-items-center gap-1 flex-shrink-0 text-nowrap" onClick={onPostIssue}>
                  <i className="bi bi-plus-lg"></i>{t('topNav.raiseIssue')}
                </button>
              )}
              <div className="position-relative flex-shrink-0 d-none d-md-block" ref={notifRef}>
                <button className="btn btn-pill-ghost position-relative" title="Notifications" onClick={toggleNotifications}>
                  <i className="bi bi-bell fs-6"></i>
                  {unread > 0 && (
                    <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '0.6rem' }}>
                      {unread}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="position-absolute end-0 mt-2 bg-white border rounded-4 shadow-sm py-2" style={{ width: 320, maxWidth: 'calc(100vw - 2rem)', maxHeight: 400, overflowY: 'auto', zIndex: 50 }}>
                    {notificationsPanel}
                  </div>
                )}
              </div>
              <div className="position-relative flex-shrink-0" ref={menuRef}>
                <button
                  data-tour="profile-menu"
                  className="btn btn-pill-ghost d-flex align-items-center gap-2 text-nowrap"
                  onClick={toggleProfileMenu}
                >
                  <span className="position-relative d-inline-flex">
                    <Avatar name={user.name} src={user.avatar} size="sm" />
                    {unread > 0 && (
                      <span
                        className="d-md-none position-absolute top-0 start-100 translate-middle bg-danger border border-2 border-white rounded-circle"
                        style={{ width: 10, height: 10 }}
                      ></span>
                    )}
                  </span>
                  <span className="d-none d-md-inline fw-semibold text-dark">{user.name}</span>
                  <i className="bi bi-chevron-down small"></i>
                </button>
                {open && (
                  <div className="position-absolute end-0 mt-2 bg-white border rounded-4 shadow-sm py-2" style={{ minWidth: 220, maxWidth: 'calc(100vw - 2rem)', maxHeight: '80vh', overflowY: 'auto', zIndex: 50 }}>
                    <div className="d-md-none" ref={notifFlyoutRef}>
                      <button
                        type="button"
                        ref={notifRowRef}
                        className="dropdown-item-custom d-flex align-items-center w-100 text-start px-3 py-2 border-0 bg-transparent text-dark"
                        onClick={toggleNotifFlyout}
                      >
                        <i className="bi bi-bell me-2"></i>
                        <span className="flex-grow-1">{t('topNav.notifications')}</span>
                        {unread > 0 && <span className="badge rounded-pill bg-danger">{unread}</span>}
                        <i className="bi bi-chevron-right small ms-2"></i>
                      </button>
                      {notifOpen && notifFlyoutPos && (
                        <div
                          className="position-fixed bg-white border rounded-4 shadow-sm py-2"
                          style={{ top: notifFlyoutPos.top, left: notifFlyoutPos.left, width: 300, maxWidth: 'calc(100vw - 16px)', maxHeight: 400, overflowY: 'auto', zIndex: 1060 }}
                        >
                          {notificationsPanel}
                        </div>
                      )}
                    </div>
                    <hr className="my-1" />
                    {!isStaff && (
                      <div className="d-md-none">
                        <NavLink to="/feed" onClick={() => setOpen(false)}
                          className={({ isActive }) => 'dropdown-item-custom d-block px-3 py-2 text-decoration-none text-dark' + (isActive ? ' fw-semibold' : '')}>
                          <i className="bi bi-collection me-2"></i>{t('topNav.issues')}
                        </NavLink>
                        <Link to="/feed?filter=hot" onClick={() => setOpen(false)} className="dropdown-item-custom d-block px-3 py-2 text-decoration-none text-dark">
                          <i className="bi bi-fire me-2"></i>{t('topNav.trending')}
                        </Link>
                        <Link to="/#top-voices" onClick={() => setOpen(false)} className="dropdown-item-custom d-block px-3 py-2 text-decoration-none text-dark">
                          <i className="bi bi-star me-2"></i>{t('topNav.topVoices')}
                        </Link>
                        {gamesEnabled && (
                          <NavLink to="/games" onClick={() => setOpen(false)}
                            className={({ isActive }) => 'dropdown-item-custom d-block px-3 py-2 text-decoration-none text-dark' + (isActive ? ' fw-semibold' : '')}>
                            <i className="bi bi-controller me-2"></i>{t('topNav.games')}
                          </NavLink>
                        )}
                        <hr className="my-1" />
                      </div>
                    )}
                    <Link to="/profile" className="dropdown-item-custom d-block px-3 py-2 text-decoration-none text-dark" onClick={() => setOpen(false)}>
                      <i className="bi bi-gear me-2"></i>{t('topNav.profileSettings')}
                    </Link>
                    {!isStaff && (
                      <Link to="/my-issues" className="dropdown-item-custom d-block px-3 py-2 text-decoration-none text-dark" onClick={() => setOpen(false)}>
                        <i className="bi bi-list-check me-2"></i>{t('topNav.myIssues')}
                      </Link>
                    )}
                    {!isStaff && (
                      <Link to="/rti/mine" className="dropdown-item-custom d-block px-3 py-2 text-decoration-none text-dark" onClick={() => setOpen(false)}>
                        <i className="bi bi-file-earmark-text me-2"></i>{t('topNav.myLegalRequests')}
                      </Link>
                    )}
                    {isStaff && (
                      <Link to={controlPanelLink} className="dropdown-item-custom d-block px-3 py-2 text-decoration-none text-dark" onClick={() => setOpen(false)}>
                        <i className="bi bi-shield-lock me-2"></i>{t('topNav.controlPanel')}
                      </Link>
                    )}
                    <hr className="my-1" />
                    <Link to="/about" className="dropdown-item-custom d-block px-3 py-2 text-decoration-none text-dark" onClick={() => setOpen(false)}>
                      <i className="bi bi-info-circle me-2"></i>{t('topNav.about')}
                    </Link>
                    <Link to="/p/legal-help" className="dropdown-item-custom d-block px-3 py-2 text-decoration-none text-dark" onClick={() => setOpen(false)}>
                      <i className="bi bi-file-earmark-text me-2"></i>{t('topNav.legalHelp')}
                    </Link>
                    <hr className="my-1" />
                    <button className="dropdown-item-custom d-block w-100 text-start px-3 py-2 border-0 bg-transparent text-danger" onClick={handleLogout}>
                      <i className="bi bi-box-arrow-right me-2"></i>{t('topNav.logout')}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Logged-in mobile users get nav links folded into the profile
              dropdown above instead — this hamburger is only needed when
              there's no profile avatar to fold it into. */}
          {!isStaff && !authLoading && !user && (
            <button
              type="button"
              className="btn btn-pill-ghost d-md-none p-2"
              aria-label={t('topNav.toggleMenu')}
              aria-expanded={mobileMenuOpen}
              onClick={() => { setMobileMenuOpen(o => !o); setNotifOpen(false); setOpen(false); }}
            >
              <i className={`bi ${mobileMenuOpen ? 'bi-x-lg' : 'bi-list'} fs-5`}></i>
            </button>
          )}
        </div>
      </div>

      {/* Mobile-only, always-visible Log In / Get Started row — the desktop
          pair above is d-none d-md-flex, so without this a logged-out
          mobile visitor had no visible way in except opening the hamburger
          menu first. */}
      {!isStaff && !authLoading && !user && (
        <div className="d-flex d-md-none gap-2 px-3 pb-2">
          <Link to="/login" className="btn btn-pill-outline flex-fill text-nowrap">{t('topNav.logIn')}</Link>
          <Link to="/register" className="btn btn-gradient flex-fill text-nowrap">{t('topNav.getStarted')}</Link>
        </div>
      )}

      {/* Logged-in users get these links inside the profile dropdown instead
          (see above) — this panel is only reachable while logged out. */}
      {!isStaff && !authLoading && !user && mobileMenuOpen && (
        <div className="mobile-nav-panel d-md-none px-3 pb-3 pt-1">
          <div className="d-flex flex-column gap-1">
            <NavLink to="/feed" onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => 'mobile-nav-link' + (isActive ? ' active' : '')}>
              <i className="bi bi-collection"></i>{t('topNav.issues')}
            </NavLink>
            <NavLink to="/feed?filter=hot" onClick={() => setMobileMenuOpen(false)} className="mobile-nav-link">
              <i className="bi bi-fire"></i>{t('topNav.trending')}
            </NavLink>
            <Link to="/#top-voices" onClick={() => setMobileMenuOpen(false)} className="mobile-nav-link">
              <i className="bi bi-star"></i>{t('topNav.topVoices')}
            </Link>
            <NavLink to="/about" onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => 'mobile-nav-link' + (isActive ? ' active' : '')}>
              <i className="bi bi-info-circle"></i>{t('topNav.about')}
            </NavLink>
            <NavLink to="/p/legal-help" onClick={() => setMobileMenuOpen(false)} className="mobile-nav-link">
              <i className="bi bi-file-earmark-text"></i>{t('topNav.legalHelp')}
            </NavLink>
          </div>
        </div>
      )}
    </nav>
  );
}
