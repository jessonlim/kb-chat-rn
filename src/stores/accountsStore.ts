// Saved accounts for the multi-account switcher (Batch 3 Phase 3).
//
// Up to 5 accounts can be kept on one device and switched between WITHOUT
// re-entering the password — we persist each account's tokens (encrypted, via
// secureStorage) plus a small summary for the UI. The ACTIVE account's tokens
// also live in secureStorage's accessToken/refreshToken (source of truth for
// the API client); switching swaps those over. See authStore for the wiring.

import { secureStorage } from '../services/secureStorage';

export interface SavedAccount {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  accessToken: string;
  refreshToken: string;
}

// What the UI needs — never expose tokens to components.
export type AccountSummary = Pick<SavedAccount, 'id' | 'username' | 'displayName' | 'avatar'>;

const LIST_KEY = 'accounts.v1';
const ACTIVE_KEY = 'accounts.activeId';
export const MAX_ACCOUNTS = 5;

const read = (): SavedAccount[] => {
  try {
    const raw = secureStorage.getItem(LIST_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const write = (list: SavedAccount[]): void => {
  secureStorage.setItem(LIST_KEY, JSON.stringify(list.slice(0, MAX_ACCOUNTS)));
};

const toSummary = (a: SavedAccount): AccountSummary => ({
  id: a.id,
  username: a.username,
  displayName: a.displayName,
  avatar: a.avatar,
});

export const accountsStore = {
  list: read,
  summaries: (): AccountSummary[] => read().map(toSummary),
  get: (id: string): SavedAccount | undefined => read().find((a) => a.id === id),
  count: (): number => read().length,
  isFull: (): boolean => read().length >= MAX_ACCOUNTS,

  // Add or update an account, moving it to the front (most-recent first).
  upsert(acct: SavedAccount): void {
    const list = read().filter((a) => a.id !== acct.id);
    list.unshift(acct);
    write(list);
  },

  // Refresh just the tokens for an account (after a token rotation or before
  // switching away from it, so its saved copy stays current).
  updateTokens(id: string, accessToken: string, refreshToken: string): void {
    const list = read();
    const a = list.find((x) => x.id === id);
    if (a) {
      a.accessToken = accessToken;
      a.refreshToken = refreshToken;
      write(list);
    }
  },

  remove(id: string): void {
    write(read().filter((a) => a.id !== id));
  },

  // Wipe all saved accounts + the active pointer (terminal logged-out state).
  clear(): void {
    secureStorage.removeItem(LIST_KEY);
    secureStorage.removeItem(ACTIVE_KEY);
  },

  getActiveId: (): string | undefined => secureStorage.getItem(ACTIVE_KEY),
  setActiveId: (id: string): void => secureStorage.setItem(ACTIVE_KEY, id),
};
