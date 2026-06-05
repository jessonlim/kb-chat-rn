// ChatInfoScreen — WeChat-style chat settings, opened from the 3-dot menu
// in a chat's header. Shows the participant(s) at top with an "+" to add
// people, plus rows for search history, mute/sticky/alert toggles, chat
// background, clear history, and report.
//
// For private chats: 1 participant tile + the "+" button.
// For group chats: all members in a horizontal grid (TODO — currently
// shows just first 6 + the "+" button).

import React, { useMemo, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import chatService from '../../services/chatService';
import socketService from '../../services/socketService';
import { storage } from '../../services/api';
import { useAuth } from '../../stores/authStore';
import Avatar from '../../components/common/Avatar';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';
import { chatPrefsStore, useChatPrefs } from '../../stores/chatPrefsStore';
import { displayNameOf } from '../../stores/remarksStore';
import type { Chat, User } from '../../types';

interface Props {
  route: { params: { chatId: string } };
  navigation: any;
}

const alertKey = (chatId: string) => `pref.alert.${chatId}`;

const ChatInfoScreen = ({ route, navigation }: Props) => {
  const { chatId } = route.params;
  const { user } = useAuth();
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [chat, setChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isAlert, setIsAlert] = useState(false);
  const [clearing, setClearing] = useState(false);
  // Local per-chat prefs (alias, remark, on-screen names, save-to-contacts)
  const prefs = useChatPrefs(chatId);
  // Inline-edit modal state. Replaces Alert.prompt (iOS-only) so the
  // edit flow works on Android too.
  const [editingField, setEditingField] = useState<null | 'groupName' | 'alias' | 'remark'>(null);
  const [editingValue, setEditingValue] = useState('');

  // ── Load chat metadata ──────────────────────────────────────────
  const loadChat = useCallback(async () => {
    try {
      const res = await chatService.getChatById(chatId);
      setChat(res.chat);
      setIsMuted(!!res.chat.isMuted);
      setIsPinned(!!res.chat.isPinned);
      setIsAlert(storage.getBoolean(alertKey(chatId)) ?? false);
    } catch (err) {
      console.warn('Failed to load chat info:', err);
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    loadChat();
  }, [loadChat]);

  // Live-refresh when the group changes (members added/removed, renamed,
  // avatar/admin change). The backend broadcasts chat_changed to every
  // participant; without this the member list stayed stale after adding
  // someone until the screen was reopened.
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;
    const onChatChanged = (data: { chat?: { _id?: string } }) => {
      if (!data?.chat?._id || data.chat._id === chatId) loadChat();
    };
    socket.on('chat_changed', onChatChanged);
    return () => {
      socket.off('chat_changed', onChatChanged);
    };
  }, [chatId, loadChat]);

  // Set the header title to "Chat Info (N)" with a search icon on the right
  // for groups. WeChat shows the member count in the title bar.
  useEffect(() => {
    if (!chat) return;
    const memberCount = chat.participants.length;
    navigation.setOptions({
      title: chat.type === 'group'
        ? t('chatInfo.title.withCount', { n: memberCount })
        : t('chatInfo.title'),
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('ChatScreen', { chatId, openSearch: true })}
          activeOpacity={0.7}
          style={{ paddingRight: 12 }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="search" size={22} color={colors.primary} />
        </TouchableOpacity>
      ),
    });
  }, [chat, navigation, t, colors.primary, chatId]);

  // ── Toggles ─────────────────────────────────────────────────────
  const handleToggleMute = useCallback(async () => {
    const next = !isMuted;
    setIsMuted(next); // optimistic
    try {
      await chatService.toggleMute(chatId);
    } catch (err: any) {
      setIsMuted(!next);
      Toast.show({ type: 'error', text1: err?.response?.data?.message || t('common.failed') });
    }
  }, [chatId, isMuted, t]);

  const handleTogglePin = useCallback(async () => {
    const next = !isPinned;
    setIsPinned(next);
    try {
      await chatService.togglePin(chatId);
    } catch (err: any) {
      setIsPinned(!next);
      Toast.show({ type: 'error', text1: err?.response?.data?.message || t('common.failed') });
    }
  }, [chatId, isPinned, t]);

  const handleToggleAlert = useCallback((next: boolean) => {
    setIsAlert(next);
    storage.set(alertKey(chatId), next);
  }, [chatId]);

  // Open the inline edit modal. Replaces Alert.prompt (iOS-only) so the
  // edit flow works on Android too.
  const handleEditGroupName = useCallback(() => {
    if (!chat || chat.type !== 'group') return;
    setEditingValue(chat.groupName || '');
    setEditingField('groupName');
  }, [chat]);

  const handleEditAlias = useCallback(() => {
    setEditingValue(prefs.alias || '');
    setEditingField('alias');
  }, [prefs.alias]);

  const handleEditRemark = useCallback(() => {
    setEditingValue(prefs.remark || '');
    setEditingField('remark');
  }, [prefs.remark]);

  // Commit the edit modal — dispatch the right action based on which field.
  const handleSaveEdit = useCallback(async () => {
    const field = editingField;
    const value = editingValue.trim();
    if (!field) return;

    if (field === 'groupName') {
      if (!chat || value === (chat.groupName || '')) {
        setEditingField(null);
        return;
      }
      try {
        const { chat: updated } = await chatService.updateGroup(chatId, { groupName: value });
        setChat(updated);
        Toast.show({ type: 'success', text1: t('common.save') });
      } catch (err: any) {
        Toast.show({
          type: 'error',
          text1: err?.response?.data?.message || t('common.failed'),
        });
      }
    } else if (field === 'alias') {
      chatPrefsStore.set(chatId, 'alias', value);
    } else if (field === 'remark') {
      chatPrefsStore.set(chatId, 'remark', value);
    }
    setEditingField(null);
  }, [editingField, editingValue, chat, chatId, t]);

  const handleToggleShowNames = useCallback((next: boolean) => {
    chatPrefsStore.set(chatId, 'showNames', next);
  }, [chatId]);

  const handleToggleSaveToContacts = useCallback((next: boolean) => {
    chatPrefsStore.set(chatId, 'savedToContacts', next);
  }, [chatId]);

  // ── Clear chat history ──────────────────────────────────────────
  const handleClearHistory = () => {
    Alert.alert(t('chatInfo.clearHistory'), t('chatInfo.clearConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('chatInfo.clearHistory'),
        style: 'destructive',
        onPress: async () => {
          setClearing(true);
          try {
            await chatService.deleteChatForMe(chatId);
            Toast.show({ type: 'success', text1: t('chatInfo.cleared') });
            // Return to the chat list — chat is now gone from your view
            navigation.popToTop();
          } catch (err: any) {
            Toast.show({
              type: 'error',
              text1: err?.response?.data?.message || t('common.failed'),
            });
          } finally {
            setClearing(false);
          }
        },
      },
    ]);
  };

  // "Coming soon" rows — these features aren't built yet
  const showSoon = (label: string) =>
    Toast.show({ type: 'info', text1: label, text2: t('common.soon') });

  if (loading || !chat) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // For private chats: just the other participant. For groups: all members.
  // Note: chat.participants includes the current user too; for private chats
  // we filter that out, for groups we keep everyone (so the user sees their
  // own tile too, matching WeChat).
  const isGroup = chat.type === 'group';
  const otherUsers: User[] = isGroup
    ? chat.participants
    : chat.participants.filter((p) => p.id !== user?.id);

  const handleAddPeople = () => {
    if (isGroup) {
      navigation.navigate('AddGroupMembers', {
        chatId,
        existingMemberIds: chat.participants.map((p) => p.id),
        mode: 'add',
      });
    } else {
      // 1-on-1 chat → tapping "+" upgrades it to a group. Pre-include
      // the existing friend so the picker only shows additional contacts;
      // on confirm AddGroupMembersScreen creates a fresh group chat with
      // the original friend + new picks and navigates to it.
      const otherUser = chat.participants.find((p) => p.id !== user?.id);
      if (!otherUser) return;
      navigation.navigate('AddGroupMembers', {
        chatId,
        existingMemberIds: [otherUser.id],
        mode: 'create',
      });
    }
  };

  const handleLeaveGroup = () => {
    Alert.alert(t('group.leave'), t('group.leaveConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('group.leave'),
        style: 'destructive',
        onPress: async () => {
          try {
            await chatService.leaveGroup(chatId);
            Toast.show({ type: 'success', text1: t('group.left') });
            navigation.popToTop();
          } catch (err: any) {
            Toast.show({
              type: 'error',
              text1: err?.response?.data?.message || t('common.failed'),
            });
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Participant tiles ────────────────────────────── */}
      <View style={styles.tilesWrap}>
        {otherUsers.map((u) => (
          <TouchableOpacity
            key={u.id}
            style={styles.tile}
            activeOpacity={0.7}
            onPress={() => {
              // Don't navigate to your own profile
              if (u.id === user?.id) return;
              const tabs = navigation.getParent?.();
              if (tabs) tabs.navigate('ContactsTab', { screen: 'UserProfile', params: { userId: u.id } });
            }}
          >
            <Avatar
              name={u.displayName || u.username}
              src={u.avatar}
              size={56}
            />
            <Text style={styles.tileName} numberOfLines={1}>
              {u.id === user?.id ? t('common.you') : (u.displayName || u.username)}
            </Text>
          </TouchableOpacity>
        ))}
        {/* "+" to add more members */}
        <TouchableOpacity
          style={styles.tile}
          activeOpacity={0.7}
          onPress={handleAddPeople}
        >
          <View style={styles.addTile}>
            <Ionicons name="add" size={28} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Group identity (group chats only) ─────────────── */}
      {isGroup && (
        <View style={styles.section}>
          <Row
            label={t('chatInfo.groupName')}
            valueRight={chat.groupName || ''}
            onPress={handleEditGroupName}
            chevron
            colors={colors}
            styles={styles}
          />
          <Row
            label={t('chatInfo.groupQR')}
            iconRight="qr-code-outline"
            onPress={() => navigation.navigate('GroupQR', {
              chatId,
              groupName: chat.groupName,
              groupImage: chat.groupImage,
              memberCount: chat.participants.length,
            })}
            bordered
            colors={colors}
            styles={styles}
          />
          <Row
            label={t('chatInfo.groupNotice')}
            onPress={() => showSoon(t('chatInfo.groupNotice'))}
            chevron
            bordered
            colors={colors}
            styles={styles}
          />
          <Row
            label={t('chatInfo.chatRemark')}
            valueRight={prefs.remark || ''}
            onPress={handleEditRemark}
            chevron
            bordered
            colors={colors}
            styles={styles}
          />
        </View>
      )}

      {/* ── Search + Shared Media ────────────────────────── */}
      <View style={styles.section}>
        <Row
          label={t('chatInfo.searchHistory')}
          onPress={() => navigation.navigate('ChatScreen', { chatId, openSearch: true })}
          chevron
          colors={colors}
          styles={styles}
        />
        <Row
          label={t('chatInfo.sharedMedia')}
          onPress={() => navigation.navigate('SharedMedia', { chatId })}
          chevron
          bordered
          colors={colors}
          styles={styles}
        />
      </View>

      {/* ── Mute / Sticky / Save to Contacts (group only) ── */}
      <View style={styles.section}>
        <ToggleRow
          label={t('chatInfo.muteNotifications')}
          value={isMuted}
          onChange={handleToggleMute}
          colors={colors}
          styles={styles}
        />
        <ToggleRow
          label={t('chatInfo.stickyOnTop')}
          value={isPinned}
          onChange={handleTogglePin}
          colors={colors}
          styles={styles}
          bordered
        />
        {isGroup && (
          <ToggleRow
            label={t('chatInfo.savedToContacts')}
            value={!!prefs.savedToContacts}
            onChange={handleToggleSaveToContacts}
            colors={colors}
            styles={styles}
            bordered
          />
        )}
      </View>

      {/* ── Group-only display prefs ─────────────────────── */}
      {isGroup && (
        <View style={styles.section}>
          <Row
            label={t('chatInfo.myAlias')}
            valueRight={prefs.alias || displayNameOf(user as any)}
            onPress={handleEditAlias}
            chevron
            colors={colors}
            styles={styles}
          />
          <ToggleRow
            label={t('chatInfo.showNames')}
            // Default ON — typical WeChat behaviour
            value={prefs.showNames !== false}
            onChange={handleToggleShowNames}
            colors={colors}
            styles={styles}
            bordered
          />
        </View>
      )}

      {/* ── Background ─────────────────────────────────── */}
      <View style={styles.section}>
        <Row
          label={t('chatInfo.background')}
          onPress={() => showSoon(t('chatInfo.background'))}
          chevron
          colors={colors}
          styles={styles}
        />
      </View>

      {/* ── Clear / Report ─────────────────────────────── */}
      <View style={styles.section}>
        <Row
          label={t('chatInfo.clearHistory')}
          onPress={handleClearHistory}
          chevron
          loading={clearing}
          colors={colors}
          styles={styles}
        />
        <Row
          label={t('chatInfo.report')}
          onPress={() => showSoon(t('chatInfo.report'))}
          chevron
          bordered
          colors={colors}
          styles={styles}
        />
      </View>

      {/* Leave Group — only for group chats */}
      {isGroup && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            onPress={handleLeaveGroup}
          >
            <Ionicons name="exit-outline" size={22} color={colors.danger} />
            <Text style={[styles.rowLabel, { color: colors.danger }]}>
              {t('group.leave')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Inline edit modal — Android-compatible replacement for Alert.prompt.
          Used for Group Name, My Alias in Group, and Remark. */}
      <Modal
        visible={editingField !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingField(null)}
      >
        <KeyboardAvoidingView
          style={styles.editOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.editBackdrop} onPress={() => setEditingField(null)}>
            <Pressable style={styles.editCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.editTitle}>
                {editingField === 'groupName'
                  ? t('chatInfo.editGroupName')
                  : editingField === 'alias'
                    ? t('chatInfo.editAlias')
                    : editingField === 'remark'
                      ? t('chatInfo.editRemark')
                      : ''}
              </Text>
              <TextInput
                style={styles.editInput}
                value={editingValue}
                onChangeText={setEditingValue}
                autoFocus
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                onSubmitEditing={handleSaveEdit}
                maxLength={40}
              />
              <View style={styles.editActions}>
                <TouchableOpacity
                  onPress={() => setEditingField(null)}
                  activeOpacity={0.7}
                  style={styles.editActionBtn}
                >
                  <Text style={styles.editCancel}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSaveEdit}
                  activeOpacity={0.7}
                  style={styles.editActionBtn}
                >
                  <Text style={styles.editSave}>{t('common.save')}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
};

// ── Re-usable row components ─────────────────────────────────────────
const Row = ({
  icon,
  label,
  valueRight,
  iconRight,
  onPress,
  chevron,
  loading,
  colors,
  styles,
  bordered,
}: {
  // Leading icon — optional (WeChat-style rows often have no icon).
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  // Optional value text shown right-aligned before the chevron
  // (e.g. "Group Name → PK")
  valueRight?: string;
  // Optional icon on the right instead of a chevron (e.g. QR icon)
  iconRight?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  chevron?: boolean;
  loading?: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  styles: ReturnType<typeof makeStyles>;
  bordered?: boolean;
}) => (
  <TouchableOpacity
    style={[styles.row, bordered && styles.rowBorder]}
    activeOpacity={0.7}
    onPress={onPress}
    disabled={loading}
  >
    {icon ? (
      <Ionicons name={icon} size={22} color={colors.textSecondary} />
    ) : null}
    <Text style={styles.rowLabel}>{label}</Text>
    {valueRight ? (
      <Text style={styles.rowValue} numberOfLines={1}>
        {valueRight}
      </Text>
    ) : null}
    {loading ? (
      <ActivityIndicator size="small" color={colors.primary} />
    ) : iconRight ? (
      <Ionicons name={iconRight} size={20} color={colors.textMuted} />
    ) : chevron ? (
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    ) : null}
  </TouchableOpacity>
);

const ToggleRow = ({
  icon,
  label,
  value,
  onChange,
  colors,
  styles,
  bordered,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  styles: ReturnType<typeof makeStyles>;
  bordered?: boolean;
}) => (
  <View style={[styles.row, bordered && styles.rowBorder]}>
    {icon ? (
      <Ionicons name={icon} size={22} color={colors.textSecondary} />
    ) : null}
    <Text style={styles.rowLabel}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: colors.bgInput, true: colors.primary }}
      thumbColor="#fff"
    />
  </View>
);

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingBottom: 40,
  },
  // Participant tiles row
  tilesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.bgCard,
  },
  tile: {
    alignItems: 'center',
    width: 64,
    gap: spacing.xs,
  },
  tileName: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  addTile: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  // Section groups
  section: {
    backgroundColor: colors.bgCard,
    marginTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    minHeight: 56,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowLabel: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  rowValue: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    maxWidth: 160,
    marginRight: spacing.xs,
  },
  // Inline-edit modal (group name / alias / remark)
  editOverlay: { flex: 1 },
  editBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  editCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  editTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  editInput: {
    backgroundColor: colors.bgInput,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.lg,
  },
  editActionBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  editCancel: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
  editSave: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: '600',
  },
});

export default ChatInfoScreen;
