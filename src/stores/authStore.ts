// Auth state — manages user session, login/register, token storage.
// Uses React Context (same pattern as the Capacitor app).

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import { storage } from '../services/api';
import { authEvents } from '../services/authEvents';
import { getDeviceId } from '../services/device';
import { secureStorage, initSecureStorage } from '../services/secureStorage';
import { tStatic } from '../i18n/I18nContext';
import * as authService from '../services/authService';
import socketService from '../services/socketService';
import notificationService from '../services/notificationService';
import { setSentryUser, clearSentryUser } from '../services/sentry';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { username: string; email: string; password: string; displayName?: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

export const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  updateUser: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const useAuthProvider = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
      } catch {
        // Token expired or invalid — clear it
        secureStorage.clearAll();
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

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

    socket.on('force_logout', onForceLogout);
    return () => { socket.off('force_logout', onForceLogout); };
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

  const login = useCallback(async (email: string, password: string) => {
    const res = await authService.login({ email, password });
    secureStorage.setToken('accessToken', res.accessToken);
    secureStorage.setToken('refreshToken', res.refreshToken);
    setUser(res.user);
    setSentryUser(res.user);
    socketService.connect();
  }, []);

  const register = useCallback(async (data: {
    username: string;
    email: string;
    password: string;
    displayName?: string;
  }) => {
    const res = await authService.register(data);
    secureStorage.setToken('accessToken', res.accessToken);
    secureStorage.setToken('refreshToken', res.refreshToken);
    setUser(res.user);
    setSentryUser(res.user);
    socketService.connect();
  }, []);

  const logout = useCallback(async () => {
    try {
      await notificationService.unregisterToken();
    } catch {}
    try {
      await authService.logout();
    } catch {
      // Best-effort — even if the API call fails, still clear local state
    }
    secureStorage.clearAll();
    socketService.disconnect();
    setUser(null);
    clearSentryUser();
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  return { user, loading, login, register, logout, updateUser };
};
