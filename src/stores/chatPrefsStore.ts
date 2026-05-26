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

export const chatPrefsStore = {
  /** Get all prefs for a chat (empty object if unset) */
  get(chatId: string): ChatPrefs {
    return { ...(load()[chatId] || {}) };
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
    notify();
  },

  /** Clear all prefs for a chat (e.g. on chat delete) */
  clear(chatId: string) {
    const map = load();
    if (!(chatId in map)) return;
    delete map[chatId];
    cache = { ...map };
    persist(cache);
    notify();
  },

  subscribe,
};

/** React hook — re-renders when the chat's prefs change */
export const useChatPrefs = (chatId: string | undefined): ChatPrefs =>
  useSyncExternalStore(
    subscribe,
    () => (chatId ? chatPrefsStore.get(chatId) : {}),
    () => (chatId ? chatPrefsStore.get(chatId) : {}),
  );
