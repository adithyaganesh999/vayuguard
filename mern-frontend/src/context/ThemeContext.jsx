'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ThemeContext = createContext(undefined);

const THEMES = {
  dark: {
    name: 'Dark',
    background: '#0a0a0a',
    card: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.08)',
    text: '#ffffff',
    textMuted: 'rgba(255,255,255,0.4)',
  },
  light: {
    name: 'Light',
    background: '#f8fafc',
    card: 'rgba(0,0,0,0.03)',
    border: 'rgba(0,0,0,0.08)',
    text: '#0f172a',
    textMuted: 'rgba(0,0,0,0.4)',
  },
};

const THEME_KEY = 'vayuguard_theme';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark');

  // Restore theme preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved && THEMES[saved]) {
        setTheme(saved);
      } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        setTheme('light');
      }
    } catch {}
  }, []);

  // Apply theme class to document
  useEffect(() => {
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(theme);
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {}
      return next;
    });
  }, []);

  const setThemeMode = useCallback((mode) => {
    if (THEMES[mode]) {
      setTheme(mode);
      try {
        localStorage.setItem(THEME_KEY, mode);
      } catch {}
    }
  }, []);

  const value = {
    theme,
    themeConfig: THEMES[theme],
    isDark: theme === 'dark',
    isLight: theme === 'light',
    toggleTheme,
    setTheme: setThemeMode,
    themes: Object.keys(THEMES),
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

export default ThemeContext;
