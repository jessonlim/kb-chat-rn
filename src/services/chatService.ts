import api from './api';
import type { ChatsResponse, ChatResponse, MessagesResponse, MessageResponse } from '../types';

const chatService = {
  getMyChats: async (): Promise<ChatsResponse> => {
    const { data } = await api.get<ChatsResponse>('/api/chats');
    return data;
  },

  createOrGetPrivateChat: async (userId: string): Promise<ChatResponse> => {
    const { data } = await api.post<ChatResponse>('/api/chats/private', { userId });
    return data;
  },

  getChatById: async (chatId: string): Promise<ChatResponse> => {
    const { data } = await api.get<ChatResponse>(`/api/chats/${chatId}`);
    return data;
  },

  getMessages: async (chatId: string, before?: string): Promise<MessagesResponse> => {
    const params = before ? { before } : {};
    const { data } = await api.get<MessagesResponse>(`/api/chats/${chatId}/messages`, { params });
    return data;
  },

  sendMessageRest: async (chatId: string, content: string): Promise<MessageResponse> => {
    const { data } = await api.post<MessageResponse>(`/api/chats/${chatId}/messages`, { content });
    return data;
  },

  /** Forward a message: re-send its content + attachments to another chat. */
  forwardMessageRest: async (
    chatId: string,
    body: { content?: string; type?: string; attachments?: import('../types').Attachment[] },
  ): Promise<MessageResponse> => {
    const { data } = await api.post<MessageResponse>(`/api/chats/${chatId}/messages`, body);
    return data;
  },

  createGroup: async (body: {
    groupName: string;
    memberIds: string[];
    groupImage?: string;
  }): Promise<ChatResponse> => {
    const { data } = await api.post<ChatResponse>('/api/chats/group', body);
    return data;
  },

  updateGroup: async (
    chatId: string,
    body: { groupName?: string; groupImage?: string }
  ): Promise<ChatResponse> => {
    const { data } = await api.put<ChatResponse>(`/api/chats/group/${chatId}`, body);
    return data;
  },

  addMembers: async (chatId: string, userIds: string[]): Promise<ChatResponse> => {
    const { data } = await api.post<ChatResponse>(`/api/chats/group/${chatId}/members`, { userIds });
    return data;
  },

  removeMember: async (chatId: string, userId: string): Promise<ChatResponse> => {
    const { data } = await api.delete<ChatResponse>(`/api/chats/group/${chatId}/members/${userId}`);
    return data;
  },

  leaveGroup: async (chatId: string): Promise<{ left?: boolean; deleted?: boolean }> => {
    const { data } = await api.post(`/api/chats/group/${chatId}/leave`);
    return data;
  },

  togglePin: async (chatId: string): Promise<{ ok: boolean; isPinned: boolean }> => {
    const { data } = await api.post(`/api/chats/${chatId}/pin`);
    return data;
  },

  toggleMute: async (chatId: string): Promise<{ ok: boolean; isMuted: boolean }> => {
    const { data } = await api.post(`/api/chats/${chatId}/mute`);
    return data;
  },

  deleteChatForMe: async (chatId: string): Promise<{ ok: boolean }> => {
    const { data } = await api.post(`/api/chats/${chatId}/delete-for-me`);
    return data;
  },

  markChatRead: async (chatId: string): Promise<{ ok: boolean }> => {
    const { data } = await api.post(`/api/chats/${chatId}/mark-read`);
    return data;
  },

  markChatUnread: async (chatId: string): Promise<{ ok: boolean }> => {
    const { data } = await api.post(`/api/chats/${chatId}/mark-unread`);
    return data;
  },

  toggleStar: async (chatId: string, messageId: string): Promise<{ ok: boolean; starred: boolean }> => {
    const { data } = await api.post(`/api/chats/${chatId}/messages/${messageId}/star`);
    return data;
  },

  /** GET /api/chats/:chatId/messages/search?q=... — case-insensitive search */
  searchChatMessages: async (
    chatId: string,
    query: string,
  ): Promise<{ messages: import('../types').Message[] }> => {
    const { data } = await api.get(`/api/chats/${chatId}/messages/search`, {
      params: { q: query },
    });
    return data;
  },

  /** GET /api/chats/:chatId/media — all media messages (images + videos) */
  listMediaInChat: async (
    chatId: string,
    opts?: { type?: 'image' | 'video'; before?: string; limit?: number },
  ): Promise<{ messages: import('../types').Message[] }> => {
    const { data } = await api.get(`/api/chats/${chatId}/media`, {
      params: opts,
    });
    return data;
  },
};

export default chatService;
