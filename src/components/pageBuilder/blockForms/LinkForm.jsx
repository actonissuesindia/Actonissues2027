import { useEffect, useState } from 'react';
import api from '../../../services/api';

// Fixed, always-live routes worth offering in the quick-pick list — pages
// that exist in code rather than a database record, so there's nowhere else
// to fetch them from. Articles and Custom Pages are fetched at mount instead
// (see below), since those lists change as content gets published.
const STATIC_ROUTES = [
  { label: 'Home', href: '/' },
  { label: 'Feed (all issues)', href: '/feed' },
  { label: 'About', href: '/about' },
  { label: 'Articles / Related Topics', href: '/articles' },
  { label: 'Register', href: '/register' },
  { label: 'Log in', href: '/login' },
  { label: 'Terms of Use', href: '/terms' },
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Legal Disclaimer', href: '/legal' }
];

// config: { label, href, requiresAuth? }. There's no `group` field here —
// Footer's 3 columns (Platform/Account/Legal) and TopNav's link list are
// already separate `page` values (footer-platform, footer-account,
// footer-legal, topnav-links), so which column/list a link belongs to is
// determined by which region it's added to, not a field inside it.
export default function LinkForm({ config, onSave, onCancel, saving }) {
  const [label, setLabel] = useState(config.label || '');
  const [href, setHref] = useState(config.href || '');
  const [requiresAuth, setRequiresAuth] = useState(!!config.requiresAuth);
  // Quick-pick options for "Goes to" — every published Article and Custom
  // Page, generated the moment content is published, so linking to it never
  // requires knowing (or hand-typing) its exact URL.
  const [options, setOptions] = useState(STATIC_ROUTES);

  useEffect(() => {
    Promise.all([
      api.get('/articles').then(res => (res.data.articles || []).map(a => ({ label: `Article: ${a.title}`, href: `/articles/${a.slug}` }))).catch(() => []),
      api.get('/admin/pages').then(res => (res.data.pages || [])
        .filter(p => p.status === 'Published')
        .map(p => ({ label: `Page: ${p.title}`, href: `/p/${p.slug}` }))).catch(() => [])
    ]).then(([articles, pages]) => setOptions([...STATIC_ROUTES, ...articles, ...pages]));
  }, []);

  const pick = (e) => {
    const chosen = options.find(o => o.href === e.target.value);
    if (!chosen) return;
    setHref(chosen.href);
    if (!label.trim()) setLabel(chosen.label.replace(/^(Article|Page): /, ''));
  };

  return (
    <div className="p-2">
      <div className="mb-2">
        <label className="form-label small mb-1">Link text</label>
        <input className="form-control form-control-sm" value={label} onChange={e => setLabel(e.target.value)} />
      </div>
      <div className="mb-2">
        <label className="form-label small mb-1">Quick-pick a page (optional)</label>
        <select className="form-select form-select-sm" value="" onChange={pick}>
          <option value="">Choose from an existing page…</option>
          {options.map(o => <option key={o.href} value={o.href}>{o.label}</option>)}
        </select>
      </div>
      <div className="mb-2">
        <label className="form-label small mb-1">Goes to (e.g. /feed or https://...)</label>
        <input className="form-control form-control-sm" value={href} onChange={e => setHref(e.target.value)} />
      </div>
      <div className="form-check mb-2">
        <input className="form-check-input" type="checkbox" id="link-auth" checked={requiresAuth} onChange={e => setRequiresAuth(e.target.checked)} />
        <label className="form-check-label small" htmlFor="link-auth">Only show this link to logged-in visitors</label>
      </div>
      <div className="d-flex gap-2">
        <button
          type="button" className="btn btn-sm btn-gradient" disabled={saving || !label.trim() || !href.trim()}
          onClick={() => onSave({ label, href, requiresAuth })}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
