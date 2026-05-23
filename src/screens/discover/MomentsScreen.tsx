import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import momentService from '../../services/momentService';
import { useAuth } from '../../stores/authStore';
import { useMediaUrl } from '../../hooks/useMediaUrl';
import Avatar from '../../components/common/Avatar';
import { useT } from '../../i18n/I18nContext';
import { colors, spacing, fontSize, borderRadius } from '../../utils/theme';
import type { Moment, MomentComment } from '../../types';

interface Props {
  navigation: any;
}

type TFn = (key: any, vars?: Record<string, string | number>) => string;

// ── Time formatter ──────────────────────────────────────────────────
const formatRelative = (iso: string, t: TFn): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return t('moments.justNow');
  if (min < 60) return t('moments.minutesAgo', { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('moments.hoursAgo', { n: hr });
  const day = Math.floor(hr / 24);
  if (day < 30) return t('moments.daysAgo', { n: day });
  return new Date(iso).toLocaleDateString();
};

// ── Moment image component ──────────────────────────────────────────
const MomentImage = ({ url }: { url: string }) => {
  const { uri, loading } = useMediaUrl(url);

  if (loading || !uri) {
    return (
      <View style={imgStyles.placeholder}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <Image source={{ uri }} style={imgStyles.image} resizeMode="cover" />
  );
};

const imgStyles = StyleSheet.create({
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: borderRadius.md,
  },
  placeholder: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── Moment card ─────────────────────────────────────────────────────
const MomentCard = ({
  moment,
  currentUserId,
  onLike,
  onComment,
  onDelete,
  onDeleteComment,
}: {
  moment: Moment;
  currentUserId: string;
  onLike: () => void;
  onComment: (content: string) => void;
  onDelete: () => void;
  onDeleteComment: (commentId: string) => void;
}) => {
  const { t } = useT();
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const liked = moment.likes.includes(currentUserId);
  const isMine = moment.author._id === currentUserId;

  const handleSubmitComment = () => {
    const trimmed = commentText.trim();
    if (!trimmed) return;
    onComment(trimmed);
    setCommentText('');
    setCommentOpen(false);
  };

  const imageAttachments = moment.attachments.filter(
    (a) => a.type === 'image'
  );

  return (
    <View style={cardStyles.container}>
      {/* Author */}
      <View style={cardStyles.authorRow}>
        <Avatar
          name={moment.author.displayName || moment.author.username}
          src={moment.author.avatar}
          size={40}
        />
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.authorName}>
            {moment.author.displayName || moment.author.username}
          </Text>
        </View>
      </View>

      {/* Content */}
      {moment.content ? (
        <Text style={cardStyles.content}>{moment.content}</Text>
      ) : null}

      {/* Image grid */}
      {imageAttachments.length > 0 && (
        <View
          style={[
            cardStyles.imageGrid,
            imageAttachments.length === 1
              ? { flexDirection: 'column' }
              : imageAttachments.length === 2
              ? { flexDirection: 'row' }
              : { flexDirection: 'row', flexWrap: 'wrap' },
          ]}
        >
          {imageAttachments.map((att, i) => (
            <View
              key={att.url + i}
              style={[
                cardStyles.imageItem,
                imageAttachments.length === 1 && { width: '100%' },
                imageAttachments.length === 2 && { width: '49%' },
                imageAttachments.length >= 3 && { width: '32%' },
              ]}
            >
              <MomentImage url={att.url} />
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={cardStyles.actionRow}>
        <Text style={cardStyles.timeText}>{formatRelative(moment.createdAt, t)}</Text>

        <TouchableOpacity
          style={cardStyles.actionBtn}
          onPress={onLike}
          activeOpacity={0.7}
        >
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={16}
            color={liked ? colors.primary : colors.textMuted}
          />
          {moment.likes.length > 0 && (
            <Text
              style={[
                cardStyles.actionText,
                liked && { color: colors.primary },
              ]}
            >
              {moment.likes.length}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={cardStyles.actionBtn}
          onPress={() => setCommentOpen((v) => !v)}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubble-outline" size={15} color={colors.textMuted} />
          {moment.comments.length > 0 && (
            <Text style={cardStyles.actionText}>{moment.comments.length}</Text>
          )}
        </TouchableOpacity>

        {isMine && (
          <TouchableOpacity
            style={[cardStyles.actionBtn, { marginLeft: 'auto' }]}
            onPress={onDelete}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Comments list */}
      {moment.comments.length > 0 && (
        <View style={cardStyles.commentsList}>
          {moment.comments.map((c) => (
            <View key={c._id} style={cardStyles.commentRow}>
              <Text style={cardStyles.commentContent}>
                <Text style={cardStyles.commentAuthor}>
                  {c.author.displayName || c.author.username}
                </Text>
                {'  '}
                {c.content}
              </Text>
              {(isMine || c.author._id === currentUserId) && (
                <TouchableOpacity
                  onPress={() => onDeleteComment(c._id)}
                  style={{ padding: 2 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={12} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Comment input */}
      {commentOpen && (
        <View style={cardStyles.commentInputRow}>
          <TextInput
            style={cardStyles.commentInput}
            value={commentText}
            onChangeText={setCommentText}
            placeholder={t('moments.commentPlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoFocus
            maxLength={500}
          />
          <TouchableOpacity
            onPress={handleSubmitComment}
            disabled={!commentText.trim()}
            style={[
              cardStyles.commentSendBtn,
              !commentText.trim() && { opacity: 0.3 },
            ]}
            activeOpacity={0.7}
          >
            <Text style={cardStyles.commentSendText}>{t('common.send')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    padding: spacing.lg,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  authorName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  content: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  // Image grid
  imageGrid: {
    gap: 4,
    marginBottom: spacing.sm,
  },
  imageItem: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  // Actions
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  timeText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  actionText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  // Comments
  commentsList: {
    backgroundColor: colors.bgInput,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  commentContent: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  commentAuthor: {
    fontWeight: '600',
    color: colors.primary,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.bgInput,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  commentSendBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  commentSendText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});

// ── Main screen ─────────────────────────────────────────────────────

const MomentsScreen = ({ navigation }: Props) => {
  const { user } = useAuth();
  const { t } = useT();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const { moments } = await momentService.list();
      setMoments(moments);
    } catch (err) {
      console.warn('Failed to load moments:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Reload when returning from compose
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      load();
    });
    return unsubscribe;
  }, [navigation, load]);

  const handleLike = async (m: Moment) => {
    if (!user) return;
    const wasLiked = m.likes.includes(user.id);
    // Optimistic update
    setMoments((prev) =>
      prev.map((x) =>
        x._id === m._id
          ? {
              ...x,
              likes: wasLiked
                ? x.likes.filter((id) => id !== user.id)
                : [...x.likes, user.id],
            }
          : x
      )
    );
    try {
      await momentService.toggleLike(m._id);
    } catch {
      // Rollback
      setMoments((prev) =>
        prev.map((x) =>
          x._id === m._id
            ? {
                ...x,
                likes: wasLiked
                  ? [...x.likes, user.id]
                  : x.likes.filter((id) => id !== user.id),
              }
            : x
        )
      );
    }
  };

  const handleComment = async (m: Moment, content: string) => {
    try {
      const { comment } = await momentService.addComment(m._id, content);
      setMoments((prev) =>
        prev.map((x) =>
          x._id === m._id
            ? { ...x, comments: [...x.comments, comment] }
            : x
        )
      );
    } catch (err) {
      console.warn('Failed to add comment:', err);
    }
  };

  const handleDelete = (m: Moment) => {
    Alert.alert(t('moments.delete'), t('moments.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await momentService.remove(m._id);
            setMoments((prev) => prev.filter((x) => x._id !== m._id));
          } catch (err) {
            console.warn('Failed to delete moment:', err);
          }
        },
      },
    ]);
  };

  const handleDeleteComment = async (m: Moment, commentId: string) => {
    try {
      await momentService.deleteComment(m._id, commentId);
      setMoments((prev) =>
        prev.map((x) =>
          x._id === m._id
            ? { ...x, comments: x.comments.filter((c) => c._id !== commentId) }
            : x
        )
      );
    } catch (err) {
      console.warn('Failed to delete comment:', err);
    }
  };

  const renderMoment = ({ item }: { item: Moment }) => (
    <MomentCard
      moment={item}
      currentUserId={user?.id || ''}
      onLike={() => handleLike(item)}
      onComment={(content) => handleComment(item, content)}
      onDelete={() => handleDelete(item)}
      onDeleteComment={(commentId) => handleDeleteComment(item, commentId)}
    />
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={moments}
        keyExtractor={(item) => item._id}
        renderItem={renderMoment}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="heart-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t('moments.empty')}</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={
          moments.length === 0 ? { flex: 1 } : undefined
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bgDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: spacing.sm,
    backgroundColor: colors.bgDark,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyText: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});

export default MomentsScreen;
