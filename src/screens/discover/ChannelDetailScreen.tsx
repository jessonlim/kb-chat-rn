import React, { useMemo, useEffect, useState, useCallback } from 'react';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import channelService from '../../services/channelService';
import { useAuth } from '../../stores/authStore';
import { useMediaUrl } from '../../hooks/useMediaUrl';
import Avatar from '../../components/common/Avatar';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';
import type { Channel, ChannelPost, ChannelComment } from '../../types';

interface Props {
  navigation: any;
  route: { params: { channelId: string } };
}

type TFn = (key: any, vars?: Record<string, string | number>) => string;

// ── Time formatter (pure helper) ────────────────────────────────────
const formatPostTime = (iso: string, t: TFn): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return t('moments.justNow');
  if (min < 60) return t('moments.minutesAgo', { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('moments.hoursAgo', { n: hr });
  const day = Math.floor(hr / 24);
  if (day < 7) return t('moments.daysAgo', { n: day });
  return new Date(iso).toLocaleDateString();
};

// ── Post image component (resolves media URLs) ─────────────────────
const PostImage = ({ url, onPress }: { url: string; onPress: () => void }) => {
  const { colors } = useTheme();
  const postImgStyles = useMemo(() => makePostImgStyles(colors), [colors]);
  const { uri, loading } = useMediaUrl(url);

  if (loading || !uri) {
    return (
      <View style={postImgStyles.placeholder}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      <Image
        source={{ uri }}
        style={postImgStyles.image}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );
};

const makePostImgStyles = (_colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
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

// ── Comments section ────────────────────────────────────────────────
const CommentsSection = ({
  channelId,
  postId,
  isChannelOwner,
  onCountChange,
}: {
  channelId: string;
  postId: string;
  isChannelOwner: boolean;
  onCountChange: (count: number) => void;
}) => {
  const { user } = useAuth();
  const { t } = useT();
  const { colors } = useTheme();
  const commentStyles = useMemo(() => makeCommentStyles(colors), [colors]);
  const [comments, setComments] = useState<ChannelComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { comments } = await channelService.listComments(
          channelId,
          postId
        );
        setComments(comments);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, [channelId, postId]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const { comment, commentCount } = await channelService.addComment(
        channelId,
        postId,
        trimmed
      );
      setComments((prev) => [...prev, comment]);
      onCountChange(commentCount);
      setText('');
    } catch (err) {
      console.warn('Failed to add comment:', err);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = (comment: ChannelComment) => {
    Alert.alert(t('channels.comments.deleteConfirm'), t('channels.comments.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            const { commentCount } = await channelService.deleteComment(
              channelId,
              postId,
              comment._id
            );
            setComments((prev) =>
              prev.filter((c) => c._id !== comment._id)
            );
            onCountChange(commentCount);
          } catch (err) {
            console.warn('Failed to delete comment:', err);
          }
        },
      },
    ]);
  };

  const canDelete = (c: ChannelComment) =>
    isChannelOwner || c.author._id === user?.id;

  return (
    <View style={commentStyles.container}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={colors.primary}
          style={{ paddingVertical: spacing.md }}
        />
      ) : comments.length === 0 ? (
        <Text style={commentStyles.empty}>{t('channels.comments.empty')}</Text>
      ) : (
        comments.map((c) => (
          <View key={c._id} style={commentStyles.row}>
            <View style={commentStyles.commentContent}>
              <Text style={commentStyles.authorName}>
                {c.author.displayName}
              </Text>
              <Text style={commentStyles.commentText}>{c.content}</Text>
              <Text style={commentStyles.commentTime}>
                {formatPostTime(c.createdAt, t)}
              </Text>
            </View>
            {canDelete(c) && (
              <TouchableOpacity
                onPress={() => handleDelete(c)}
                style={commentStyles.deleteBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={14} color={colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        ))
      )}

      {/* Comment input */}
      <View style={commentStyles.inputRow}>
        <TextInput
          style={commentStyles.input}
          value={text}
          onChangeText={setText}
          placeholder={t('channels.comments.placeholder')}
          placeholderTextColor={colors.textMuted}
          maxLength={2000}
          editable={!sending}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!text.trim() || sending}
          style={[
            commentStyles.sendBtn,
            (!text.trim() || sending) && { opacity: 0.3 },
          ]}
          activeOpacity={0.7}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="send" size={16} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const makeCommentStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bgDark,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  empty: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  commentContent: {
    flex: 1,
  },
  authorName: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.primary,
  },
  commentText: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    marginTop: 1,
  },
  commentTime: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bgInput,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  sendBtn: {
    padding: 6,
  },
});

