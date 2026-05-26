// AddGroupMembersScreen — two modes:
//
//  mode='add' (default): add NEW members to an EXISTING group.
//    chatId = the group chat. existingMemberIds are filtered out.
//    On confirm → chatService.addMembers → back to ChatInfo.
//
//  mode='create': UPGRADE a 1-on-1 chat to a new group.
//    chatId = the original 1-on-1 chat (not used in the create call,
//      but kept for back-nav context).
//    existingMemberIds = [otherUserId] — the friend from the 1-on-1
//      is implicitly part of the new group, not selectable here.
//    On confirm → chatService.createGroup with all members → navigate
//      to the new group chat.

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
import { useAuth } from '../../stores/authStore';
import { displayNameOf } from '../../stores/remarksStore';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';
import type { User } from '../../types';

interface Props {
  route: {
    params: {
      chatId: string;
      existingMemberIds: string[];
      mode?: 'add' | 'create';
    };
  };
  navigation: any;
}

const AddGroupMembersScreen = ({ route, navigation }: Props) => {
  const { chatId, existingMemberIds, mode = 'add' } = route.params;
  const { user } = useAuth();
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [contacts, setContacts] = useState<User[]>([]);
  // The User objects of people implicitly included (e.g. the friend from
  // the original 1-on-1 in 'create' mode). Kept separately so we can use
  // their names in the auto-generated group name but still hide them from
  // the picker list.
  const [implicitMembers, setImplicitMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // For 'add' mode the existing group members are filtered out of the picker.
  // For 'create' mode the friend from the original 1-on-1 is implicit so we
  // also hide them from the list (they're always included on confirm).
  const existingSet = useMemo(() => new Set(existingMemberIds), [existingMemberIds]);

  useEffect(() => {
    (async () => {
      try {
        const { contacts: list } = await contactService.getContacts();
        // Filter out contacts already in the group → picker list
        setContacts(list.filter((c) => !existingSet.has(c.id)));
        // Keep the full User objects for anyone implicitly included so we
        // can show their names in the group-name preview / generation.
        setImplicitMembers(list.filter((c) => existingSet.has(c.id)));
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
      if (mode === 'create') {
        // Upgrading a 1-on-1 to a group: build memberIds from the implicit
        // friend(s) (existingMemberIds) + the newly-picked contacts.
        // The backend's createGroup auto-includes the caller as creator
        // and admin, so we don't need to push user.id into memberIds.
        const memberIds = [...new Set([...existingMemberIds, ...Array.from(selected)])];

        // Auto-generate a sensible default name from ALL member display
        // names: the current user + implicit members (original 1-on-1
        // friend) + newly-picked contacts. Bug fixed: previously skipped
        // the implicit member so a "test, ML, Dalpha" group showed up as
        // "test, Dalpha".
        const newlyPickedUsers = contacts.filter((c) => selected.has(c.id));
        const allNames = [
          displayNameOf(user as any),
          ...implicitMembers.map((u) => displayNameOf(u)),
          ...newlyPickedUsers.map((u) => displayNameOf(u)),
        ];
        const shown = allNames.slice(0, 3);
        let groupName = shown.join(', ');
        const extra = allNames.length - shown.length;
        if (extra > 0) groupName += ` +${extra}`;

        const { chat } = await chatService.createGroup({
          groupName,
          memberIds,
        });
        Toast.show({ type: 'success', text1: t('group.created') || 'Group created' });
        // Replace the navigation stack: from old 1-on-1 chat → new group chat.
        navigation.getParent()?.navigate('ChatsTab', {
          screen: 'ChatScreen',
          params: { chatId: chat._id },
        });
      } else {
        await chatService.addMembers(chatId, Array.from(selected));
        Toast.show({ type: 'success', text1: t('group.membersAdded') });
        navigation.goBack();
      }
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
            <Text style={styles.confirmButtonText}>
              {mode === 'create' ? t('group.newGroup') : t('group.addMembers')}
            </Text>
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
