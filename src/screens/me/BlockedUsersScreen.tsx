import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as authService from '../../services/authService';
import Avatar from '../../components/common/Avatar';
import { useT } from '../../i18n/I18nContext';
import { colors, spacing, fontSize, borderRadius } from '../../utils/theme';
import type { User } from '../../types';

const BlockedUsersScreen = () => {
  const { t } = useT();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await authService.listBlockedUsers();
      setUsers(res.users || []);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: err?.response?.data?.message || t('privacy.unblockFailed'),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUnblock = (user: User) => {
    Alert.alert(
      t('privacy.unblock'),
      `${t('privacy.unblock')}: ${user.displayName || user.username}?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('privacy.unblock'),
          onPress: async () => {
            try {
              await authService.unblockUser(user.id);
              setUsers((prev) => prev.filter((u) => u.id !== user.id));
              Toast.show({ type: 'success', text1: t('privacy.unblocked') });
            } catch (err: any) {
              Toast.show({
                type: 'error',
                text1: err?.response?.data?.message || t('privacy.unblockFailed'),
              });
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (users.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="ban-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>{t('privacy.blocked.empty')}</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={users}
      keyExtractor={(u) => u.id}
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
      renderItem={({ item, index }) => (
        <View
          style={[
            styles.row,
            index < users.length - 1 && styles.rowBorder,
          ]}
        >
          <Avatar
            name={item.displayName || item.username || '?'}
            src={item.avatar}
            size={44}
          />
          <View style={styles.userInfo}>
            <Text style={styles.displayName} numberOfLines={1}>
              {item.displayName || item.username}
            </Text>
            <Text style={styles.username} numberOfLines={1}>
              @{item.username}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.unblockButton}
            activeOpacity={0.7}
            onPress={() => handleUnblock(item)}
          >
            <Text style={styles.unblockText}>{t('privacy.unblock')}</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 40,
  },
  loader: {
    flex: 1,
    backgroundColor: colors.bgDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
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
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    marginBottom: 0,
  },
  rowBorder: {
    marginBottom: spacing.xs,
  },
  userInfo: { flex: 1 },
  displayName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  username: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  unblockButton: {
    backgroundColor: colors.bgInput,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  unblockText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '600',
  },
});

export default BlockedUsersScreen;
