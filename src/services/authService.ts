import api from './api';
import { deviceMeta } from './device';
import type { AuthResponse, User } from '../types';

export const register = async (data: {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}): Promise<AuthResponse> => {
  const res = await api.post('/api/auth/register', { ...data, ...deviceMeta() });
  return res.data;
};

// Returns tokens, OR { twoFaRequired, challengeToken } when this account has 2FA
// on and this is a new device (Phase 4) — then call verifyTwoFaLogin.
export const login = async (data: {
  email: string;
  password: string;
}): Promise<AuthResponse | { twoFaRequired: true; challengeToken: string }> => {
  const res = await api.post('/api/auth/login', { ...data, ...deviceMeta() });
  return res.data;
};

// ─── Two-factor auth (Phase 4) ───────────────────────────────────────
export const verifyTwoFaLogin = async (challengeToken: string, code: string): Promise<AuthResponse> => {
  const res = await api.post('/api/auth/2fa/verify-login', { challengeToken, code, ...deviceMeta() });
  return res.data;
};
export const twoFaStatus = async (): Promise<{ enabled: boolean }> => {
  const res = await api.get('/api/auth/2fa/status');
  return res.data;
};
export const twoFaSetup = async (): Promise<{ secret: string; otpauth: string }> => {
  const res = await api.post('/api/auth/2fa/setup');
  return res.data;
};
export const twoFaEnable = async (code: string): Promise<void> => {
  await api.post('/api/auth/2fa/enable', { code });
};
export const twoFaDisable = async (code: string): Promise<void> => {
  await api.post('/api/auth/2fa/disable', { code });
};

export const logout = async (): Promise<void> => {
  await api.post('/api/auth/logout');
};

// Web QR login (Batch 3 Phase 2): the phone approves a web login it scanned.
export const approveWebLogin = async (token: string): Promise<void> => {
  await api.post('/api/auth/qr/approve', { token });
};

// Phase 2b: the phone rejects a credential web login it was asked to approve.
export const denyWebLogin = async (token: string): Promise<void> => {
  await api.post('/api/auth/qr/deny', { token });
};

export const getMe = async (): Promise<{ user: User }> => {
  const res = await api.get('/api/auth/me');
  return res.data;
};

export const changePassword = async (data: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> => {
  await api.put('/api/auth/change-password', data);
};

export const deleteAccount = async (password: string): Promise<void> => {
  await api.post('/api/auth/delete-account', { password });
};

export const blockUser = async (userId: string): Promise<void> => {
  await api.post(`/api/auth/block/${userId}`);
};

export const unblockUser = async (userId: string): Promise<void> => {
  await api.post(`/api/auth/unblock/${userId}`);
};

export const listBlockedUsers = async (): Promise<{ users: User[] }> => {
  const res = await api.get('/api/auth/blocked-users');
  return res.data;
};
