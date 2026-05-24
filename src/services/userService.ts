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
    // Backend's PUT /api/users/profile takes the avatar as a URL string
    // (not a file). So we upload the file separately to /api/uploads first,
    // then send the returned URL with the rest of the profile fields.
    const { uploadFile } = await import('./uploadService');
    const uploaded = await uploadFile(fileUri, fileName, mimeType);
    const { data } = await api.put<UserProfileResponse>('/api/users/profile', {
      ...body,
      avatar: uploaded.url,
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
