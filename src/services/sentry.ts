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
    // PII / secret scrubbing — without these filters Sentry would auto-
    // capture HTTP request/response bodies as breadcrumbs, which means
    // any crash within 100 breadcrumbs of a login attempt would ship the
    // user's password to our dashboard. Same for refresh tokens, change-
    // password, delete-account. Filter the breadcrumbs at source AND
    // double-check on send.
    sendDefaultPii: false,
    beforeBreadcrumb(breadcrumb) {
      // Drop axios/fetch breadcrumbs for sensitive auth endpoints
      // entirely — we don't need to know the URL was hit, the stack
      // trace at the crash site is enough context.
      const url = (breadcrumb.data as any)?.url || '';
      if (
        breadcrumb.category === 'xhr' ||
        breadcrumb.category === 'fetch' ||
        breadcrumb.category === 'http'
      ) {
        if (/\/api\/auth\/(login|register|change-password|delete-account|refresh)/.test(url)) {
          return null;
        }
      }
      // Sanitize the rest: strip request body / Authorization header
      // from non-auth requests too — safer default than trusting field
      // names. We keep the URL + status for debug context.
      if (breadcrumb.data) {
        const data = breadcrumb.data as any;
        if (data.request_body_size != null) delete data.request_body_size;
        if (data.body) delete data.body;
        if (data.headers) {
          if (typeof data.headers === 'object') {
            delete data.headers.Authorization;
            delete data.headers.authorization;
            delete data.headers.Cookie;
            delete data.headers.cookie;
          }
        }
      }
      return breadcrumb;
    },
    beforeSend(event) {
      // Final scrub before the event leaves the device. Strip anything
      // that looks like a token/password from extra fields. (The
      // breadcrumb filter usually catches everything; this is defence
      // in depth.)
      const scrubFields = ['password', 'refreshToken', 'accessToken', 'token', 'phone'];
      const scrub = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        for (const k of Object.keys(obj)) {
          if (scrubFields.includes(k)) {
            obj[k] = '[Filtered]';
          } else if (typeof obj[k] === 'object') {
            scrub(obj[k]);
          }
        }
      };
      scrub(event.extra);
      scrub(event.contexts);
      // Drop email from user — id + username is enough for triage and
      // doesn't risk GDPR/PDPA exposure.
      if (event.user) {
        delete (event.user as any).email;
      }
      return event;
    },
  });

  return true;
};

/** Attach user info to subsequent events so we know who hit each crash.
 *  Intentionally omits email — id + username is enough to triage, and
 *  shipping email to Sentry without explicit user consent violates
 *  GDPR/PDPA. */
export const setSentryUser = (user: { id: string; username: string }) => {
  Sentry.setUser({
    id: user.id,
    username: user.username,
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
