// Auth state — manages user session, login/register, token storage.
// Uses React Context (same pattern as the Capacitor app).

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { storage } from '../services/api';
import * as authService from '../services/authService';
import socketService from '../services/socketService';
import notificationService from '../services/notificationService';
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
        const token = storage.getString('accessToken');
        if (!token) {
          setLoading(false);
          return;
        }
        const { user: me } = await authService.getMe();
        setUser(me);
        socketService.connect();
      } catch {
        // Token expired or invalid — clear it
        storage.delete('accessToken');
        storage.delete('refreshToken');
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

    const onForceLogout = () => {
      storage.delete('accessToken');
      storage.delete('refreshToken');
      socketService.disconnect();
      setUser(null);
      // Toast will be shown by the component that handles this
    };

    socket.on('force_logout', onForceLogout);
    return () => { socket.off('force_logout', onForceLogout); };
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authService.login({ email, password });
    storage.set('accessToken', res.accessToken);
    storage.set('refreshToken', res.refreshToken);
    setUser(res.user);
    socketService.connect();
  }, []);

  const register = useCallback(async (data: {
    username: string;
    email: string;
    password: string;
    displayName?: string;
  }) => {
    const res = await authService.register(data);
    storage.set('accessToken', res.accessToken);
    storage.set('refreshToken', res.refreshToken);
    setUser(res.user);
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
    storage.delete('accessToken');
    storage.delete('refreshToken');
    socketService.disconnect();
    setUser(null);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  return { user, loading, login, register, logout, updateUser };
};
