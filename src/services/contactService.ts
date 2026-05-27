import api from './api';
import type {
  ContactsResponse,
  FriendRequestsResponse,
  FriendRequestStatusResponse,
  SendFriendRequestResponse,
} from '../types';

const contactService = {
  /** GET /api/contacts — all accepted contacts */
  getContacts: async (): Promise<ContactsResponse> => {
    const { data } = await api.get<ContactsResponse>('/api/contacts');
    return data;
  },

  /** GET /api/contacts/requests — incoming friend requests */
  getPendingRequests: async (): Promise<FriendRequestsResponse> => {
    const { data } = await api.get<FriendRequestsResponse>('/api/contacts/requests');
    return data;
  },

  /** POST /api/contacts/request — send a friend request */
  sendRequest: async (userId: string): Promise<SendFriendRequestResponse> => {
    const { data } = await api.post<SendFriendRequestResponse>('/api/contacts/request', {
      userId,
    });
    return data;
  },

  /** POST /api/contacts/requests/:requestId/accept */
  acceptRequest: async (requestId: string): Promise<{ message: string }> => {
    const { data } = await api.post<{ message: string }>(
      `/api/contacts/requests/${requestId}/accept`,
    );
    return data;
  },

  /** POST /api/contacts/requests/:requestId/reject */
  rejectRequest: async (requestId: string): Promise<{ message: string }> => {
    const { data } = await api.post<{ message: string }>(
      `/api/contacts/requests/${requestId}/reject`,
    );
    return data;
  },

  /** DELETE /api/contacts/:userId — remove a contact */
  removeContact: async (userId: string): Promise<{ message: string }> => {
    const { data } = await api.delete<{ message: string }>(`/api/contacts/${userId}`);
    return data;
  },

  /** GET /api/contacts/status/:userId — get relationship status */
  getStatus: async (userId: string): Promise<FriendRequestStatusResponse> => {
    const { data } = await api.get<FriendRequestStatusResponse>(
      `/api/contacts/status/${userId}`,
    );
    return data;
  },

  /**
   * POST /api/contacts/match-phones
   * Pass an array of raw phone-book numbers. Backend hashes them and
   * returns any registered users whose stored phoneHash matches.
   */
  matchPhones: async (phones: string[]): Promise<{
    matches: Array<{
      id: string;
      username: string;
      displayName: string;
      avatar: string;
      phoneHashHex: string;
    }>;
  }> => {
    const { data } = await api.post('/api/contacts/match-phones', { phones });
    return data;
  },
};

export default contactService;
