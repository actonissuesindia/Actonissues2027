import { createContext, useContext, useState } from 'react';
import en from '../i18n/translations/en';
import hi from '../i18n/translations/hi';
import te from '../i18n/translations/te';
import ta from '../i18n/translations/ta';
import mr from '../i18n/translations/mr';
import or_ from '../i18n/translations/or';
import ml from '../i18n/translations/ml';
import kn from '../i18n/translations/kn';

export const LanguageContext = createContext(null);

// Native names shown in the switcher itself — deliberately never translated,
// so the option to switch OUT of a language stays readable no matter which
// language is currently active.
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'mr', label: 'मराठी' },
  { code: 'or', label: 'ଓଡ଼ିଆ' },
  { code: 'ml', label: 'മലയാളം' },
  { code: 'kn', label: 'ಕನ್ನಡ' }
];

const DICTS = { en, hi, te, ta, mr, or: or_, ml, kn };

function lookup(dict, path) {
  return path.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), dict);
}

// Only the citizen-facing surface is translated (Home, Feed, TopNav, auth,
// issue reporting/detail, articles, profiles) — Admin/Authority tooling and
// Page Builder stay English-only by design (internal tools, not part of
// the public reach this feature targets), so a missing key there is
// expected, not a bug — it just falls back to English silently.
export default function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => localStorage.getItem('aoi-language') || 'en');

  const setLanguage = (code) => {
    if (!DICTS[code]) return;
    localStorage.setItem('aoi-language', code);
    setLanguageState(code);
  };

  const t = (key, vars) => {
    let str = lookup(DICTS[language], key);
    if (str === undefined) str = lookup(DICTS.en, key);
    if (str === undefined) return key;
    if (vars) {
      Object.keys(vars).forEach((k) => { str = str.replace(new RegExp(`{{${k}}}`, 'g'), vars[k]); });
    }
    return str;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
