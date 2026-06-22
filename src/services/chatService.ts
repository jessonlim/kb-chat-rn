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

  /** Edit a sent text message (REST). The backend enforces the 15-minute edit
   *  window and broadcasts `message_edited` to participants. Throws on failure —
   *  err.response.data.code === 'edit_window_expired' when the window has passed. */
  editMessageRest: async (chatId: string, messageId: string, content: string): Promise<void> => {
    await api.patch(`/api/chats/${chatId}/messages/${messageId}`, { content });
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

  /** Join a group via its QR / invite link (chatId is the invite token). Idempotent. */
  joinGroup: async (chatId: string): Promise<ChatResponse & { joined?: boolean }> => {
    const { data } = await api.post<ChatResponse & { joined?: boolean }>(`/api/chats/group/${chatId}/join`);
    return data;
  },

  /** Admin: regenerate the group's invite token (old link/QR stops working). */
  resetGroupInviteToken: async (chatId: string): Promise<{ inviteToken: string }> => {
    const { data } = await api.post<{ inviteToken: string }>(`/api/chats/group/${chatId}/reset-invite-token`);
    return data;
  },

  /** Owner: promote a member to admin. */
  promoteAdmin: async (chatId: string, userId: string): Promise<ChatResponse> => {
    const { data } = await api.post<ChatResponse>(`/api/chats/group/${chatId}/admins`, { userId });
    return data;
  },

  /** Owner: demote an admin back to a regular member. */
  demoteAdmin: async (chatId: string, userId: string): Promise<ChatResponse> => {
    const { data } = await api.delete<ChatResponse>(`/api/chats/group/${chatId}/admins/${userId}`);
    return data;
  },

  /** Admin: pin (pinned=true) or unpin (pinned=false) one message; null messageId clears all. */
  setPinnedMessage: async (
    chatId: string,
    messageId: string | null,
    pinned = true
  ): Promise<{ ok: boolean }> => {
    const { data } = await api.post(`/api/chats/${chatId}/pinned-message`, { messageId, pinned });
    return data;
  },

  /** Admin: set or clear the group announcement. */
  setAnnouncement: async (chatId: string, announcement: string): Promise<{ ok: boolean; announcement: string }> => {
    const { data } = await api.put(`/api/chats/${chatId}/announcement`, { announcement });
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

  /** GET /api/chats/:id/export-transcript — full chat history as plain text.
   *  tz = caller's offset in minutes east of UTC so times read in local time. */
  exportChat: async (
    chatId: string,
  ): Promise<{ transcript: string; chatName: string; exportedAt: string; count: number }> => {
    const tz = -new Date().getTimezoneOffset();
    const { data } = await api.get(`/api/chats/${chatId}/export-transcript`, { params: { tz } });
    return data;
  },

  /** GET /api/chats/hidden — list chats the current user has hidden */
  listHiddenChats: async (): Promise<ChatsResponse> => {
    const { data } = await api.get<ChatsResponse>('/api/chats/hidden');
    return data;
  },

  /** POST /api/chats/:id/unhide — restore a previously hidden chat */
  unhideChat: async (chatId: string): Promise<{ ok: boolean }> => {
    const { data } = await api.post(`/api/chats/${chatId}/unhide`);
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

  /** GET /api/starred-messages — every message the user has starred across
   *  all chats. Each message is populated with its sender and a slim chat
   *  object ({ type, groupName, participants }). */
  getStarredMessages: async (): Promise<{ messages: import('../types').Message[] }> => {
    const { data } = await api.get('/api/starred-messages');
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

  /** GET /api/chats/search-messages?q=... — search message content across ALL my chats */
  searchMessagesGlobal: async (
    query: string,
  ): Promise<{ messages: import('../types').Message[] }> => {
    const { data } = await api.get('/api/chats/search-messages', { params: { q: query } });
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

  /** POST /api/chats/messages/:id/translate — get translated text + detected source lang.
   * Falls back to a free public endpoint if the backend route isn't ready. */
  translateMessage: async (
    messageId: string,
    targetLang: string,
  ): Promise<{ translation: string; detectedLang?: string }> => {
    try {
      const { data } = await api.post(`/api/chats/messages/${messageId}/translate`, {
        target: targetLang,
      });
      return data;
    } catch (err: any) {
      // Backend not yet wired? Re-throw so the caller can show an error toast.
      throw err;
    }
  },

  /** POST /api/chats/messages/:id/transcribe — Whisper-style voice-to-text. */
  transcribeMessage: async (
    messageId: string,
  ): Promise<{ text: string }> => {
    const { data } = await api.post(`/api/chats/messages/${messageId}/transcribe`);
    return data;
  },

  /** GET /api/chats/messages/:id/info — full delivery + read receipt list. */
  getMessageInfo: async (
    messageId: string,
  ): Promise<{
    readBy: Array<{ user: import('../types').User; readAt: string }>;
    deliveredTo: Array<{ user: import('../types').User; deliveredAt: string }>;
  }> => {
    const { data } = await api.get(`/api/chats/messages/${messageId}/info`);
    return data;
  },
};

export default chatService;
