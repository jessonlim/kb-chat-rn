import api from './api';
import type { UsersSearchResponse } from '../types';

const userService = {
  searchUsers: async (query: string): Promise<UsersSearchResponse> => {
    const { data } = await api.get<UsersSearchResponse>('/api/users/search', {
      params: { q: query },
    });
    return data;
  },
};

export default userService;
