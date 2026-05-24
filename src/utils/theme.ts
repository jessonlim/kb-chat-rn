// KB Chat theme — black background with KB Chat red as the brand color.

export const colors = {
  // Primary brand (KB Chat red)
  primary: '#dc2626',
  primaryDark: '#b91c1c',
  primaryLight: '#fca5a5',

  // Backgrounds (deeper black for KB Chat brand)
  bgDark: '#000000',
  bgCard: '#141414',
  bgInput: '#1f1f1f',
  bgHeader: '#0a0a0a',

  // Text
  textPrimary: '#ffffff',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',

  // Accents
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  // Success stays green — universal convention (checkmarks, "done", etc.)
  success: '#22c55e',

  // Chat bubbles
  bubbleSent: '#dc2626',         // outgoing messages in brand red
  bubbleSentText: '#ffffff',
  bubbleReceived: '#1f1f1f',
  bubbleReceivedText: '#ffffff',

  // Misc
  border: '#262626',
  overlay: 'rgba(0,0,0,0.6)',
  // Online indicator stays green — universal convention
  online: '#22c55e',
  offline: '#71717a',
};

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
