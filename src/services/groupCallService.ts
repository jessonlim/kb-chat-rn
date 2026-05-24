import api from './api';
import type { User } from '../types';

// What the backend returns from POST /api/group-calls/token
export interface GroupCallTokenResponse {
  token: string;
  url: string;       // LiveKit server URL (wss://...)
  roomName: string;  // Equal to chatId
  chat: {
    _id: string;
    type: 'private' | 'group';
    groupName?: string;
    participants: User[];
  };
}

const groupCallService = {
  /**
   * Mint a LiveKit access token for the chat's group-call room.
   * The server verifies the user is a member of the chat first.
   */
  getToken: async (chatId: string): Promise<GroupCallTokenResponse> => {
    const { data } = await api.post<GroupCallTokenResponse>(
      '/api/group-calls/token',
      { chatId },
    );
    return data;
  },
};

export default groupCallService;
