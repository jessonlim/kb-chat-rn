// Hook to resolve any attachment URL format to a displayable URI.
//
// The backend can return URLs in four formats:
// 1. Full URL    — https://... or http://...                   → use directly
// 2. S3 key      — s3://bucket/key → call /api/uploads/signed-url
// 3. Relative    — /uploads/filename → prefix with API_URL
// 4. Local URI   — file:// / content:// / data: / ph://        → pass through
//
// Signed S3 URLs are cached in BOTH a module Map (instant on subsequent
// renders) AND MMKV (survives app reloads — so avatars don't have to
// re-fetch on every cold start). The MMKV cache is hydrated synchronously
// on module load, so the first render already has the cached URL if one
// exists.

import { useState, useEffect, useRef } from 'react';
import Toast from 'react-native-toast-message';
import { API_URL, storage } from '../services/api';
import { secureStorage } from '../services/secureStorage';

// NOTE on token reads below:
// The signed-URL fetches use raw `fetch` (not the axios `api` client)
// so the request interceptor does NOT apply — we have to add the
// Authorization header by hand. After the M1 migration on Build #21+,
// the only place the real token lives is the encrypted MMKV exposed
// via `secureStorage.getToken()`. Reading from the plain `storage`
// instance returns undefined and produces a 401 "not authenticated"
// on the backend.

// DEBUG: surface signed-URL fetch failures. Default off — flip to true
// if media stops loading and you need on-device visibility.
const SHOW_MEDIA_DEBUG = false;
let lastErrToastAt = 0;
const dt = (text1: string, text2?: string) => {
  if (!SHOW_MEDIA_DEBUG) return;
  // Debounce: at most one error toast per 4s, otherwise it spams when many
  // bubbles try to resolve at once.
  const now = Date.now();
  if (now - lastErrToastAt < 4000) return;
  lastErrToastAt = now;
  Toast.show({ type: 'error', text1, text2, position: 'top', visibilityTime: 3000 });
};

// In-memory cache, hydrated from MMKV on module load.
// Once an entry expires we drop it from both caches.
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

// How long to cache S3 signed URLs. The backend mints them with a 1h TTL
// by default — keep ours a bit shorter so we refresh before they expire.
const CACHE_TTL_MS = 50 * 60 * 1000;
const MMKV_KEY = 'cache.signedUrls.v1';

// ── Hydrate the in-memory cache from MMKV on module load ─────────────
(function hydrateFromStorage() {
  try {
    const raw = storage.getString(MMKV_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, { url: string; expiresAt: number }>;
    const now = Date.now();
    for (const [key, entry] of Object.entries(parsed)) {
      if (entry?.expiresAt > now) signedUrlCache.set(key, entry);
    }
  } catch (err) {
    console.warn('[useMediaUrl] failed to hydrate cache:', err);
  }
})();

// Schedule a debounced persist so we're not writing on every cache update.
let persistTimer: ReturnType<typeof setTimeout> | null = null;
const persistCache = () => {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      const now = Date.now();
      const obj: Record<string, { url: string; expiresAt: number }> = {};
      for (const [key, entry] of signedUrlCache.entries()) {
        if (entry.expiresAt > now) obj[key] = entry;
      }
      storage.set(MMKV_KEY, JSON.stringify(obj));
    } catch (err) {
      console.warn('[useMediaUrl] failed to persist cache:', err);
    }
  }, 500);
};

const setCached = (key: string, url: string) => {
  signedUrlCache.set(key, { url, expiresAt: Date.now() + CACHE_TTL_MS });
  persistCache();
};

/**
 * Resolve a raw attachment URL to something React Native's <Image> can display.
 * Returns { uri, loading, error }.
 */
export const useMediaUrl = (rawUrl: string | undefined) => {
  // Initialise with the cached value synchronously when possible so the
  // very first render already has the URI — no flash of empty / fallback.
  const initialUri = (() => {
    if (!rawUrl) return null;
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
    if (rawUrl.startsWith('s3://')) {
      const key = rawUrl.slice(5);
      const cached = signedUrlCache.get(key);
      if (cached && cached.expiresAt > Date.now()) return cached.url;
      return null;
    }
    if (rawUrl.startsWith('/')) return `${API_URL}${rawUrl}`;
    return rawUrl; // file://, content://, data:, ph://
  })();

  const [uri, setUri] = useState<string | null>(initialUri);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!rawUrl) {
      setUri(null);
      return;
    }

    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      setUri(rawUrl);
      return;
    }

    if (rawUrl.startsWith('s3://')) {
      const key = rawUrl.slice(5);

      // Cache hit? Use it immediately.
      const cached = signedUrlCache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        setUri(cached.url);
        return;
      }

      setLoading(true);
      setError(null);

      const token = secureStorage.getToken('accessToken');
      fetch(`${API_URL}/api/uploads/signed-url?key=${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (!res.ok) {
            dt('❌ Signed URL HTTP', `${res.status} for ${key.slice(0, 30)}`);
            throw new Error(`Signed URL fetch failed (${res.status})`);
          }
          return res.json();
        })
        .then((data) => {
          if (!mountedRef.current) return;
          const signedUrl = data.url || data.signedUrl;
          if (signedUrl) {
            setCached(key, signedUrl);
            setUri(signedUrl);
          } else {
            dt('❌ Signed URL empty', key.slice(0, 30));
            setError('No signed URL returned');
          }
        })
        .catch((err) => {
          if (!mountedRef.current) return;
          dt('❌ Signed URL error', err?.message || 'unknown');
          setError(err.message);
        })
        .finally(() => {
          if (mountedRef.current) setLoading(false);
        });

      return;
    }

    if (rawUrl.startsWith('/')) {
      setUri(`${API_URL}${rawUrl}`);
      return;
    }

    setUri(rawUrl);
  }, [rawUrl]);

  return { uri, loading, error };
};

/**
 * Non-hook version for one-off resolution (e.g. inside callbacks).
 * Returns the resolved URL string. Shares the same persistent cache.
 */
export const resolveMediaUrl = async (rawUrl: string): Promise<string> => {
  if (!rawUrl) return '';

  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }

  if (rawUrl.startsWith('s3://')) {
    const key = rawUrl.slice(5);
    const cached = signedUrlCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.url;

    const token = secureStorage.getToken('accessToken');
    const res = await fetch(
      `${API_URL}/api/uploads/signed-url?key=${encodeURIComponent(key)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`Signed URL fetch failed (${res.status})`);
    const data = await res.json();
    const signedUrl = data.url || data.signedUrl;
    if (signedUrl) setCached(key, signedUrl);
    return signedUrl || '';
  }

  if (rawUrl.startsWith('/')) return `${API_URL}${rawUrl}`;

  return rawUrl;
};
