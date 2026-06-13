// Auth state — manages user session, login/register, token storage.
// Uses React Context (same pattern as the Capacitor app).

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import { storage } from '../services/api';
import { authEvents } from '../services/authEvents';
import { getDeviceId } from '../services/device';
import { secureStorage, initSecureStorage } from '../services/secureStorage';
import { accountsStore, MAX_ACCOUNTS, type AccountSummary, type SavedAccount } from './accountsStore';
import { tStatic } from '../i18n/I18nContext';
import * as authService from '../services/authService';
import socketService from '../services/socketService';
import notificationService from '../services/notificationService';
import { setSentryUser, clearSentryUser } from '../services/sentry';
import type { AuthResponse, User } from '../types';

// What login() resolves to. Empty object = signed in. When the account has 2FA
// on and this is a new device, the server withholds tokens and returns a
// challenge — the caller then collects a code and calls verifyTwoFa.
export interface LoginResult {
  twoFaRequired?: boolean;
  challengeToken?: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyTwoFa: (challengeToken: string, code: string) => Promise<void>;
  register: (data: { username: string; email: string; password: string; displayName?: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  // Multi-account (Phase 3): up to 5 accounts on one device.
  accounts: AccountSummary[];
  addingAccount: boolean;
  switchAccount: (id: string) => Promise<void>;
  beginAddAccount: () => boolean; // returns false if already at the 5-account limit
  cancelAddAccount: () => void;
  removeAccount: (id: string) => Promise<void>;
}

export const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  login: async () => ({}),
  verifyTwoFa: async () => {},
  register: async () => {},
  logout: async () => {},
  updateUser: () => {},
  accounts: [],
  addingAccount: false,
  switchAccount: async () => {},
  beginAddAccount: () => false,
  cancelAddAccount: () => {},
  removeAccount: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const useAuthProvider = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  // When true, show the login screen even though another account is signed in
  // (so the user can ADD an account without losing the current one).
  const [addingAccount, setAddingAccount] = useState(false);

  const refreshAccounts = useCallback(() => setAccounts(accountsStore.summaries()), []);

  // Persist the active account's current (possibly just-refreshed) tokens into
  // its saved-accounts entry. Call before switching away so the copy stays fresh.
  const syncActiveTokens = useCallback(() => {
    const id = accountsStore.getActiveId();
    const at = secureStorage.getToken('accessToken');
    const rt = secureStorage.getToken('refreshToken');
    if (id && at && rt) accountsStore.updateTokens(id, at, rt);
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const init = async () => {
      try {
        // Initialise encryption + run plaintext-token migration BEFORE
        // we try to read any token. On first launch with this build,
        // initSecureStorage moves the existing access/refresh tokens
        // from plain MMKV into the encrypted instance and deletes the
        // plaintext copies. Subsequent launches just open the
        // encrypted instance.
        await initSecureStorage();

        const token = secureStorage.getToken('accessToken');
        if (!token) {
          setLoading(false);
          return;
        }
        const { user: me } = await authService.getMe();
        setUser(me);
        setSentryUser(me);
        socketService.connect();
        // Register the signed-in user in the saved-accounts list (migrates
        // existing single-account users into the switcher). Read tokens AFTER
        // getMe in case the refresh interceptor rotated them.
        const at = secureStorage.getToken('accessToken');
        const rt = secureStorage.getToken('refreshToken');
        if (at && rt) {
          accountsStore.upsert({
            id: me.id, username: me.username, displayName: me.displayName,
            avatar: me.avatar, accessToken: at, refreshToken: rt,
          });
          accountsStore.setActiveId(me.id);
        }
      } catch {
        // Token expired or invalid — clear it
        secureStorage.clearAll();
      } finally {
        refreshAccounts();
        setLoading(false);
      }
    };
    init();
  }, [refreshAccounts]);

  // Listen for force_logout (single-session enforcement)
  useEffect(() => {
    if (!user) return;
    const socket = socketService.getSocket();
    if (!socket) return;

    const onForceLogout = (payload?: { deviceIds?: string[] }) => {
      // Targeted kick (Batch 3): when the server names the kicked devices, only
      // log out if WE are one of them — so a login on another phone doesn't sign
      // out a different device. No deviceIds = a blanket logout (legacy) → apply.
      if (
        payload?.deviceIds &&
        payload.deviceIds.length > 0 &&
        !payload.deviceIds.includes(getDeviceId())
      ) {
        return;
      }
      secureStorage.clearAll();
      socketService.disconnect();
      setUser(null);
      // Tell the user WHY they landed back on the login screen — their account
      // was just signed in on another device (one phone per account).
      Alert.alert(tStatic('auth.kickedTitle'), tStatic('auth.kickedMessage'));
    };

    // Phase 2b: this phone is the main device — approve/deny a web login that
    // someone started with this account's email + password.
    const onWebLoginRequest = (payload?: { token?: string; deviceName?: string }) => {
      if (!payload?.token) return;
      const token = payload.token;
      Alert.alert(
        tStatic('qr.webReqTitle'),
        tStatic('qr.webReqMessage'),
        [
          {
            text: tStatic('qr.webReqDeny'),
            style: 'cancel',
            onPress: () => { authService.denyWebLogin(token).catch(() => {}); },
          },
          {
            text: tStatic('qr.webReqApprove'),
            onPress: () => {
              authService.approveWebLogin(token)
                .then(() => Toast.show({ type: 'success', text1: tStatic('qr.webLoginSuccess') }))
                .catch((e: any) =>
                  Toast.show({ type: 'error', text1: e?.response?.data?.message || tStatic('qr.webLoginFailed') })
                );
            },
          },
        ],
      );
    };

    socket.on('force_logout', onForceLogout);
    socket.on('web_login_request', onWebLoginRequest);
    return () => {
      socket.off('force_logout', onForceLogout);
      socket.off('web_login_request', onWebLoginRequest);
    };
  }, [user]);

  // Listen for `session_expired` from the axios refresh interceptor.
  // Triggered when the refresh-token flow gives up (M8 fix). Without
  // this subscription, the interceptor would clear tokens silently and
  // leave the auth state still believing the user was logged in,
  // producing a permanently broken shell.
  useEffect(() => {
    const off = authEvents.on('session_expired', () => {
      // Defensive — tokens are usually already cleared by the
      // interceptor, but call again so a future refactor that
      // fires this event from elsewhere can rely on a clean state.
      secureStorage.clearAll();
      socketService.disconnect();
      clearSentryUser();
      setUser(null);
      Toast.show({
        type: 'error',
        text1: tStatic('auth.sessionExpired'),
        text2: tStatic('auth.signInAgain'),
        visibilityTime: 5000,
      });
    });
    return off;
  }, []);

  const saveActiveAccount = useCallback((res: { user: User; accessToken: string; refreshToken: string }) => {
    accountsStore.upsert({
      id: res.user.id, username: res.user.username, displayName: res.user.displayName,
      avatar: res.user.avatar, accessToken: res.accessToken, refreshToken: res.refreshToken,
    });
    accountsStore.setActiveId(res.user.id);
    setAddingAccount(false);
    refreshAccounts();
  }, [refreshAccounts]);

  // Bring a fresh session up from a token-bearing auth response (shared by the
  // password login, the 2FA verify step, and register).
  const applyAuthResponse = useCallback((res: AuthResponse) => {
    // Persist the OUTGOING account's latest tokens before we overwrite them, so
    // switching back to it later uses a valid (non-rotated) refresh token.
    syncActiveTokens();
    secureStorage.setToken('accessToken', res.accessToken);
    secureStorage.setToken('refreshToken', res.refreshToken);
    setUser(res.user);
    setSentryUser(res.user);
    socketService.connect();
    saveActiveAccount(res);
  }, [saveActiveAccount, syncActiveTokens]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const res = await authService.login({ email, password });
    // 2FA gate: server withheld tokens and handed back a challenge instead.
    if ('twoFaRequired' in res) {
      return { twoFaRequired: true, challengeToken: res.challengeToken };
    }
    applyAuthResponse(res);
    return {};
  }, [applyAuthResponse]);

