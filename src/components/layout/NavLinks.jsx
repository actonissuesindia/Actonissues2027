import { Link, NavLink } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';

// Maps the known standard hrefs to a translation key, so these links are
// translated regardless of whether they came from the database (Page
// Builder's seeded 'topnav-links' blocks, see routes/adminRoutes.js) or the
// hardcoded DEFAULT_NAV_LINKS fallback in TopNav.jsx — the stored `label`
// itself is admin-authored content and isn't run through i18n. Any href not
// in this map (a custom link an admin adds later) just shows its stored
// label as-is, untranslated.
const KNOWN_HREF_KEYS = {
  '/feed': 'topNav.issues',
  '/feed?filter=hot': 'topNav.trending',
  '/#top-voices': 'topNav.topVoices',
  '/articles': 'topNav.guides',
  '/games': 'topNav.games',
  '/about': 'topNav.about'
};

// Renders the desktop nav-pill link row (Issues/Trending/Top Voices/Games/
// About) from fetched 'link' blocks. Deliberately scoped
// to ONLY the desktop row in src/components/layout/TopNav.jsx — the mobile
// hamburger panel and the mobile profile-dropdown's folded links use
// different markup (icons, different groupings alongside Profile
// Settings/Control Panel) and were the subject of a previous mobile-nav fix
// with no way to visually re-verify mobile behavior in this environment, so
// they're intentionally left on their own separate hardcoded JSX rather than
// risk a regression there. See scripts/seedPageBlocks/seedTopNav.js.
export default function NavLinks({ links, user }) {
  const { t } = useLanguage();
  return links
    .filter(l => !l.config.requiresAuth || user)
    .map(l => {
      const label = KNOWN_HREF_KEYS[l.config.href] ? t(KNOWN_HREF_KEYS[l.config.href]) : l.config.label;
      return /^https?:\/\//.test(l.config.href) || l.config.href.startsWith('/#')
        ? <Link key={l._id} to={l.config.href} className="nav-pill-link">{label}</Link>
        : (
          <NavLink key={l._id} to={l.config.href} className={({ isActive }) => 'nav-pill-link' + (isActive ? ' active' : '')}>
            {label}
          </NavLink>
        );
    });
}
