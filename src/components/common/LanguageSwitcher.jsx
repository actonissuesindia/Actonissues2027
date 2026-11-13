import { useEffect, useRef, useState } from 'react';
import { useLanguage, LANGUAGES } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

// A small globe-icon dropdown — shown in TopNav for both logged-in and
// logged-out visitors, on both desktop and mobile widths, since language
// choice shouldn't be buried inside an auth-gated menu. Language names are
// always shown in their own script (see LANGUAGES in LanguageContext.jsx),
// not translated, so the option to switch stays legible no matter which
// language is currently active.
export default function LanguageSwitcher({ className = '' }) {
  const { language, setLanguage, t } = useLanguage();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const current = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  const choose = (code) => {
    setLanguage(code);
    setOpen(false);
    // Best-effort — a signed-in user's choice follows their account across
    // devices; failing silently here just means it stays this-browser-only
    // (still saved via localStorage), not a broken experience.
    if (user) api.patch('/auth/me/language', { language: code }).catch(() => {});
  };

  return (
    <div className={`position-relative flex-shrink-0 ${className}`} ref={ref}>
      <button
        type="button"
        className="btn btn-pill-ghost d-flex align-items-center gap-1"
        onClick={() => setOpen(o => !o)}
        aria-label={t('topNav.language')}
        title={t('topNav.language')}
      >
        <i className="bi bi-translate"></i>
        <span className="small d-none d-sm-inline">{current.label}</span>
      </button>
      {open && (
        <div className="position-absolute end-0 mt-2 bg-white border rounded-4 shadow-sm py-1" style={{ minWidth: 140, zIndex: 60 }}>
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              type="button"
              className={`dropdown-item-custom d-block w-100 text-start px-3 py-2 border-0 bg-transparent ${l.code === language ? 'fw-semibold text-primary' : 'text-dark'}`}
              onClick={() => choose(l.code)}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
