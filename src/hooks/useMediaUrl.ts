// Hook to resolve any attachment URL format to a displayable URI.
//
// The backend can return URLs in three formats:
// 1. Full URL   — https://... or http://... → use directly
// 2. S3 key     — s3://bucket/key → call /api/uploads/signed-url to get a signed URL
// 3. Relative   — /uploads/filename → prefix with API_URL
//
// Signed S3 URLs are cached in a Map so we don't re-fetch on every render.

import { useState, useEffect, useRef } from 'react';
import { API_URL, storage } from '../services/api';

// Module-level cache — shared across all component instances
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

// How long to cache S3 signed URLs (25 min — they usually last 30 min)
const CACHE_TTL_MS = 25 * 60 * 1000;

/**
 * Resolve a raw attachment URL to something React Native's <Image> can display.
 * Returns { uri, loading, error }.
 */
export const useMediaUrl = (rawUrl: string | undefined) => {
  const [uri, setUri] = useState<string | null>(null);
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

    // 1. Full URL — use directly
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      setUri(rawUrl);
      return;
    }

    // 2. S3 key — fetch signed URL
    if (rawUrl.startsWith('s3://')) {
      const key = rawUrl.slice(5); // strip "s3://"

      // Check cache first
      const cached = signedUrlCache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        setUri(cached.url);
        return;
      }

      setLoading(true);
      setError(null);

      const token = storage.getString('accessToken');
      fetch(`${API_URL}/api/uploads/signed-url?key=${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (!res.ok) throw new Error(`Signed URL fetch failed (${res.status})`);
          return res.json();
        })
        .then((data) => {
          if (!mountedRef.current) return;
          const signedUrl = data.url || data.signedUrl;
          if (signedUrl) {
            signedUrlCache.set(key, {
              url: signedUrl,
              expiresAt: Date.now() + CACHE_TTL_MS,
            });
            setUri(signedUrl);
          } else {
            setError('No signed URL returned');
          }
        })
        .catch((err) => {
          if (!mountedRef.current) return;
          setError(err.message);
        })
        .finally(() => {
          if (mountedRef.current) setLoading(false);
        });

      return;
    }

    // 3. Relative path — prefix with API_URL
    if (rawUrl.startsWith('/')) {
      setUri(`${API_URL}${rawUrl}`);
      return;
    }

    // Fallback — treat as a full URL
    setUri(rawUrl);
  }, [rawUrl]);

  return { uri, loading, error };
};

/**
 * Non-hook version for one-off resolution (e.g. inside callbacks).
 * Returns the resolved URL string.
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

    const token = storage.getString('accessToken');
    const res = await fetch(
      `${API_URL}/api/uploads/signed-url?key=${encodeURIComponent(key)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`Signed URL fetch failed (${res.status})`);
    const data = await res.json();
    const signedUrl = data.url || data.signedUrl;
    if (signedUrl) {
      signedUrlCache.set(key, { url: signedUrl, expiresAt: Date.now() + CACHE_TTL_MS });
    }
    return signedUrl || '';
  }

  if (rawUrl.startsWith('/')) return `${API_URL}${rawUrl}`;

  return rawUrl;
};
