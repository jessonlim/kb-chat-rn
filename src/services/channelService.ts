import api from './api';
import type { Channel, ChannelPost, ChannelComment } from '../types';

const channelService = {
  /** GET /channels — list all public channels */
  listAll: async (): Promise<{ channels: Channel[] }> => {
    const { data } = await api.get<{ channels: Channel[] }>('/api/channels');
    return data;
  },

  /** GET /channels/mine — list channels I own or subscribe to */
  listMine: async (): Promise<{ channels: Channel[] }> => {
    const { data } = await api.get<{ channels: Channel[] }>('/api/channels/mine');
    return data;
  },

  /** GET /channels/:id — get single channel */
  get: async (id: string): Promise<{ channel: Channel }> => {
    const { data } = await api.get<{ channel: Channel }>(`/api/channels/${id}`);
    return data;
  },

  /** POST /channels — create a new channel */
  create: async (body: {
    name: string;
    description?: string;
    avatar?: string;
  }): Promise<{ channel: Channel }> => {
    const { data } = await api.post<{ channel: Channel }>('/api/channels', body);
    return data;
  },

  /** PUT /channels/:id — update channel details */
  update: async (
    id: string,
    body: { description?: string; avatar?: string }
  ): Promise<{ channel: Channel }> => {
    const { data } = await api.put<{ channel: Channel }>(`/api/channels/${id}`, body);
    return data;
  },

  /** DELETE /channels/:id — delete a channel */
  remove: async (id: string): Promise<void> => {
    await api.delete(`/api/channels/${id}`);
  },

  /** POST /channels/:id/subscribe — subscribe to a channel */
  subscribe: async (id: string): Promise<{ subscriberCount: number }> => {
    const { data } = await api.post<{ subscriberCount: number }>(
      `/api/channels/${id}/subscribe`
    );
    return data;
  },

  /** POST /channels/:id/unsubscribe — unsubscribe from a channel */
  unsubscribe: async (id: string): Promise<{ subscriberCount: number }> => {
    const { data } = await api.post<{ subscriberCount: number }>(
      `/api/channels/${id}/unsubscribe`
    );
    return data;
  },

  /** GET /channels/:id/posts — list posts with cursor pagination */
  listPosts: async (
    id: string,
    cursor?: string
  ): Promise<{ posts: ChannelPost[]; nextCursor: string | null }> => {
    const params = cursor ? { cursor } : {};
    const { data } = await api.get<{ posts: ChannelPost[]; nextCursor: string | null }>(
      `/api/channels/${id}/posts`,
      { params }
    );
    return data;
  },

  /** POST /channels/:id/posts — create a post in a channel */
  createPost: async (
    id: string,
    body: { content: string; attachments: { url: string; type: 'image' | 'video' }[] }
  ): Promise<{ post: ChannelPost }> => {
    const { data } = await api.post<{ post: ChannelPost }>(
      `/api/channels/${id}/posts`,
      body
    );
    return data;
  },

  /** DELETE /channels/:channelId/posts/:postId — delete a post */
  deletePost: async (channelId: string, postId: string): Promise<void> => {
    await api.delete(`/api/channels/${channelId}/posts/${postId}`);
  },

  /** POST /channels/:channelId/posts/:postId/like — toggle like on a post */
  togglePostLike: async (
    channelId: string,
    postId: string
  ): Promise<{ liked: boolean; likeCount: number }> => {
    const { data } = await api.post<{ liked: boolean; likeCount: number }>(
      `/api/channels/${channelId}/posts/${postId}/like`
    );
    return data;
  },

  /** GET /channels/:channelId/posts/:postId/comments — list comments with cursor */
  listComments: async (
    channelId: string,
    postId: string,
    cursor?: string
  ): Promise<{ comments: ChannelComment[]; nextCursor: string | null }> => {
    const params = cursor ? { cursor } : {};
    const { data } = await api.get<{ comments: ChannelComment[]; nextCursor: string | null }>(
      `/api/channels/${channelId}/posts/${postId}/comments`,
      { params }
    );
    return data;
  },

  /** POST /channels/:channelId/posts/:postId/comments — add a comment */
  addComment: async (
    channelId: string,
    postId: string,
    content: string
  ): Promise<{ comment: ChannelComment; commentCount: number }> => {
    const { data } = await api.post<{ comment: ChannelComment; commentCount: number }>(
      `/api/channels/${channelId}/posts/${postId}/comments`,
      { content }
    );
    return data;
  },

  /** DELETE /channels/:channelId/posts/:postId/comments/:commentId — delete a comment */
  deleteComment: async (
    channelId: string,
    postId: string,
    commentId: string
  ): Promise<{ commentCount: number }> => {
    const { data } = await api.delete<{ commentCount: number }>(
      `/api/channels/${channelId}/posts/${postId}/comments/${commentId}`
    );
    return data;
  },
};

export default channelService;
