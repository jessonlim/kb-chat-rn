// Starred messages (Me tab) — every message the user has starred across
// all chats. Fetches GET /api/starred-messages. Tap a row to jump to that
// message's chat.

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import chatService from '../../services/chatService';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize } from '../../utils/theme';
import type { Message } from '../../types';

interface Props {
  navigation: any;
}

const formatTime = (dateStr: string): string => {
  const d = new Date(dateStr);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const StarredMessagesScreen = ({ navigation }: Props) => {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Short, human preview of a message regardless of type. Reuses the
  // existing msg.preview.* strings (which already include emoji).
  const preview = useCallback(
    (m: Message): string => {
      if (m.content && (m.type === 'text' || !m.type)) return m.content;
      switch (m.type) {
        case 'image': return t('msg.preview.photo');
        case 'video': return t('msg.preview.video');
        case 'audio': return t('msg.preview.audio');
        case 'file': return t('msg.preview.file');
        case 'sticker': return `🌟 ${t('msg.preview.sticker')}`;
        case 'location': return `📍 ${t('location.title')}`;
        case 'contact': return '👤';
        default: return m.content || t('msg.preview.message');
      }
    },
    [t]
  );

  const load = useCallback(async () => {
    try {
      const { messages: data } = await chatService.getStarredMessages();
      setMessages(data);
    } catch (err) {
      console.warn('Failed to load starred messages:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh whenever the screen regains focus (a star toggled in a chat
  // should reflect here next time the user opens this screen).
  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const openInChat = useCallback(
    (m: Message) => {
      const chatId = typeof (m as any).chat === 'object' ? (m as any).chat?._id : (m as any).chat;
      if (!chatId) return;
      // Jump from the Me-tab stack over to the Chats tab + open the chat.
      navigation.getParent()?.navigate('ChatsTab', {
        screen: 'ChatScreen',
        params: { chatId },
      });
    },
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: Message }) => {
      const sender = typeof item.sender === 'object' ? item.sender : null;
      const senderName = sender?.displayName || sender?.username || 'User';
      const chat = (item as any).chat;
      const groupName =
        chat && typeof chat === 'object' && chat.type === 'group'
          ? chat.groupName
          : null;
      return (
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.7}
          onPress={() => openInChat(item)}
        >
          <Ionicons name="star" size={18} color="#FFC107" style={styles.rowStar} />
          <View style={styles.rowBody}>
            <View style={styles.rowHeader}>
              <Text style={styles.sender} numberOfLines={1}>
                {senderName}
                {groupName ? (
                  <Text style={styles.fromChat}>  {t('starred.fromChat', { chat: groupName })}</Text>
                ) : null}
              </Text>
              <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
            </View>
            <Text style={styles.preview} numberOfLines={2}>
              {preview(item)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      );
    },
    [styles, colors, openInChat, preview, t]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (messages.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="star-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>{t('starred.title')}</Text>
        <Text style={styles.emptyDesc}>{t('starred.empty')}</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={messages}
      keyExtractor={(m) => m._id}
      renderItem={renderItem}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={colors.primary}
        />
      }
    />
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    list: {
      flex: 1,
      backgroundColor: colors.bgDark,
    },
    center: {
      flex: 1,
      backgroundColor: colors.bgDark,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xxl,
    },
    emptyTitle: {
      fontSize: fontSize.xl,
      fontWeight: '600',
      color: colors.textPrimary,
      marginTop: spacing.lg,
    },
    emptyDesc: {
      fontSize: fontSize.md,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.md,
      lineHeight: 22,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.bgCard,
    },
    rowStar: {
      marginTop: 2,
    },
    rowBody: {
      flex: 1,
    },
    rowHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sender: {
      flex: 1,
      fontSize: fontSize.md,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    fromChat: {
      fontSize: fontSize.xs,
      fontWeight: '400',
      color: colors.textMuted,
    },
    time: {
      fontSize: fontSize.xs,
      color: colors.textMuted,
      marginLeft: spacing.sm,
    },
    preview: {
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      marginTop: 2,
    },
    sep: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginLeft: spacing.lg,
    },
  });

export default StarredMessagesScreen;
