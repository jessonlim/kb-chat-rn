// GroupChatsListScreen — lists all group chats the user is in.
// Reached from the Contacts tab → "Group Chats" row.
// Tapping a group jumps into the chat (across stacks to ChatsTab → ChatScreen).

import React, { useMemo, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import chatService from '../../services/chatService';
import Avatar from '../../components/common/Avatar';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';
import type { Chat } from '../../types';

interface Props {
  navigation: any;
}

const GroupChatsListScreen = ({ navigation }: Props) => {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [groups, setGroups] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { chats } = await chatService.getMyChats();
      // Keep only group chats, sort alphabetically by name for stable list
      const groupChats = chats
        .filter((c) => c.type === 'group')
        .sort((a, b) => (a.groupName || '').localeCompare(b.groupName || ''));
      setGroups(groupChats);
    } catch (err) {
      console.warn('Failed to load group chats:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openGroup = (chat: Chat) => {
    // Jump from ContactsTab → ChatsTab → ChatScreen with the right chatId
    const tabs = navigation.getParent();
    if (tabs) {
      tabs.navigate('ChatsTab', {
        screen: 'ChatScreen',
        params: { chatId: chat._id },
      });
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
    <FlatList
      style={styles.container}
      data={groups}
      keyExtractor={(c) => c._id}
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
      renderItem={({ item }) => {
        const memberCount = item.participants.length;
        return (
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => openGroup(item)}
          >
            <Avatar
              name={item.groupName || 'Group'}
              src={item.groupImage}
              size={48}
            />
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>
                {item.groupName || t('group.info')}
              </Text>
              <Text style={styles.members} numberOfLines={1}>
                {t('group.membersCount', { n: memberCount })}
              </Text>
            </View>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyText}>{t('contacts.groupChats')}</Text>
          <Text style={styles.emptySubtext}>
            {t('group.notInAnyHint')}
          </Text>
        </View>
      }
      contentContainerStyle={groups.length === 0 ? { flex: 1 } : undefined}
    />
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
  info: { flex: 1 },
  name: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  members: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});

export default GroupChatsListScreen;
