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
      });
    } else {
      // For 1-on-1 chats, "+" would upgrade to a group — not built yet
      showSoon(t('chatInfo.addPeople'));
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

      {/* ── Search + Shared Media ────────────────────────── */}
      <View style={styles.section}>
        <Row
          icon="search-outline"
          label={t('chatInfo.searchHistory')}
          onPress={() => navigation.navigate('ChatScreen', { chatId, openSearch: true })}
          chevron
          colors={colors}
          styles={styles}
        />
        <Row
          icon="images-outline"
          label={t('chatInfo.sharedMedia')}
          onPress={() => navigation.navigate('SharedMedia', { chatId })}
          chevron
          bordered
          colors={colors}
          styles={styles}
        />
      </View>

      {/* ── Toggles ──────────────────────────────────────── */}
      <View style={styles.section}>
        <ToggleRow
          icon="notifications-off-outline"
          label={t('chatInfo.muteNotifications')}
          value={isMuted}
          onChange={handleToggleMute}
          colors={colors}
          styles={styles}
        />
        <ToggleRow
          icon="pin-outline"
          label={t('chatInfo.stickyOnTop')}
          value={isPinned}
          onChange={handleTogglePin}
          colors={colors}
          styles={styles}
          bordered
        />
        <ToggleRow
          icon="alert-circle-outline"
          label={t('chatInfo.alert')}
          value={isAlert}
          onChange={handleToggleAlert}
          colors={colors}
          styles={styles}
          bordered
        />
      </View>

      {/* ── Background / Clear / Report ──────────────────── */}
      <View style={styles.section}>
        <Row
          icon="image-outline"
          label={t('chatInfo.background')}
          onPress={() => showSoon(t('chatInfo.background'))}
          chevron
          colors={colors}
          styles={styles}
        />
      </View>

      <View style={styles.section}>
        <Row
          icon="trash-outline"
          label={t('chatInfo.clearHistory')}
          onPress={handleClearHistory}
          chevron
          loading={clearing}
          colors={colors}
          styles={styles}
        />
      </View>

      <View style={styles.section}>
        <Row
          icon="flag-outline"
          label={t('chatInfo.report')}
          onPress={() => showSoon(t('chatInfo.report'))}
          chevron
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
  onPress,
  chevron,
  loading,
  colors,
  styles,
  bordered,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
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
    <Ionicons name={icon} size={22} color={colors.textSecondary} />
    <Text style={styles.rowLabel}>{label}</Text>
    {loading ? (
      <ActivityIndicator size="small" color={colors.primary} />
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
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  styles: ReturnType<typeof makeStyles>;
  bordered?: boolean;
}) => (
  <View style={[styles.row, bordered && styles.rowBorder]}>
    <Ionicons name={icon} size={22} color={colors.textSecondary} />
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
});

export default ChatInfoScreen;
