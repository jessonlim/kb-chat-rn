import React, { useEffect, useState, useCallback } from 'react';
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
import userService from '../../services/userService';
import contactService from '../../services/contactService';
import chatService from '../../services/chatService';
import { useAuth } from '../../stores/authStore';
import { useCall } from '../../context/CallContext';
import Avatar from '../../components/common/Avatar';
import { colors, spacing, fontSize, borderRadius } from '../../utils/theme';
import type { User, ContactStatus } from '../../types';

interface Props {
  navigation: any;
  route: { params: { userId: string } };
}

const UserProfileScreen = ({ navigation, route }: Props) => {
  const { userId } = route.params;
  const { user: me } = useAuth();
  const { startCall, callState } = useCall();

  const [profile, setProfile] = useState<User | null>(null);
  const [status, setStatus] = useState<ContactStatus>('none');
  const [requestId, setRequestId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const [userRes, statusRes] = await Promise.all([
        userService.getUserById(userId),
        contactService.getStatus(userId),
      ]);
      setProfile(userRes.user);
      setStatus(statusRes.status);
      setRequestId(statusRes.requestId);
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
      Alert.alert('Error', 'Could not start call');
    }
  };

  const handleRemoveFriend = () => {
    if (!profile) return;
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${profile.displayName || profile.username} from your contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
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

  const formatLastSeen = (dateStr: string): string => {
    if (!dateStr) return 'Unknown';
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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
        <Text style={styles.errorText}>User not found</Text>
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

      {/* Name & info */}
      <Text style={styles.displayName}>
        {profile.displayName || profile.username}
      </Text>
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
          {profile.isOnline ? 'Online' : `Last seen ${formatLastSeen(profile.lastSeen)}`}
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
                <Text style={styles.actionButtonText}>Send Message</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                activeOpacity={0.7}
                onPress={() => handleCall('voice')}
                disabled={callState !== 'idle'}
              >
                <Ionicons name="call" size={20} color={callState === 'idle' ? colors.primary : colors.textMuted} />
                <Text style={styles.actionButtonText}>Voice Call</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                activeOpacity={0.7}
                onPress={() => handleCall('video')}
                disabled={callState !== 'idle'}
              >
                <Ionicons name="videocam" size={20} color={callState === 'idle' ? colors.primary : colors.textMuted} />
                <Text style={styles.actionButtonText}>Video Call</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.dangerButton]}
                activeOpacity={0.7}
                onPress={handleRemoveFriend}
                disabled={actionLoading}
              >
                <Ionicons name="person-remove" size={20} color={colors.danger} />
                <Text style={styles.dangerButtonText}>Remove Friend</Text>
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
                  <Text style={styles.primaryButtonText}>Add Friend</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {status === 'pending_sent' && (
            <View style={styles.pendingButton}>
              <Ionicons name="time-outline" size={20} color={colors.textMuted} />
              <Text style={styles.pendingText}>Request Sent</Text>
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
                  <Text style={styles.primaryButtonText}>Accept</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                activeOpacity={0.7}
                onPress={handleReject}
                disabled={actionLoading}
              >
                <Text style={styles.secondaryButtonText}>Reject</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
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
