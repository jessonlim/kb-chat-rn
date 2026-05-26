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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import chatService from '../../services/chatService';
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

  // ── Load chat metadata ──────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
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
    };
    load();
  }, [chatId]);

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

  // Tap "Group Name" row → inline edit via Alert prompt + save via REST.
  // On Android, Alert.prompt isn't available, so we fall back to an
  // inline TextInput modal would be nicer — for now we use a prompt that
  // works on iOS, and an Alert with "OK / Cancel" plus a separate route
  // would be cleaner long-term.
  const handleEditGroupName = useCallback(async () => {
    if (!chat || chat.type !== 'group') return;
    // Simple cross-platform approach: ask once via Alert with the current
    // name shown; user taps Edit → we present a TextInput in-screen.
    // For brevity (and because Alert.prompt is iOS-only), navigate to a
    // small dedicated screen would be ideal. v1: use Alert.prompt on iOS,
    // skip on Android (we'll wire a screen if needed).
    const currentName = chat.groupName || '';
    const newName = await new Promise<string | null>((resolve) => {
      const A: any = Alert;
      if (typeof A.prompt === 'function') {
        A.prompt(
          t('chatInfo.editGroupName'),
          '',
          [
            { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(null) },
            { text: t('common.save'), onPress: (text: string) => resolve(text) },
          ],
          'plain-text',
          currentName,
        );
      } else {
        // Android: nudge the user to navigate to a future edit screen.
        // For now we just show what it would do.
        Toast.show({ type: 'info', text1: t('chatInfo.editGroupName'), text2: currentName });
        resolve(null);
      }
    });
    if (!newName || newName.trim() === currentName) return;
    try {
      const { chat: updated } = await chatService.updateGroup(chatId, { groupName: newName.trim() });
      setChat(updated);
      Toast.show({ type: 'success', text1: t('common.save') });
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: err?.response?.data?.message || t('common.failed'),
      });
    }
  }, [chat, chatId, t]);

  // Per-chat local pref editors — all MMKV-only via chatPrefsStore
  const handleEditAlias = useCallback(() => {
    const A: any = Alert;
    if (typeof A.prompt === 'function') {
      A.prompt(
        t('chatInfo.editAlias'),
        '',
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.save'),
            onPress: (text: string) => chatPrefsStore.set(chatId, 'alias', (text || '').trim()),
          },
        ],
        'plain-text',
        prefs.alias || '',
      );
    } else {
      Toast.show({ type: 'info', text1: t('chatInfo.editAlias'), text2: prefs.alias || '' });
    }
  }, [chatId, prefs.alias, t]);

  const handleEditRemark = useCallback(() => {
    const A: any = Alert;
    if (typeof A.prompt === 'function') {
      A.prompt(
        t('chatInfo.editRemark'),
        '',
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.save'),
            onPress: (text: string) => chatPrefsStore.set(chatId, 'remark', (text || '').trim()),
          },
        ],
        'plain-text',
        prefs.remark || '',
      );
    } else {
      Toast.show({ type: 'info', text1: t('chatInfo.editRemark'), text2: prefs.remark || '' });
    }
  }, [chatId, prefs.remark, t]);

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
});

export default ChatInfoScreen;
