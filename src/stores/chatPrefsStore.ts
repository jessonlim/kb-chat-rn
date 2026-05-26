// Per-chat user preferences stored locally in MMKV.
//
// Holds settings that are private to the user (not synced to other
// devices via the backend), keyed by chatId:
//   - alias:       the user's nickname in this specific chat / group
//                  (group settings → "My Alias in Group")
//   - remark:      the user's private rename of this chat (like contact
//                  remarks but applied at the chat level)
//   - showNames:   whether sender names render above bubbles in this
//                  chat (group setting → "On-screen Names")
//   - savedToContacts: bool (group setting → "Save to Contacts")
//
// Stored as one JSON blob per key for atomicity.

import { useSyncExternalStore } from 'react';
import { storage } from '../services/api';

const MMKV_KEY = 'chat.prefs.v1';

interface ChatPrefs {
  alias?: string;
  remark?: string;
  showNames?: boolean;
  savedToContacts?: boolean;
}

type PrefsMap = Record<string, ChatPrefs>;

let cache: PrefsMap | null = null;
const listeners = new Set<() => void>();

// Per-chat snapshot cache. useSyncExternalStore requires that getSnapshot
// return the SAME reference (by Object.is) until the store actually
// changes — otherwise React thinks the data changed on every render and
// re-renders in an infinite loop. So we hand out stable references for
// each chatId and only recompute when set() is called for that chat.
const snapshotCache = new Map<string, ChatPrefs>();
const EMPTY_PREFS: ChatPrefs = Object.freeze({});

const load = (): PrefsMap => {
  if (cache) return cache;
  try {
    const raw = storage.getString(MMKV_KEY);
    cache = raw ? (JSON.parse(raw) as PrefsMap) : {};
  } catch {
    cache = {};
  }
  return cache!;
};

const persist = (next: PrefsMap) => {
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

/** Return a stable, cached snapshot for a given chatId. */
const getSnapshot = (chatId: string): ChatPrefs => {
  let snap = snapshotCache.get(chatId);
  if (!snap) {
    const raw = load()[chatId];
    // Reuse the frozen empty object for chats with no overrides — avoids
    // allocating one per chat on first read.
    snap = raw ? { ...raw } : EMPTY_PREFS;
    snapshotCache.set(chatId, snap);
  }
  return snap;
};

export const chatPrefsStore = {
  /** Get all prefs for a chat (returns frozen empty object if unset).
   *  The returned object is a stable reference — safe for useSyncExternalStore. */
  get(chatId: string): ChatPrefs {
    return getSnapshot(chatId);
  },

  /** Merge-update a single field */
  set<K extends keyof ChatPrefs>(chatId: string, key: K, value: ChatPrefs[K]) {
    const map = load();
    const existing = map[chatId] || {};
    const next: ChatPrefs = { ...existing, [key]: value };
    // Drop the key entirely if the caller passes undefined / empty-string
    if (value === undefined || value === '' || value === null) {
      delete (next as any)[key];
    }
    map[chatId] = next;
    cache = { ...map };
    persist(cache);
    // Invalidate the cached snapshot so the next get() returns a new
    // reference and useSyncExternalStore-subscribed components re-render.
    snapshotCache.delete(chatId);
    notify();
  },

  /** Clear all prefs for a chat (e.g. on chat delete) */
  clear(chatId: string) {
    const map = load();
    if (!(chatId in map)) return;
    delete map[chatId];
    cache = { ...map };
    persist(cache);
    snapshotCache.delete(chatId);
    notify();
  },

  subscribe,
};

/** React hook — re-renders when the chat's prefs change */
export const useChatPrefs = (chatId: string | undefined): ChatPrefs => {
  // The same getSnapshot function reference is passed every call (no inline
  // arrow function allocating). It returns a stable per-chatId reference,
  // so React only re-renders when set/clear invalidates the snapshot.
  const subscribeFn = chatId ? subscribe : noopSubscribe;
  const snapshotFn = chatId ? () => getSnapshot(chatId) : emptySnapshot;
  return useSyncExternalStore(subscribeFn, snapshotFn, snapshotFn);
};

const noopSubscribe = () => () => {};
const emptySnapshot = () => EMPTY_PREFS;
