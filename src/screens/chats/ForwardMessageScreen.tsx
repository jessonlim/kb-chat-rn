// ForwardMessageScreen — pick one or more chats to forward a message to.
//
// Entered via ChatScreen.handleAction('forward'). The message-to-forward is
// passed via route params. User multi-selects chats, taps Send, the message
// is re-posted (content + attachments + type) to each selected chat via the
// REST sendMessage endpoint.

import React, { useMemo, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import chatService from '../../services/chatService';
import { useAuth } from '../../stores/authStore';
import Avatar from '../../components/common/Avatar';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';
import type { Chat, Message, User } from '../../types';

interface Props {
  // Backwards-compatible: either a single message (legacy) or an array.
  route: { params: { message?: Message; messages?: Message[] } };
  navigation: any;
}

const ForwardMessageScreen = ({ route, navigation }: Props) => {
  // Normalise so the rest of the screen always works with an array.
  const messagesToForward: Message[] = useMemo(() => {
    if (route.params.messages && route.params.messages.length) return route.params.messages;
    if (route.params.message) return [route.params.message];
    return [];
  }, [route.params.message, route.params.messages]);
  const { user } = useAuth();
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  // Load all chats once
  useEffect(() => {
    (async () => {
      try {
        const res = await chatService.getMyChats();
        setChats(res.chats);
      } catch (err) {
        console.warn('Failed to load chats for forward:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const getOtherUser = useCallback(
    (chat: Chat): User | null => {
      if (chat.type !== 'private' || !user) return null;
      return chat.participants.find((p) => p.id !== user.id) || null;
    },
    [user],
  );

  const getChatName = useCallback(
    (chat: Chat): string => {
      if (chat.type === 'group') return chat.groupName || t('group.info');
      const other = getOtherUser(chat);
      return other?.displayName || other?.username || t('tab.chats');
    },
    [t, getOtherUser],
  );

  const getChatAvatar = useCallback(
    (chat: Chat) => {
      if (chat.type === 'group') {
        return { name: chat.groupName || 'G', src: chat.groupImage };
      }
      const other = getOtherUser(chat);
      return { name: other?.displayName || other?.username || '?', src: other?.avatar };
    },
    [getOtherUser],
  );

  const toggle = (chatId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) next.delete(chatId);
      else next.add(chatId);
      return next;
    });
  };

  const handleSend = async () => {
    if (selected.size === 0 || sending || messagesToForward.length === 0) return;
    setSending(true);
    try {
      // For each selected chat, forward every message in original order.
      // We do chats in parallel but messages within a chat sequentially so
      // they arrive in the right order (the backend stamps `createdAt` on
      // arrival, not from the client).
      await Promise.all(
        Array.from(selected).map(async (chatId) => {
          for (const m of messagesToForward) {
            await chatService.forwardMessageRest(chatId, {
              content: m.content,
              type: m.type || 'text',
              attachments: m.attachments,
            });
          }
        })
      );
      Toast.show({ type: 'success', text1: t('forward.sent') });
      navigation.goBack();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: err?.response?.data?.message || t('common.failed'),
      });
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={chats}
        keyExtractor={(c) => c._id}
        renderItem={({ item }) => {
          const av = getChatAvatar(item);
          const isSelected = selected.has(item._id);
          return (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => toggle(item._id)}
            >
              <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
                {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Avatar name={av.name} src={av.src} size={44} />
              <Text style={styles.chatName} numberOfLines={1}>
                {getChatName(item)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Bottom send bar */}
      <View style={styles.bottomBar}>
        <Text style={styles.selectedCount}>
          {selected.size > 0 ? t('forward.selectCount', { n: selected.size }) : ''}
        </Text>
        <TouchableOpacity
          style={[
            styles.sendButton,
            (selected.size === 0 || sending) && styles.sendButtonDisabled,
          ]}
          activeOpacity={0.7}
          disabled={selected.size === 0 || sending}
          onPress={handleSend}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>{t('forward.send')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  center: { alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chatName: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.bgHeader,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  selectedCount: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  sendButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    minWidth: 100,
    alignItems: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});

export default ForwardMessageScreen;
