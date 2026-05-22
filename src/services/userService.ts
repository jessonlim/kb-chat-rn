import api from './api';
import type { User, UsersSearchResponse } from '../types';

interface UserProfileResponse {
  user: User;
}

interface UpdateProfileBody {
  displayName?: string;
  about?: string;
}

const userService = {
  searchUsers: async (query: string): Promise<UsersSearchResponse> => {
    const { data } = await api.get<UsersSearchResponse>('/api/users/search', {
      params: { q: query },
    });
    return data;
  },

  /** GET /api/users/:userId — full profile for another user */
  getUserById: async (userId: string): Promise<UserProfileResponse> => {
    const { data } = await api.get<UserProfileResponse>(`/api/users/${userId}`);
    return data;
  },

  /** PUT /api/users/profile — update own profile (JSON body) */
  updateProfile: async (body: UpdateProfileBody): Promise<UserProfileResponse> => {
    const { data } = await api.put<UserProfileResponse>('/api/users/profile', body);
    return data;
  },

  /** PUT /api/users/profile — update own profile with avatar (multipart) */
  updateProfileWithAvatar: async (
    fileUri: string,
    fileName: string,
    mimeType: string,
    body: UpdateProfileBody
  ): Promise<UserProfileResponse> => {
    const formData = new FormData();
    formData.append('avatar', {
      uri: fileUri,
      type: mimeType,
      name: fileName,
    } as any);
    if (body.displayName !== undefined) formData.append('displayName', body.displayName);
    if (body.about !== undefined) formData.append('about', body.about);

    const { data } = await api.put<UserProfileResponse>('/api/users/profile', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  /** GET /api/users/privacy — read current friend-request policy */
  getPrivacy: async (): Promise<{ friendRequestPolicy: 'anyone' | 'friends_of_friends' | 'nobody' }> => {
    const { data } = await api.get('/api/users/privacy');
    return data;
  },

  /** PUT /api/users/privacy — update friend-request policy */
  setPrivacy: async (
    friendRequestPolicy: 'anyone' | 'friends_of_friends' | 'nobody'
  ): Promise<void> => {
    await api.put('/api/users/privacy', { friendRequestPolicy });
  },
};

export default userService;
