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

  /** GET /api/contacts/pending — incoming friend requests */
  getPendingRequests: async (): Promise<FriendRequestsResponse> => {
    const { data } = await api.get<FriendRequestsResponse>('/api/contacts/pending');
    return data;
  },

  /** POST /api/contacts/request — send a friend request */
  sendRequest: async (userId: string): Promise<SendFriendRequestResponse> => {
    const { data } = await api.post<SendFriendRequestResponse>('/api/contacts/request', {
      userId,
    });
    return data;
  },

  /** POST /api/contacts/accept — accept a pending request */
  acceptRequest: async (requestId: string): Promise<{ message: string }> => {
    const { data } = await api.post<{ message: string }>('/api/contacts/accept', {
      requestId,
    });
    return data;
  },

  /** POST /api/contacts/reject — reject a pending request */
  rejectRequest: async (requestId: string): Promise<{ message: string }> => {
    const { data } = await api.post<{ message: string }>('/api/contacts/reject', {
      requestId,
    });
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
      `/api/contacts/status/${userId}`
    );
    return data;
  },
};

export default contactService;
