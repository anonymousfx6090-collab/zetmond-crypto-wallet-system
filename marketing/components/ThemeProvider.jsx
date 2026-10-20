'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const ThemeContext = createContext(null);
const storageKey = 'zetmond-theme';
const validTheme = value => ['light', 'dark', 'system'].includes(value) ? value : 'system';

function applyTheme(preference) {
  const resolved = preference === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0e0d12' : '#faf8fd');
}

export function useTheme() { return useContext(ThemeContext); }

export default function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('system');
  const preference = useRef('system');

  const updateTheme = useCallback(value => {
    const next = validTheme(value);
    preference.current = next;
    setThemeState(next);
    applyTheme(next);
  }, []);

  useEffect(() => {
    let saved = document.documentElement.dataset.themePreference || 'system';
    try { saved = localStorage.getItem(storageKey) || 'system'; } catch { /* Storage can be disabled by the browser. */ }
    updateTheme(saved);
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => { if (preference.current === 'system') applyTheme('system'); };
    const onStorageChange = event => { if (event.key === storageKey || event.key === null) updateTheme(event.newValue); };
    systemTheme.addEventListener('change', onSystemChange);
    window.addEventListener('storage', onStorageChange);
    return () => {
      systemTheme.removeEventListener('change', onSystemChange);
      window.removeEventListener('storage', onStorageChange);
    };
  }, [updateTheme]);

  const setTheme = value => {
    const next = validTheme(value);
    updateTheme(next);
    try { localStorage.setItem(storageKey, next); } catch { /* The selected theme still works for this visit. */ }
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
