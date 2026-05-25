// "Hidden chats" manager — list chats the user previously hid (via the
// chat list long-press menu) so they can unhide them without having to
// send a new message.
//
// If the backend doesn't yet expose /api/chats/hidden the screen renders
// an explanatory empty state.

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import chatService from '../../services/chatService';
import { useAuth } from '../../stores/authStore';
import { displayNameOf } from '../../stores/remarksStore';
import Avatar from '../../components/common/Avatar';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize } from '../../utils/theme';
import type { Chat } from '../../types';

interface Props {
  navigation: any;
}

const HiddenChatsScreen = ({ navigation: _navigation }: Props) => {
  const { user } = useAuth();
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { chats: hidden } = await chatService.listHiddenChats();
      setChats(hidden);
    } catch {
      // Endpoint may not be available — degrade gracefully
      setChats([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUnhide = useCallback(
    (chat: Chat) => {
      Alert.alert(t('hidden.unhide'), '', [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('hidden.unhide'),
          onPress: async () => {
            // Optimistic remove from this list
            setChats((prev) => prev.filter((c) => c._id !== chat._id));
            try {
              await chatService.unhideChat(chat._id);
              Toast.show({ type: 'success', text1: t('hidden.unhidden') });
            } catch (err) {
              // Restore + show error
              setChats((prev) => [...prev, chat]);
              Toast.show({ type: 'error', text1: t('common.failed') });
            }
          },
        },
      ]);
    },
    [t]
  );

  const getName = (chat: Chat) => {
    if (chat.type === 'group') return chat.groupName || t('group.info');
    const other = chat.participants.find((p) => p.id !== user?.id);
    return other ? displayNameOf(other) : '?';
  };

  const getAvatarSrc = (chat: Chat) => {
    if (chat.type === 'group') return chat.groupImage;
    const other = chat.participants.find((p) => p.id !== user?.id);
    return other?.avatar;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={chats}
      keyExtractor={(c) => c._id}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="eye-off-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>{t('hidden.empty')}</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Avatar name={getName(item)} src={getAvatarSrc(item)} size={42} />
          <Text style={styles.name} numberOfLines={1}>
            {getName(item)}
          </Text>
          <TouchableOpacity
            style={styles.unhideBtn}
            activeOpacity={0.7}
            onPress={() => handleUnhide(item)}
          >
            <Text style={styles.unhideText}>{t('hidden.unhide')}</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgDark,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgDark,
    },
    empty: {
      alignItems: 'center',
      paddingTop: spacing.xxl * 2,
      gap: spacing.md,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
      paddingHorizontal: spacing.xl,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.bgCard,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    name: {
      flex: 1,
      fontSize: fontSize.md,
      color: colors.textPrimary,
    },
    unhideBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    unhideText: {
      color: '#fff',
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
  });

export default HiddenChatsScreen;
