import api from './api';
import type { Moment, MomentComment } from '../types';

const momentService = {
  /** GET /moments — list moments with cursor pagination */
  list: async (
    cursor?: string
  ): Promise<{ moments: Moment[]; nextCursor: string | null }> => {
    const params = cursor ? { cursor } : {};
    const { data } = await api.get<{ moments: Moment[]; nextCursor: string | null }>(
      '/api/moments',
      { params }
    );
    return data;
  },

  /** POST /moments — create a new moment */
  create: async (body: {
    content: string;
    attachments: { url: string; type: 'image' | 'video' }[];
  }): Promise<{ moment: Moment }> => {
    const { data } = await api.post<{ moment: Moment }>('/api/moments', body);
    return data;
  },

  /** DELETE /moments/:id — delete a moment */
  remove: async (id: string): Promise<void> => {
    await api.delete(`/api/moments/${id}`);
  },

  /** POST /moments/:id/like — toggle like on a moment */
  toggleLike: async (id: string): Promise<{ liked: boolean; likeCount: number }> => {
    const { data } = await api.post<{ liked: boolean; likeCount: number }>(
      `/api/moments/${id}/like`
    );
    return data;
  },

  /** POST /moments/:id/comments — add a comment to a moment */
  addComment: async (
    id: string,
    content: string
  ): Promise<{ comment: MomentComment }> => {
    const { data } = await api.post<{ comment: MomentComment }>(
      `/api/moments/${id}/comments`,
      { content }
    );
    return data;
  },

  /** DELETE /moments/:momentId/comments/:commentId — delete a comment */
  deleteComment: async (momentId: string, commentId: string): Promise<void> => {
    await api.delete(`/api/moments/${momentId}/comments/${commentId}`);
  },
};

export default momentService;
