// ThemeContext — manages the active color palette.
//
// User can pick 'auto' (follow OS), 'light', or 'dark'. The choice is
// persisted in MMKV. 'auto' resolves through React Native's useColorScheme.
//
// Usage in a component:
//   const { colors, theme, setTheme } = useTheme();
//   const styles = useStyles(makeStyles);   // re-creates StyleSheet on theme change
//   ...
//   const makeStyles = (c: ColorPalette) => StyleSheet.create({
//     container: { backgroundColor: c.bgDark },
//   });

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import { storage } from '../services/api';
import {
  darkColors,
  lightColors,
  type ColorPalette,
} from '../utils/theme';

export type ThemePreference = 'auto' | 'light' | 'dark';
export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'pref.theme';
const DEFAULT_PREF: ThemePreference = 'auto';

const loadPref = (): ThemePreference => {
  const stored = storage.getString(STORAGE_KEY);
  if (stored === 'auto' || stored === 'light' || stored === 'dark') return stored;
  return DEFAULT_PREF;
};

interface ThemeContextType {
  /** User preference — what they picked in Settings */
  theme: ThemePreference;
  /** Resolved mode — 'light' or 'dark' after applying 'auto' */
  mode: ThemeMode;
  /** Active color palette — switch this and everything re-renders */
  colors: ColorPalette;
  /** Update user preference (persists to MMKV) */
  setTheme: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemePreference>(() => loadPref());
  const osScheme = useColorScheme(); // 'light' | 'dark' | null

  // Resolve 'auto' against the OS. Default to dark when OS hint is missing.
  const mode: ThemeMode = useMemo(() => {
    if (theme === 'light') return 'light';
    if (theme === 'dark') return 'dark';
    return osScheme === 'light' ? 'light' : 'dark';
  }, [theme, osScheme]);

  const colors = mode === 'light' ? lightColors : darkColors;

  const setTheme = useCallback((next: ThemePreference) => {
    storage.set(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  // Persist whenever it changes (covers programmatic updates too)
  useEffect(() => {
    storage.set(STORAGE_KEY, theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, mode, colors, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

/**
 * Convenience hook: produces a memoised StyleSheet that re-creates whenever
 * the active palette changes. Use it instead of calling StyleSheet.create
 * at module top-level, so theme switches actually take effect.
 *
 * Example:
 *   const styles = useStyles((c) => ({
 *     container: { backgroundColor: c.bgDark },
 *     title: { color: c.textPrimary },
 *   }));
 */
export const useStyles = <T extends StyleSheet.NamedStyles<T>>(
  factory: (c: ColorPalette) => T,
): T => {
  const { colors } = useTheme();
  return useMemo(() => StyleSheet.create(factory(colors)), [colors, factory]);
};
