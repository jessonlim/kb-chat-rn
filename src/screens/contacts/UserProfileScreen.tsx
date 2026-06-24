import React, { useMemo, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import userService from '../../services/userService';
import contactService from '../../services/contactService';
import chatService from '../../services/chatService';
import * as authService from '../../services/authService';
import { useAuth } from '../../stores/authStore';
import { useCall } from '../../context/CallContext';
import Avatar from '../../components/common/Avatar';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';
import { useRemark } from '../../stores/remarksStore';
import type { User, ContactStatus } from '../../types';

interface Props {
  navigation: any;
  route: { params: { userId: string } };
}

const UserProfileScreen = ({ navigation, route }: Props) => {
  const { userId } = route.params;
  const { user: me } = useAuth();
  const { startCall, callState } = useCall();
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [profile, setProfile] = useState<User | null>(null);
  const [status, setStatus] = useState<ContactStatus>('none');
  const [requestId, setRequestId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  // Subscribes to the remarks store so this screen re-renders when the
  // user returns from the SetRemark screen with a saved change.
  const remark = useRemark(userId);

  const loadProfile = useCallback(async () => {
    try {
      const [userRes, statusRes, blockedRes] = await Promise.all([
        userService.getUserById(userId),
        contactService.getStatus(userId),
        authService.listBlockedUsers().catch(() => ({ users: [] })),
      ]);
      setProfile(userRes.user);
      setStatus(statusRes.status);
      setRequestId(statusRes.requestId);
      setIsBlocked((blockedRes.users || []).some((u: any) => (u.id || u._id) === userId));
    } catch (err) {
      console.warn('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSendMessage = async () => {
    if (!profile) return;
    setActionLoading(true);
    try {
      const { chat } = await chatService.createOrGetPrivateChat(profile.id);
      // Navigate to the Chats tab's ChatScreen
      navigation.navigate('ChatsTab', {
        screen: 'ChatScreen',
        params: { chatId: chat._id },
      });
    } catch (err) {
      console.warn('Failed to open chat:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddFriend = async () => {
    if (!profile) return;
    setActionLoading(true);
    try {
      await contactService.sendRequest(profile.id);
      setStatus('pending_sent');
    } catch (err) {
      console.warn('Failed to send friend request:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!requestId) return;
    setActionLoading(true);
    try {
      await contactService.acceptRequest(requestId);
      setStatus('friends');
    } catch (err) {
      console.warn('Failed to accept request:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!requestId) return;
    setActionLoading(true);
    try {
      await contactService.rejectRequest(requestId);
      setStatus('none');
      setRequestId(undefined);
    } catch (err) {
      console.warn('Failed to reject request:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCall = async (type: 'voice' | 'video') => {
    if (!profile || callState !== 'idle') return;
    try {
      const { chat } = await chatService.createOrGetPrivateChat(profile.id);
      const target = {
        id: profile.id,
        displayName: profile.displayName || profile.username,
        username: profile.username,
        avatar: profile.avatar,
      };
      startCall(target, chat._id, type);
    } catch (err) {
      console.warn('Failed to start call:', err);
      Alert.alert(t('common.failed'), t('call.cantStart'));
    }
  };

  const handleRemoveFriend = () => {
    if (!profile) return;
    Alert.alert(
      t('profile.removeFriend'),
      t('profile.confirmRemoveFriend'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.removeFriend'),
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await contactService.removeContact(profile.id);
              setStatus('none');
            } catch (err) {
              console.warn('Failed to remove contact:', err);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleBlock = () => {
    if (!profile) return;
    Alert.alert(
      t('privacy.block'),
      t('privacy.confirmBlock', { name: profile.displayName || profile.username }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('privacy.block'),
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await authService.blockUser(profile.id);
              setIsBlocked(true);
              // Friendship is preserved on block (reversible) — leave status as-is.
              Toast.show({ type: 'success', text1: t('privacy.blocked') });
            } catch {
              Toast.show({ type: 'error', text1: t('privacy.blockFailed') });
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleUnblock = async () => {
    if (!profile) return;
    setActionLoading(true);
    try {
      await authService.unblockUser(profile.id);
      setIsBlocked(false);
      Toast.show({ type: 'success', text1: t('privacy.unblocked') });
    } catch {
      Toast.show({ type: 'error', text1: t('privacy.unblockFailed') });
    } finally {
      setActionLoading(false);
    }
  };

  const formatLastSeen = (dateStr: string): string => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t('chat.lastSeen.justNow');
    if (minutes < 60) return t('chat.lastSeen.minAgo', { n: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      if (hours === 1) return t('chat.lastSeen.hourAgo', { n: hours });
      return t('chat.lastSeen.hoursAgo', { n: hours });
    }
    const days = Math.floor(hours / 24);
    if (days === 1) return t('chat.lastSeen.yesterday');
    return t('chat.lastSeen.date', {
      date: new Date(dateStr).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Ionicons name="person-outline" size={64} color={colors.textMuted} />
        <Text style={styles.errorText}>{t('qr.userNotFound')}</Text>
      </View>
    );
  }

  const isSelf = me?.id === profile.id;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <Avatar
          name={profile.displayName || profile.username}
          src={profile.avatar}
          size={100}
          online={profile.isOnline}
        />
      </View>

      {/* Name & info — remark overrides the displayName if set */}
      <Text style={styles.displayName}>
        {remark || profile.displayName || profile.username}
      </Text>
      {remark ? (
        <Text style={styles.remarkOriginal}>
          ({profile.displayName || profile.username})
        </Text>
      ) : null}
      <Text style={styles.username}>@{profile.username}</Text>

      {profile.about ? (
        <Text style={styles.about}>{profile.about}</Text>
      ) : null}

      {/* Online status */}
      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: profile.isOnline ? colors.online : colors.offline },
          ]}
        />
        <Text style={styles.statusText}>
          {profile.isOnline ? t('chat.online') : formatLastSeen(profile.lastSeen)}
        </Text>
      </View>

      {/* Action buttons — based on relationship */}
      {!isSelf && (
        <View style={styles.actionSection}>
          {status === 'friends' && (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                activeOpacity={0.7}
                onPress={handleSendMessage}
                disabled={actionLoading}
              >
                <Ionicons name="chatbubble" size={20} color={colors.primary} />
                <Text style={styles.actionButtonText}>{t('profile.sendMessage')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                activeOpacity={0.7}
                onPress={() => handleCall('voice')}
                disabled={callState !== 'idle'}
              >
                <Ionicons name="call" size={20} color={callState === 'idle' ? colors.primary : colors.textMuted} />
                <Text style={styles.actionButtonText}>{t('chat.voiceCall')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                activeOpacity={0.7}
                onPress={() => handleCall('video')}
                disabled={callState !== 'idle'}
              >
                <Ionicons name="videocam" size={20} color={callState === 'idle' ? colors.primary : colors.textMuted} />
                <Text style={styles.actionButtonText}>{t('chat.videoCall')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                activeOpacity={0.7}
                onPress={() =>
                  navigation.navigate('SetRemark', {
                    userId: profile.id,
                    currentName: profile.displayName || profile.username,
                  })
                }
              >
                <Ionicons name="create-outline" size={20} color={colors.primary} />
                <Text style={styles.actionButtonText}>{t('remark.title')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.dangerButton]}
                activeOpacity={0.7}
                onPress={handleRemoveFriend}
                disabled={actionLoading}
              >
                <Ionicons name="person-remove" size={20} color={colors.danger} />
                <Text style={styles.dangerButtonText}>{t('profile.removeFriend')}</Text>
              </TouchableOpacity>
            </>
          )}

          {status === 'none' && (
            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.7}
              onPress={handleAddFriend}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="person-add" size={20} color="#fff" />
                  <Text style={styles.primaryButtonText}>{t('profile.addFriend')}</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {status === 'pending_sent' && (
            <View style={styles.pendingButton}>
              <Ionicons name="time-outline" size={20} color={colors.textMuted} />
              <Text style={styles.pendingText}>{t('profile.requestSent')}</Text>
            </View>
          )}

          {status === 'pending_received' && (
            <View style={styles.receivedActions}>
              <TouchableOpacity
                style={styles.primaryButton}
                activeOpacity={0.7}
                onPress={handleAccept}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>{t('requests.accept')}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                activeOpacity={0.7}
                onPress={handleReject}
                disabled={actionLoading}
              >
                <Text style={styles.secondaryButtonText}>{t('requests.reject')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Block / Unblock — available for any other user */}
          <TouchableOpacity
            style={[styles.actionButton, styles.dangerButton]}
            activeOpacity={0.7}
            onPress={isBlocked ? handleUnblock : handleBlock}
            disabled={actionLoading}
          >
            <Ionicons
              name={isBlocked ? 'checkmark-circle-outline' : 'ban'}
              size={20}
              color={colors.danger}
            />
            <Text style={styles.dangerButtonText}>
              {isBlocked ? t('privacy.unblock') : t('privacy.block')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bgDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  avatarContainer: {
    marginTop: 32,
    marginBottom: spacing.lg,
  },
  displayName: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  username: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  remarkOriginal: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  about: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  // Actions
  actionSection: {
    width: '100%',
    marginTop: spacing.xxl,
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  actionButtonText: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  dangerButton: {
    marginTop: spacing.md,
  },
  dangerButtonText: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.danger,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    flex: 1,
    minHeight: 48,
  },
  primaryButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#fff',
  },
  pendingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  pendingText: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.textMuted,
  },
  receivedActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    flex: 1,
    minHeight: 48,
  },
  secondaryButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});

export default UserProfileScreen;