  // Finish a 2FA login: exchange the challenge token + authenticator code for
  // real session tokens.
  const verifyTwoFa = useCallback(async (challengeToken: string, code: string) => {
    const res = await authService.verifyTwoFaLogin(challengeToken, code);
    applyAuthResponse(res);
  }, [applyAuthResponse]);

  const register = useCallback(async (data: {
    username: string;
    email: string;
    password: string;
    displayName?: string;
  }) => {
    const res = await authService.register(data);
    applyAuthResponse(res);
  }, [applyAuthResponse]);

  // Load a saved account's tokens and bring its session up. PURE: returns
  // true/false and does NOT mutate the accounts list on failure — the caller
  // decides recovery. Token validation guards against a corrupt saved blob.
  const activate = useCallback(async (acct: SavedAccount): Promise<boolean> => {
    if (!acct.accessToken || !acct.refreshToken) return false;
    secureStorage.setToken('accessToken', acct.accessToken);
    secureStorage.setToken('refreshToken', acct.refreshToken);
    accountsStore.setActiveId(acct.id);
    socketService.disconnect();
    try {
      const { user: me } = await authService.getMe();
      setUser(me);
      setSentryUser(me);
      socketService.connect();
      syncActiveTokens(); // getMe may have rotated tokens — persist the latest
      return true;
    } catch {
      return false;
    }
  }, [syncActiveTokens]);

