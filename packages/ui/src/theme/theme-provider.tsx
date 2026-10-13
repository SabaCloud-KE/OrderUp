import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { ThemeContext } from './theme-context';
import type { ThemeMode, ResolvedTheme, ClubBranding } from './theme-context';
import { applyClubBrandingVars, clearClubBrandingVars } from './css-variables';

const STORAGE_KEY = 'orderup-theme-preference';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getSystemPreference = (): ResolvedTheme =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

const resolveTheme = (mode: ThemeMode): ResolvedTheme =>
  mode === 'system' ? getSystemPreference() : mode;

const applyThemeToDOM = (resolved: ResolvedTheme): void => {
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
  root.setAttribute('data-theme', resolved);
  root.setAttribute('style', root.getAttribute('style') ?? ''); // force repaint
};

const readStoredTheme = (): ThemeMode => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('drinkhub-theme-preference');
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch { /* ignore */ }
  return 'system';
};

// ─── Synchronous theme init (prevents flash) ──────────────────────────────────
// Runs immediately at module evaluation — before React renders anything.
const _initial = readStoredTheme();
if (typeof document !== 'undefined') applyThemeToDOM(resolveTheme(_initial));

// ─── Provider ─────────────────────────────────────────────────────────────────
interface ThemeProviderProps {
  children: React.ReactNode;
  /** Override storage key (useful for testing) */
  storageKey?: string;
  /** Force a specific theme (ignores localStorage) */
  forcedTheme?: ThemeMode;
  /** Default theme used when localStorage has no saved preference */
  defaultTheme?: ThemeMode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  storageKey = STORAGE_KEY,
  forcedTheme,
  defaultTheme = 'system',
}) => {
  const [theme, setThemeState] = useState<ThemeMode>(() =>
    forcedTheme ?? readStoredTheme() ?? defaultTheme
  );
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(forcedTheme ?? readStoredTheme() ?? defaultTheme)
  );
  const [clubBranding, setClubBranding] = useState<ClubBranding | null>(null);

  // Apply theme to DOM whenever it changes
  useLayoutEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyThemeToDOM(resolved);
  }, [theme]);

  // Listen for system preference changes (only relevant when mode === 'system')
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        const resolved: ResolvedTheme = e.matches ? 'dark' : 'light';
        setResolvedTheme(resolved);
        applyThemeToDOM(resolved);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((next: ThemeMode) => {
    if (forcedTheme) return; // ignore when forced
    setThemeState(next);
    try { localStorage.setItem(storageKey, next); } catch { /* ignore */ }
  }, [storageKey, forcedTheme]);

  const applyClubBranding = useCallback((branding: ClubBranding) => {
    setClubBranding(branding);
    applyClubBrandingVars(branding);
  }, []);

  const clearClubBranding = useCallback(() => {
    setClubBranding(null);
    clearClubBrandingVars();
  }, []);

  return (
    <ThemeContext.Provider value={{
      theme,
      resolvedTheme,
      setTheme,
      clubBranding,
      applyClubBranding,
      clearClubBranding,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
