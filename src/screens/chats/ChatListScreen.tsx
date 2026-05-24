import React, { useMemo, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import chatService from '../../services/chatService';
import socketService from '../../services/socketService';
import { useAuth } from '../../stores/authStore';
import Avatar from '../../components/common/Avatar';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';
import type { Chat, Message, User } from '../../types';

interface Props {
  navigation: any;
}

const ChatListScreen = ({ navigation }: Props) => {
  const { user } = useAuth();
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Strip any duplicate chat IDs — defensive against backend or race conditions
  // that could otherwise crash FlatList with "two children with the same key".
  const dedupe = (list: Chat[]): Chat[] => {
    const seen = new Set<string>();
    return list.filter((c) => {
      if (!c._id || seen.has(c._id)) return false;
      seen.add(c._id);
      return true;
    });
  };

  const loadChats = useCallback(async () => {
    try {
      const { chats: data } = await chatService.getMyChats();
      setChats(dedupe(data));
    } catch (err) {
      console.warn('Failed to load chats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Socket: real-time chat list updates
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const onChatUpdated = (data: { chatId: string; lastMessage: Message }) => {
      let needsReload = false;
      setChats((prev) => {
        const idx = prev.findIndex((c) => c._id === data.chatId);
        if (idx === -1) {
          // New chat we haven't seen — flag a reload after this state update
          needsReload = true;
          return prev;
        }
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          lastMessage: data.lastMessage,
          updatedAt: new Date().toISOString(),
          unreadCount: (updated[idx].unreadCount || 0) + 1,
        };
        // Sort: pinned first, then by updatedAt
        updated.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
        return dedupe(updated);
      });
      if (needsReload) loadChats();
    };

    const onPresence = (data: { userId: string }) => {
      setChats((prev) =>
        prev.map((chat) => ({
          ...chat,
          participants: chat.participants.map((p) =>
            p.id === data.userId ? { ...p, isOnline: true } : p
          ),
        }))
      );
    };

    const onOffline = (data: { userId: string }) => {
      setChats((prev) =>
        prev.map((chat) => ({
          ...chat,
          participants: chat.participants.map((p) =>
            p.id === data.userId ? { ...p, isOnline: false } : p
          ),
        }))
      );
    };

    // When the current user opens a chat, the backend emits messages_read.
    // Clear the unread badge for that chat instantly so the list reflects it.
    const onMessagesRead = (data: { chatId: string; readerId: string }) => {
      if (data.readerId !== user?.id) return; // only self-reads clear our badge
      setChats((prev) =>
        prev.map((chat) =>
          chat._id === data.chatId ? { ...chat, unreadCount: 0 } : chat
        )
      );
    };

    socket.on('chat_updated', onChatUpdated);
    socket.on('user_online', onPresence);
    socket.on('user_offline', onOffline);
    socket.on('messages_read', onMessagesRead);

    return () => {
      socket.off('chat_updated', onChatUpdated);
      socket.off('user_online', onPresence);
      socket.off('user_offline', onOffline);
      socket.off('messages_read', onMessagesRead);
    };
  }, [loadChats, user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadChats();
  };

  // Get the "other" user in a private chat
  const getOtherUser = (chat: Chat): User | null => {
    if (chat.type !== 'private' || !user) return null;
    return chat.participants.find((p) => p.id !== user.id) || null;
  };

  const getChatName = (chat: Chat): string => {
    if (chat.type === 'group') return chat.groupName || t('group.info');
    const other = getOtherUser(chat);
    return other?.displayName || other?.username || t('tab.chats');
  };

  const getChatAvatar = (chat: Chat) => {
    if (chat.type === 'group') {
      return { name: chat.groupName || 'G', src: chat.groupImage };
    }
    const other = getOtherUser(chat);
    return { name: other?.displayName || other?.username || '?', src: other?.avatar };
  };

  const getLastMessagePreview = (chat: Chat): string => {
    const msg = chat.lastMessage;
    if (!msg) return '';
    if (msg.type === 'image') return `📷 ${t('msg.preview.photo')}`;
    if (msg.type === 'video') return `🎥 ${t('msg.preview.video')}`;
    if (msg.type === 'audio') return `🎤 ${t('msg.preview.audio')}`;
    if (msg.type === 'file') return `📎 ${t('msg.preview.file')}`;
    if (msg.type === 'sticker') return `🎨 ${t('msg.preview.sticker')}`;
    if (msg.type === 'system') return msg.content;
    return msg.content || '';
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / 86400000);

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (days === 1) return t('chat.lastSeen.yesterday');
    if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderChat = ({ item: chat }: { item: Chat }) => {
    const avatar = getChatAvatar(chat);
    const other = getOtherUser(chat);
    const hasUnread = (chat.unreadCount || 0) > 0;

    return (
      <TouchableOpacity
        style={styles.chatRow}
        activeOpacity={0.7}
        onPress={() => {
          // Optimistically clear the unread badge so the UI updates instantly.
          // The backend confirms via the messages_read socket event when
          // ChatScreen mounts and emits mark_chat_read.
          if ((chat.unreadCount || 0) > 0) {
            setChats((prev) =>
              prev.map((c) => (c._id === chat._id ? { ...c, unreadCount: 0 } : c))
            );
          }
          navigation.navigate('ChatScreen', { chatId: chat._id });
        }}
      >
        <Avatar
          name={avatar.name}
          src={avatar.src}
          size={52}
          online={chat.type === 'private' ? other?.isOnline : undefined}
        />

        <View style={styles.chatInfo}>
          <View style={styles.topRow}>
            <Text style={styles.chatName} numberOfLines={1}>
              {getChatName(chat)}
            </Text>
            {chat.lastMessage && (
              <Text style={[styles.time, hasUnread && styles.timeUnread]}>
                {formatTime(chat.lastMessage.createdAt || chat.updatedAt)}
              </Text>
            )}
          </View>

          <View style={styles.bottomRow}>
            <Text
              style={[styles.preview, hasUnread && styles.previewUnread]}
              numberOfLines={1}
            >
              {getLastMessagePreview(chat)}
            </Text>
            {hasUnread && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {chat.unreadCount! > 99 ? '99+' : chat.unreadCount}
                </Text>
              </View>
            )}
            {chat.isPinned && (
              <Ionicons
                name="pin"
                size={14}
                color={colors.textMuted}
                style={{ marginLeft: 6 }}
              />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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
        data={chats}
        keyExtractor={(c) => c._id}
        renderItem={renderChat}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="chatbubbles-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t('chats.empty')}</Text>
            <Text style={styles.emptySubtext}>{t('chats.emptyHint')}</Text>
          </View>
        }
        contentContainerStyle={chats.length === 0 ? { flex: 1 } : undefined}
      />
    </View>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
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
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chatName: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  time: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  timeUnread: {
    color: colors.primary,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  preview: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  previewUnread: {
    color: colors.textSecondary,
    fontWeight: '500',
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
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
  },
});

export default ChatListScreen;