// ── Main screen ─────────────────────────────────────────────────────

const ChannelDetailScreen = ({ navigation, route }: Props) => {
  const { channelId } = route.params;
  const { user } = useAuth();
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [posts, setPosts] = useState<ChannelPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(
    new Set()
  );

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const [channelRes, postsRes] = await Promise.all([
          channelService.get(channelId),
          channelService.listPosts(channelId),
        ]);
        setChannel(channelRes.channel);
        setPosts(postsRes.posts);
      } catch (err) {
        console.warn('Failed to load channel:', err);
        navigation.goBack();
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [channelId, navigation]
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleDeleteChannel = useCallback(() => {
    if (!channel) return;
    Alert.alert(
      t('channels.delete'),
      t('channels.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await channelService.remove(channel._id);
              navigation.goBack();
            } catch (err) {
              console.warn('Failed to delete channel:', err);
            }
          },
        },
      ]
    );
  }, [channel, navigation, t]);

  // Update header with channel name + actions
  useEffect(() => {
    if (!channel) return;
    navigation.setOptions({
      title: channel.name,
      headerRight: () =>
        channel.isOwner ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('ComposePost', { channelId: channel._id })
              }
              style={{ paddingRight: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDeleteChannel}
              style={{ paddingRight: 16 }}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </TouchableOpacity>
          </View>
        ) : null,
    });
  }, [channel, navigation, colors, handleDeleteChannel]);

  const handleSubscribe = async () => {
    if (!channel) return;
    try {
      if (channel.isSubscribed) {
        Alert.alert(t('channels.unsubscribe'), t('channels.unsubscribeConfirm'), [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('channels.unsubscribe'),
            style: 'destructive',
            onPress: async () => {
              const { subscriberCount } = await channelService.unsubscribe(
                channel._id
              );
              setChannel({
                ...channel,
                isSubscribed: false,
                subscriberCount,
              });
            },
          },
        ]);
      } else {
        const { subscriberCount } = await channelService.subscribe(
          channel._id
        );
        setChannel({ ...channel, isSubscribed: true, subscriberCount });
      }
    } catch (err) {
      console.warn('Subscribe/unsubscribe failed:', err);
    }
  };

  const handleLikePost = async (post: ChannelPost) => {
    if (!user) return;
    const wasLiked = post.likes.includes(user.id);
    // Optimistic update
    setPosts((cur) =>
      cur.map((p) =>
        p._id === post._id
          ? {
              ...p,
              likes: wasLiked
                ? p.likes.filter((id) => id !== user.id)
                : [...p.likes, user.id],
            }
          : p
      )
    );
    try {
      await channelService.togglePostLike(channelId, post._id);
    } catch {
      // Rollback
      setPosts((cur) =>
        cur.map((p) =>
          p._id === post._id
            ? {
                ...p,
                likes: wasLiked
                  ? [...p.likes, user.id]
                  : p.likes.filter((id) => id !== user.id),
              }
            : p
        )
      );
    }
  };

  const handleDeletePost = (post: ChannelPost) => {
    Alert.alert(t('channels.post.delete'), t('channels.post.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await channelService.deletePost(channelId, post._id);
            setPosts((cur) => cur.filter((p) => p._id !== post._id));
          } catch (err) {
            console.warn('Failed to delete post:', err);
          }
        },
      },
    ]);
  };

  const toggleComments = (postId: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  // Reload posts when returning from ComposePost screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (channel) {
        channelService
          .listPosts(channelId)
          .then(({ posts }) => setPosts(posts))
          .catch(() => {});
      }
    });
    return unsubscribe;
  }, [navigation, channelId, channel]);

  if (loading || !channel) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isOwner = channel.isOwner;

  const renderHeader = () => (
    <View style={styles.infoCard}>
      <View style={styles.infoRow}>
        <ChannelAvatar avatar={channel.avatar} name={channel.name} />
        <View style={styles.infoContent}>
          <Text style={styles.channelName}>{channel.name}</Text>
          <View style={styles.subscriberRow}>
            <Ionicons name="people-outline" size={14} color={colors.textMuted} />
            <Text style={styles.subscriberText}>
              {channel.subscriberCount === 1
                ? t('channels.subscribers', { n: channel.subscriberCount })
                : t('channels.subscribersPlural', { n: channel.subscriberCount })}
            </Text>
          </View>
        </View>
        {!isOwner && (
          <TouchableOpacity
            style={[
              styles.subButton,
              channel.isSubscribed && styles.subButtonActive,
            ]}
            onPress={handleSubscribe}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.subButtonText,
                channel.isSubscribed && styles.subButtonTextActive,
              ]}
            >
              {channel.isSubscribed ? t('channels.subscribed') : t('channels.subscribe')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {channel.description ? (
        <Text style={styles.description}>{channel.description}</Text>
      ) : null}
    </View>
  );

  const renderPost = ({ item: post }: { item: ChannelPost }) => {
    const isLiked = user ? post.likes.includes(user.id) : false;
    const imageAttachments = post.attachments.filter(
      (a) => a.type === 'image'
    );

    return (
      <View style={styles.postCard}>
        {/* Author */}
        <View style={styles.postAuthorRow}>
          <Avatar
            name={post.author.displayName}
            src={post.author.avatar}
            size={36}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.postAuthorName}>
              {post.author.displayName}
            </Text>
            <Text style={styles.postTime}>{formatPostTime(post.createdAt, t)}</Text>
          </View>
          {isOwner && (
            <TouchableOpacity
              onPress={() => handleDeletePost(post)}
              activeOpacity={0.7}
              style={{ padding: 4 }}
            >
              <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Content */}
        {post.content ? (
          <Text style={styles.postContent}>{post.content}</Text>
        ) : null}

        {/* Images grid */}
        {imageAttachments.length > 0 && (
          <View
            style={[
              styles.imageGrid,
              imageAttachments.length === 1
                ? styles.gridSingle
                : imageAttachments.length === 2
                ? styles.gridDouble
                : styles.gridTriple,
            ]}
          >
            {imageAttachments.map((att, i) => (
              <View
                key={att.url + i}
                style={[
                  styles.imageGridItem,
                  imageAttachments.length === 1 && styles.gridItemSingle,
                ]}
              >
                <PostImage url={att.url} onPress={() => {}} />
              </View>
            ))}
          </View>
        )}

        {/* Like + Comment buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, isLiked && styles.actionActive]}
            onPress={() => handleLikePost(post)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={16}
              color={isLiked ? '#ef4444' : colors.textMuted}
            />
            <Text
              style={[
                styles.actionText,
                isLiked && { color: '#ef4444' },
              ]}
            >
              {post.likes.length}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              expandedComments.has(post._id) && styles.actionActive,
            ]}
            onPress={() => toggleComments(post._id)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chatbubble-outline"
              size={15}
              color={
                expandedComments.has(post._id)
                  ? colors.primary
                  : colors.textMuted
              }
            />
            <Text
              style={[
                styles.actionText,
                expandedComments.has(post._id) && { color: colors.primary },
              ]}
            >
              {post.commentCount || 0}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Comments (expanded) */}
        {expandedComments.has(post._id) && (
          <CommentsSection
            channelId={channelId}
            postId={post._id}
            isChannelOwner={isOwner}
            onCountChange={(count) =>
              setPosts((cur) =>
                cur.map((p) =>
                  p._id === post._id ? { ...p, commentCount: count } : p
                )
              )
            }
          />
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={posts}
        keyExtractor={(item) => item._id}
        renderItem={renderPost}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyPosts}>
            <Text style={styles.emptyText}>
              {isOwner ? t('channels.posts.emptyOwner') : t('channels.posts.empty')}
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        style={{ backgroundColor: colors.bgDark }}
      />
    </KeyboardAvoidingView>
  );
};

// ── Channel avatar helper ───────────────────────────────────────────
const ChannelAvatar = ({
  avatar,
  name,
}: {
  avatar: string;
  name: string;
}) => {
  const { uri } = useMediaUrl(avatar || '');
  return <Avatar name={name} src={uri || undefined} size={56} />;
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.bgDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Info card
  infoCard: {
    backgroundColor: colors.bgCard,
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  channelName: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subscriberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  subscriberText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  description: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.md,
    lineHeight: 20,
  },
  subButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
  },
  subButtonActive: {
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#fff',
  },
  subButtonTextActive: {
    color: colors.textPrimary,
  },
  // Posts
  postCard: {
    backgroundColor: colors.bgCard,
    padding: spacing.lg,
  },
  postAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  postAuthorName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  postTime: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  postContent: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  // Image grid
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: spacing.sm,
  },
  gridSingle: {},
  gridDouble: {},
  gridTriple: {},
  imageGridItem: {
    width: '32%',
    aspectRatio: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  gridItemSingle: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  // Action row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: borderRadius.xl,
  },
  actionActive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  actionText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  // Empty
  emptyPosts: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  separator: {
    height: spacing.sm,
    backgroundColor: colors.bgDark,
  },
});

export default ChannelDetailScreen;
