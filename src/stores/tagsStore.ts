// Contact tags store — user-private grouping (e.g. "Family", "Work", "Uni").
// Each contact can be in zero or more tags. Like remarks, this is
// local-only via MMKV — no cross-device sync yet.

import { useSyncExternalStore } from 'react';
import { storage } from '../services/api';

const MMKV_KEY = 'contacts.tags.v1';

// { tagName: [userId, userId, ...] }
type TagMap = Record<string, string[]>;

let cache: TagMap | null = null;
const listeners = new Set<() => void>();

const load = (): TagMap => {
  if (cache) return cache;
  try {
    const raw = storage.getString(MMKV_KEY);
    cache = raw ? (JSON.parse(raw) as TagMap) : {};
  } catch {
    cache = {};
  }
  return cache!;
};

const persist = (next: TagMap) => {
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

export const tagsStore = {
  /** Get all tag names */
  tags(): string[] {
    return Object.keys(load()).sort((a, b) => a.localeCompare(b));
  },

  /** Get the user IDs in a given tag */
  contactsIn(tag: string): string[] {
    return [...(load()[tag] || [])];
  },

  /** Get the tags a given contact is in */
  tagsOf(userId: string): string[] {
    const map = load();
    return Object.keys(map)
      .filter((t) => map[t].includes(userId))
      .sort((a, b) => a.localeCompare(b));
  },

  /** Create a new (empty) tag. No-op if it already exists. */
  createTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const map = load();
    if (!map[trimmed]) {
      map[trimmed] = [];
      cache = { ...map };
      persist(cache);
      notify();
    }
  },

  /** Delete a tag entirely */
  deleteTag(tag: string) {
    const map = load();
    if (!(tag in map)) return;
    delete map[tag];
    cache = { ...map };
    persist(cache);
    notify();
  },

  /** Add a contact to a tag (auto-creates tag if missing) */
  addToTag(tag: string, userId: string) {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const map = load();
    if (!map[trimmed]) map[trimmed] = [];
    if (!map[trimmed].includes(userId)) {
      map[trimmed] = [...map[trimmed], userId];
      cache = { ...map };
      persist(cache);
      notify();
    }
  },

  /** Remove a contact from a tag */
  removeFromTag(tag: string, userId: string) {
    const map = load();
    if (!map[tag]) return;
    if (map[tag].includes(userId)) {
      map[tag] = map[tag].filter((id) => id !== userId);
      cache = { ...map };
      persist(cache);
      notify();
    }
  },

  subscribe,
};

/** React hook — re-renders when the tags map changes */
export const useTagsSnapshot = () =>
  useSyncExternalStore(
    subscribe,
    () => load(),
    () => load(),
  );
