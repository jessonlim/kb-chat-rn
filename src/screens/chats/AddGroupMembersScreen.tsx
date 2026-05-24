// AddGroupMembersScreen — pick contacts to add to an existing group.
// Reached from ChatInfo's "+" tile when the chat is a group.
// Only shows contacts who aren't already members. On confirm, calls
// chatService.addMembers and returns to ChatInfo.

import React, { useMemo, useEffect, useState } from 'react';
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
import contactService from '../../services/contactService';
import chatService from '../../services/chatService';
import Avatar from '../../components/common/Avatar';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';
import type { User } from '../../types';

interface Props {
  route: { params: { chatId: string; existingMemberIds: string[] } };
  navigation: any;
}

const AddGroupMembersScreen = ({ route, navigation }: Props) => {
  const { chatId, existingMemberIds } = route.params;
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [contacts, setContacts] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const existingSet = useMemo(() => new Set(existingMemberIds), [existingMemberIds]);

  useEffect(() => {
    (async () => {
      try {
        const { contacts: list } = await contactService.getContacts();
        // Filter out contacts already in the group
        setContacts(list.filter((c) => !existingSet.has(c.id)));
      } catch (err) {
        console.warn('Failed to load contacts:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [existingSet]);

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (selected.size === 0 || submitting) return;
    setSubmitting(true);
    try {
      await chatService.addMembers(chatId, Array.from(selected));
      Toast.show({ type: 'success', text1: t('group.membersAdded') });
      navigation.goBack();
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: err?.response?.data?.message || t('common.failed'),
      });
      setSubmitting(false);
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
        data={contacts}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          return (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => toggle(item.id)}
            >
              <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
                {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Avatar
                name={item.displayName || item.username}
                src={item.avatar}
                size={44}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.displayName || item.username}
                </Text>
                <Text style={styles.username} numberOfLines={1}>
                  @{item.username}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t('group.allMembersAdded')}</Text>
          </View>
        }
      />

      <View style={styles.bottomBar}>
        <Text style={styles.selectedCount}>
          {selected.size > 0 ? t('forward.selectCount', { n: selected.size }) : ''}
        </Text>
        <TouchableOpacity
          style={[
            styles.confirmButton,
            (selected.size === 0 || submitting) && styles.confirmButtonDisabled,
          ]}
          activeOpacity={0.7}
          disabled={selected.size === 0 || submitting}
          onPress={handleConfirm}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.confirmButtonText}>{t('group.addMembers')}</Text>
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
  name: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  username: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
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
  confirmButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    minWidth: 120,
    alignItems: 'center',
  },
  confirmButtonDisabled: { opacity: 0.5 },
  confirmButtonText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});

export default AddGroupMembersScreen;
