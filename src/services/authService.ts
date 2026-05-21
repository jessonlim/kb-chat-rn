import api from './api';
import type { AuthResponse, User } from '../types';

export const register = async (data: {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}): Promise<AuthResponse> => {
  const res = await api.post('/api/auth/register', data);
  return res.data;
};

export const login = async (data: {
  email: string;
  password: string;
}): Promise<AuthResponse> => {
  const res = await api.post('/api/auth/login', data);
  return res.data;
};

export const logout = async (): Promise<void> => {
  await api.post('/api/auth/logout');
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