  // Try each saved account in turn; the first that works becomes active. Dead
  // (revoked/expired) accounts are dropped along the way. False if none work.
  const activateFirstWorking = useCallback(async (): Promise<boolean> => {
    for (const acct of accountsStore.list()) {
      if (await activate(acct)) return true;
      accountsStore.remove(acct.id);
    }
    return false;
  }, [activate]);

  // Terminal logged-out state: forget everything and show the login screen.
  const enterLoggedOut = useCallback(() => {
    accountsStore.clear();
    secureStorage.clearAll();
    socketService.disconnect();
    setUser(null);
    clearSentryUser();
  }, []);

  const switchAccount = useCallback(async (id: string) => {
    if (id === accountsStore.getActiveId()) return;
    const target = accountsStore.get(id);
    if (!target) return;
    setLoading(true);
    try {
      syncActiveTokens(); // save the current account's latest tokens first
      if (await activate(target)) {
        refreshAccounts();
        return;
      }
      // Target's session is dead — drop it and fall back to any working account
      // (handles the case where the one we came from was also revoked).
      Toast.show({ type: 'error', text1: tStatic('account.switchFailed') });
      accountsStore.remove(target.id);
      if (!(await activateFirstWorking())) enterLoggedOut();
      refreshAccounts();
    } finally {
      setLoading(false);
    }
  }, [activate, activateFirstWorking, enterLoggedOut, refreshAccounts, syncActiveTokens]);

  const beginAddAccount = useCallback((): boolean => {
    if (accountsStore.count() >= MAX_ACCOUNTS) {
      Toast.show({ type: 'info', text1: tStatic('account.limitReached') });
      return false;
    }
    setAddingAccount(true);
    return true;
  }, []);

  const cancelAddAccount = useCallback(() => setAddingAccount(false), []);

  // Log out / forget an account. Removing the ACTIVE account ends its session
  // and falls back to the next working saved account (or the login screen).
  const removeAccount = useCallback(async (id: string) => {
    if (id !== accountsStore.getActiveId()) {
      accountsStore.remove(id); // background account → just forget it locally
      refreshAccounts();
      return;
    }
    try { await notificationService.unregisterToken(); } catch {}
    try { await authService.logout(); } catch {}
    accountsStore.remove(id);
    setLoading(true);
    try {
      if (!(await activateFirstWorking())) enterLoggedOut();
      refreshAccounts();
    } finally {
      setLoading(false);
    }
  }, [activateFirstWorking, enterLoggedOut, refreshAccounts]);

  const logout = useCallback(async () => {
    const activeId = accountsStore.getActiveId();
    if (activeId) {
      await removeAccount(activeId);
      return;
    }
    // No tracked active account — plain logout.
    try { await notificationService.unregisterToken(); } catch {}
    try { await authService.logout(); } catch {}
    enterLoggedOut();
  }, [removeAccount, enterLoggedOut]);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
    // Keep the switcher's summary (name/avatar) in sync with profile edits.
    const id = accountsStore.getActiveId();
    if (id) {
      const a = accountsStore.get(id);
      if (a) {
        accountsStore.upsert({ ...a, ...updates } as SavedAccount);
        refreshAccounts();
      }
    }
  }, [refreshAccounts]);

  return {
    user, loading, login, verifyTwoFa, register, logout, updateUser,
    accounts, addingAccount, switchAccount, beginAddAccount, cancelAddAccount, removeAccount,
  };
};
