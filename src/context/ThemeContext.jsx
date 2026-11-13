import { createContext, useContext, useEffect, useState } from 'react';

export const ThemeContext = createContext(null);

function resolveTheme(pref) {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

export default function ThemeProvider({ children }) {
  // Ocean is the platform default for first-time visitors; anyone who has
  // already picked a theme keeps their own saved choice.
  const [theme, setThemeState] = useState(() => localStorage.getItem('aoi-theme') || 'ocean');

  useEffect(() => {
    const apply = () => document.documentElement.setAttribute('data-theme', resolveTheme(theme));
    apply();
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  const setTheme = (pref) => {
    localStorage.setItem('aoi-theme', pref);
    setThemeState(pref);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
