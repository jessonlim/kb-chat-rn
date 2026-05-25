// Remarks store — user-private nicknames for contacts.
//
// WeChat-style: you can rename any of your contacts (e.g. "Mom" instead of
// "李秀英"), and only you see that rename. The other side is unaware.
//
// We persist remarks in MMKV under a single JSON blob keyed by user-id.
// Avoiding the backend keeps things simple — there's no synchronisation
// concern with the web app yet, but if we later want cross-device parity
// we'd just mirror this map to a /api/contacts/:id/remark endpoint.

import { useEffect, useSyncExternalStore } from 'react';
import { storage } from '../services/api';

const MMKV_KEY = 'contacts.remarks.v1';

type RemarkMap = Record<string, string>;

let cache: RemarkMap | null = null;
const listeners = new Set<() => void>();

const load = (): RemarkMap => {
  if (cache) return cache;
  try {
    const raw = storage.getString(MMKV_KEY);
    cache = raw ? (JSON.parse(raw) as RemarkMap) : {};
  } catch {
    cache = {};
  }
  return cache!;
};

const persist = (next: RemarkMap) => {
  try {
    storage.set(MMKV_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
};

const notify = () => listeners.forEach((fn) => fn());

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const remarksStore = {
  /** Get the remark for a given contact id, or empty string. */
  get(userId: string): string {
    return load()[userId] || '';
  },

  /** Set or clear a remark. Empty string deletes the entry. */
  set(userId: string, remark: string) {
    const map = load();
    const trimmed = (remark || '').trim();
    if (trimmed) {
      map[userId] = trimmed;
    } else {
      delete map[userId];
    }
    cache = { ...map };
    persist(cache);
    notify();
  },

  /** Get the whole map (read-only). */
  all(): RemarkMap {
    return { ...load() };
  },

  subscribe,
};

/**
 * React hook — returns the current remark for a contact, re-rendering
 * whenever the store changes.
 */
export const useRemark = (userId: string | undefined): string => {
  const value = useSyncExternalStore(
    subscribe,
    () => (userId ? remarksStore.get(userId) : ''),
    () => (userId ? remarksStore.get(userId) : ''),
  );
  // Keep the cache hot even if no listeners are registered
  useEffect(() => {
    load();
  }, []);
  return value;
};

/**
 * Helper: apply a remark on top of the contact's display name.
 * Returns the remark if set, otherwise the displayName or username.
 */
export const displayNameOf = (user: { id: string; displayName?: string; username: string }): string => {
  const remark = remarksStore.get(user.id);
  if (remark) return remark;
  return user.displayName || user.username;
};
