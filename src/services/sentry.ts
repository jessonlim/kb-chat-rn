// Sentry crash reporting — initialise once at app startup.
//
// DSN comes from the SENTRY_DSN env var at build time (EAS exposes it
// via process.env). For local dev we read from expo-constants's extra
// field. If neither is set, Sentry is a no-op — won't crash the app,
// just won't report anything.
//
// Source maps are uploaded automatically by EAS Build when SENTRY_AUTH_TOKEN
// is configured as an EAS secret (we set this once per project). With the
// uploaded source maps, JS stack traces in Sentry show readable file:line
// references to TypeScript source instead of bytecode offsets.

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

// Pull the DSN from EITHER:
//   • process.env.EXPO_PUBLIC_SENTRY_DSN  (injected at build time by EAS)
//   • expoConfig.extra.sentryDsn         (fallback for app.json-set value)
const SENTRY_DSN =
  process.env.EXPO_PUBLIC_SENTRY_DSN ||
  (Constants.expoConfig?.extra as any)?.sentryDsn ||
  '';

/**
 * Initialise Sentry. Safe to call multiple times — it's idempotent.
 * Returns true if Sentry was actually wired up, false if no DSN was
 * configured (in which case the app continues to run, just with no
 * crash reporting).
 */
export const initSentry = (): boolean => {
  if (!SENTRY_DSN) {
    if (__DEV__) {
      console.warn('[sentry] No DSN configured — crash reporting disabled.');
    }
    return false;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    // Tag every event with the build channel so we can filter "preview
    // testers" vs "production users" in the Sentry dashboard.
    environment: __DEV__ ? 'development' : 'preview',
    // Send a manageable amount of telemetry: traces only if they're slow,
    // and never the whole replay of a session.
    tracesSampleRate: 0.1,
    // Don't auto-collect screen names — we use React Navigation which has
    // its own integration we'd wire separately if needed.
    enableAutoSessionTracking: true,
    // Don't ship sourcemaps + spans to Sentry from Metro dev runs — only
    // standalone builds. Saves your free-tier event quota during dev.
    enabled: !__DEV__,
  });

  return true;
};

/** Attach user info to subsequent events so we know who hit each crash. */
export const setSentryUser = (user: { id: string; username: string; email?: string }) => {
  Sentry.setUser({
    id: user.id,
    username: user.username,
    email: user.email,
  });
};

/** Clear user info on logout. */
export const clearSentryUser = () => {
  Sentry.setUser(null);
};

/** Manually capture an exception (use in catch blocks for unexpected errors). */
export const reportError = (err: unknown, context?: Record<string, unknown>) => {
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
      Sentry.captureException(err);
    });
  } else {
    Sentry.captureException(err);
  }
};

export { Sentry };
