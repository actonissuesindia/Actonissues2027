import { Link } from 'react-router-dom';
import useLogoOverrides from '../../hooks/useLogoOverrides';
import usePageBlocks from '../../hooks/usePageBlocks';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { withoutRetiredLinks } from '../../utils/retiredLinks';
import logoIcon from '../../assets/logo/aoi-logo.png';

// Maps known hrefs to a translation key, same reasoning as
// src/components/layout/NavLinks.jsx — footer links come from the database
// (Page Builder's 'footer-platform'/'footer-account'/'footer-legal'
// blocks), not this file's fallback JSX, so translating the stored label
// text directly wouldn't reach what's actually shown. '/feed' is used for
// two different labels here ("Issues" and "Raise an Issue"), which a
// href-only map can't tell apart — disambiguated by checking the stored
// label text itself for "raise" as a fallback signal.
const FOOTER_LINK_KEYS = {
  '/about': 'footer.aboutUs',
  '/feed?filter=hot': 'topNav.trending',
  '/articles': 'footer.guidesResources',
  '/login': 'topNav.logIn',
  '/register': 'topNav.getStarted',
  '/my-issues': 'topNav.myIssues',
  '/terms': 'footer.termsOfUse',
  '/privacy': 'footer.privacyPolicy',
  '/legal': 'footer.legalDisclaimer'
};

function footerLinkLabel(t, block) {
  const { href, label } = block.config;
  if (href === '/feed') return /raise/i.test(label) ? t('footer.raiseIssue') : t('topNav.issues');
  return FOOTER_LINK_KEYS[href] ? t(FOOTER_LINK_KEYS[href]) : label;
}

// Renders a column's 'link' blocks — falls back to `fallback` (this file's
// original hardcoded <Link> list) when null (loading) or empty (nothing
// seeded/admin removed all links), same defensive pattern as every other
// migrated region. See scripts/seedPageBlocks/seedFooter.js.
function FooterColumn({ blocks, user, fallback }) {
  const { t } = useLanguage();
  if (blocks === null || blocks.length === 0) return fallback;
  // Same reason as the top nav: a stored link to a page that has since been
  // merged away keeps rendering until the cleanup script is run against
  // production. See src/utils/retiredLinks.js.
  return withoutRetiredLinks(blocks)
    .filter(b => !b.config.requiresAuth || user)
    .map(b => <Link key={b._id} to={b.config.href}>{footerLinkLabel(t, b)}</Link>);
}

export default function Footer() {
  const { footer: footerLogoOverride } = useLogoOverrides();
  const { user } = useAuth();
  const { t } = useLanguage();
  const platformBlocks = usePageBlocks('footer-platform');
  const accountBlocks = usePageBlocks('footer-account');
  const legalBlocks = usePageBlocks('footer-legal');
  return (
    <footer className="site-footer">
      <div className="container-fluid px-4">
        <div className="row g-4">
          <div className="col-lg-4">
            <div className="d-flex align-items-center gap-2 mb-2">
              <span className="brand-mark-chip"><img src={footerLogoOverride || logoIcon} alt="Act On Issues" className="brand-mark-img-footer" /></span>
            </div>
            <p className="small mb-2" style={{ maxWidth: 420 }}>
              {t('footer.tagline')}
            </p>
          </div>
          <div className="col-6 col-lg-3">
            <h6>{t('footer.platform')}</h6>
            <div className="d-flex flex-column gap-2 mt-3 small">
              <FooterColumn blocks={platformBlocks} user={user} fallback={(
                <>
                  <Link to="/about">{t('footer.aboutUs')}</Link>
                  <Link to="/feed">{t('topNav.issues')}</Link>
                  <Link to="/feed?filter=hot">{t('topNav.trending')}</Link>
                  <Link to="/articles">{t('footer.guidesResources')}</Link>
                  <Link to="/feed">{t('footer.raiseIssue')}</Link>
                </>
              )} />
            </div>
          </div>
          <div className="col-6 col-lg-3">
            <h6>{t('footer.account')}</h6>
            <div className="d-flex flex-column gap-2 mt-3 small">
              <FooterColumn blocks={accountBlocks} user={user} fallback={(
                <>
                  <Link to="/login">{t('topNav.logIn')}</Link>
                  <Link to="/register">{t('topNav.getStarted')}</Link>
                  <Link to="/my-issues">{t('topNav.myIssues')}</Link>
                </>
              )} />
            </div>
          </div>
          <div className="col-12 col-sm-6 col-lg-2">
            <h6>{t('footer.legal')}</h6>
            <div className="d-flex flex-column gap-2 mt-3 small">
              <FooterColumn blocks={legalBlocks} user={user} fallback={(
                <>
                  <Link to="/terms">{t('footer.termsOfUse')}</Link>
                  <Link to="/privacy">{t('footer.privacyPolicy')}</Link>
                  <Link to="/legal">{t('footer.legalDisclaimer')}</Link>
                </>
              )} />
            </div>
          </div>
        </div>
        <div className="footer-bottom d-flex flex-wrap justify-content-between gap-2">
          <span>{t('footer.copyright')}</span>
          <span>{t('footer.builtBy')}</span>
        </div>
      </div>
    </footer>
  );
}
