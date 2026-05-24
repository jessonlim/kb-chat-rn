// KB Chat theme — supports light + dark mode.
//
// Both palettes share the same shape so callers don't need to know which
// theme is active. The active palette is selected by ThemeContext based on
// the user's preference ('auto' | 'light' | 'dark').
//
// Static-import call sites (StyleSheet.create at module top-level) get the
// DARK palette as a default `colors` export. To support live theme switching,
// callers should migrate to `useTheme()` (see src/context/ThemeContext.tsx).

export type ColorPalette = {
  primary: string;
  primaryDark: string;
  primaryLight: string;

  bgDark: string;
  bgCard: string;
  bgInput: string;
  bgHeader: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  danger: string;
  warning: string;
  info: string;
  success: string;

  bubbleSent: string;
  bubbleSentText: string;
  bubbleReceived: string;
  bubbleReceivedText: string;

  border: string;
  overlay: string;
  online: string;
  offline: string;
};

// ── DARK theme (KB Chat default) ─────────────────────────────────────
export const darkColors: ColorPalette = {
  primary: '#dc2626',
  primaryDark: '#b91c1c',
  primaryLight: '#fca5a5',

  bgDark: '#000000',
  bgCard: '#141414',
  bgInput: '#1f1f1f',
  bgHeader: '#0a0a0a',

  textPrimary: '#ffffff',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',

  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  success: '#22c55e',

  bubbleSent: '#dc2626',
  bubbleSentText: '#ffffff',
  bubbleReceived: '#1f1f1f',
  bubbleReceivedText: '#ffffff',

  border: '#262626',
  overlay: 'rgba(0,0,0,0.6)',
  online: '#22c55e',
  offline: '#71717a',
};

// ── LIGHT theme ──────────────────────────────────────────────────────
// White base, dark text, same KB Chat red brand. Designed to look like
// iMessage / WhatsApp light mode but with red accents.
export const lightColors: ColorPalette = {
  primary: '#dc2626',
  primaryDark: '#b91c1c',
  primaryLight: '#fecaca',

  bgDark: '#ffffff',        // page bg (named bgDark for API consistency)
  bgCard: '#f5f5f5',        // cards / sections
  bgInput: '#f0f0f0',       // input fields
  bgHeader: '#ffffff',      // top nav

  textPrimary: '#111111',
  textSecondary: '#525252',
  textMuted: '#737373',

  danger: '#dc2626',
  warning: '#f59e0b',
  info: '#2563eb',
  success: '#16a34a',

  bubbleSent: '#dc2626',     // outgoing — brand red
  bubbleSentText: '#ffffff',
  bubbleReceived: '#f0f0f0', // incoming — light gray with dark text
  bubbleReceivedText: '#111111',

  border: '#e5e5e5',
  overlay: 'rgba(0,0,0,0.4)',
  online: '#22c55e',
  offline: '#a3a3a3',
};

// Default export — kept for legacy static imports. Defaults to dark.
// New code should use useTheme() from src/context/ThemeContext.tsx.
export const colors: ColorPalette = darkColors;

// ── Layout tokens (theme-independent) ────────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  title: 28,
};

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 20,
  full: 9999,
};
