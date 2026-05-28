// API client with token interceptor and auto-refresh.
// Same pattern as the Capacitor app, adapted for React Native (MMKV storage).
//
// Token storage uses the encrypted `secureStorage` module (audit M1).
// `storage` (the plain MMKV) is kept for everything else — theme,
// language, caches, etc. — where encryption would be overhead without
// benefit.
//
// NOTE on import ordering: secureStorage imports `storage` from this
// file, so we can't import secureStorage at the top here without a
// cycle. We use a lazy import inside the interceptor instead. The
// auth store and other call sites use the eager import path which
// resolves the cycle through module evaluation order.

import axios from 'axios';
import { MMKV } from 'react-native-mmkv';
import { authEvents } from './authEvents';

export const storage = new MMKV();

export const API_URL = 'https://api.kb-chat.com';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach access token ──────────────────────────
api.interceptors.request.use((config) => {
  // Lazy require to break the circular import (secureStorage -> api.storage).
  // After first call this is a cached module lookup, ~free.
  const { secureStorage } = require('./secureStorage');
  const token = secureStorage.getToken('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: auto-refresh on 401 ────────────────────────
let isRefreshing = false;
let failedQueue: { resolve: (t: string) => void; reject: (e: unknown) => void }[] = [];

// Refresh failure tracker — audit finding M8. Without this, a backend
// that returns 401 on the refresh endpoint (revoked session, deleted
// account, server-side ban) caused every subsequent request to fire
// its own refresh attempt, each of which 401'd, each of which fired
// another. We'd hammer /api/auth/refresh until either the user
// force-quit or rate-limiting kicked in.
//
// Strategy: after 2 refresh failures in a 60-second window, hard-stop
// the auth session. Emit `session_expired` so the auth store can show
// a toast + redirect to login. The counters reset on successful refresh
// or on full app restart.
let refreshFailures = 0;
let refreshWindowStart = 0;
const REFRESH_FAILURE_LIMIT = 2;
const REFRESH_FAILURE_WINDOW_MS = 60_000;

// Per-app-load latch so we only emit `session_expired` once per session
// even if multiple parallel refresh attempts all fail.
let sessionExpiredEmitted = false;

const declareSessionDead = () => {
  if (sessionExpiredEmitted) return;
  sessionExpiredEmitted = true;
  // Clear tokens defensively — the catch block below already does this
  // but the latch path may have come from somewhere else.
  const { secureStorage } = require('./secureStorage');
  secureStorage.clearAll();
  authEvents.emit('session_expired');
};

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token!);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: (token: string) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          },
          reject,
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const { secureStorage } = require('./secureStorage');
      const refreshToken = secureStorage.getToken('refreshToken');
      if (!refreshToken) throw new Error('No refresh token');

      const { data } = await axios.post(`${API_URL}/api/auth/refresh`, {
        refreshToken,
      });

      secureStorage.setToken('accessToken', data.accessToken);
      secureStorage.setToken('refreshToken', data.refreshToken);

      // Success — reset the failure tracker so we don't carry old
      // failures forward into a fresh, healthy session.
      refreshFailures = 0;
      refreshWindowStart = 0;

      processQueue(null, data.accessToken);
      original.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(original);
    } catch (refreshError) {
      processQueue(refreshError, null);

      // Audit finding M8 — guard against the indefinite refresh loop.
      // Increment the counter; if we're past the threshold within the
      // window, declare the session dead and emit a logout event.
      const now = Date.now();
      if (now - refreshWindowStart > REFRESH_FAILURE_WINDOW_MS) {
        // Window expired — start fresh
        refreshFailures = 1;
        refreshWindowStart = now;
      } else {
        refreshFailures += 1;
      }

      if (refreshFailures >= REFRESH_FAILURE_LIMIT) {
        // Two strikes in 60s — the session is genuinely dead, not a
        // transient network blip. Emit and stop.
        declareSessionDead();
      } else {
        // Single failure — clear tokens so the next 401 doesn't get
        // queued behind stale state, but don't force-logout yet. The
        // refresh might just be racing a transient network issue and
        // the next request will succeed.
        const { secureStorage } = require('./secureStorage');
        secureStorage.clearAll();
      }

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
