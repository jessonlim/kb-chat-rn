import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import channelService from '../../services/channelService';
import Avatar from '../../components/common/Avatar';
import { useMediaUrl } from '../../hooks/useMediaUrl';
import { colors, spacing, fontSize, borderRadius } from '../../utils/theme';
import type { Channel } from '../../types';

interface Props {
  navigation: any;
}

type Tab = 'mine' | 'discover';

const ChannelsScreen = ({ navigation }: Props) => {
  const [tab, setTab] = useState<Tab>('mine');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const { channels } =
        tab === 'mine'
          ? await channelService.listMine()
          : await channelService.listAll();
      setChannels(channels);
    } catch (err) {
      console.warn('Failed to load channels:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  // Reload when coming back from detail (e.g. after subscribing)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      load();
    });
    return unsubscribe;
  }, [navigation, load]);

  const renderChannel = ({ item }: { item: Channel }) => (
    <ChannelRow
      channel={item}
      onPress={() =>
        navigation.navigate('ChannelDetail', { channelId: item._id })
      }
    />
  );

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'mine' && styles.tabActive]}
          onPress={() => setTab('mine')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              tab === 'mine' && styles.tabTextActive,
            ]}
          >
            My Channels
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'discover' && styles.tabActive]}
          onPress={() => setTab('discover')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              tab === 'discover' && styles.tabTextActive,
            ]}
          >
            Discover
          </Text>
        </TouchableOpacity>
      </View>

      {/* Channel list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={channels}
          keyExtractor={(item) => item._id}
          renderItem={renderChannel}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="megaphone-outline"
                size={64}
                color={colors.textMuted}
              />
              <Text style={styles.emptyText}>
                {tab === 'mine'
                  ? 'No channels yet'
                  : 'No channels to discover'}
              </Text>
              {tab === 'mine' && (
                <Text style={styles.emptySubtext}>
                  Create a channel or subscribe to one from Discover
                </Text>
              )}
            </View>
          }
          contentContainerStyle={
            channels.length === 0 ? { flex: 1 } : undefined
          }
        />
      )}
    </View>
  );
};

// ── Channel row component ───────────────────────────────────────────

const ChannelRow = ({
  channel,
  onPress,
}: {
  channel: Channel;
  onPress: () => void;
}) => {
  const { uri: avatarUri } = useMediaUrl(channel.avatar || '');

  return (
    <TouchableOpacity
      style={styles.channelRow}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <Avatar
        name={channel.name}
        src={avatarUri || undefined}
        size={48}
      />
      <View style={styles.channelInfo}>
        <View style={styles.channelNameRow}>
          <Text style={styles.channelName} numberOfLines={1}>
            {channel.name}
          </Text>
          {channel.isOwner && (
            <View style={styles.ownerBadge}>
              <Text style={styles.ownerBadgeText}>OWNER</Text>
            </View>
          )}
        </View>
        <Text style={styles.channelDesc} numberOfLines={1}>
          {channel.description || `@${channel.owner.username}`}
        </Text>
        <View style={styles.subscriberRow}>
          <Ionicons name="people-outline" size={12} color={colors.textMuted} />
          <Text style={styles.subscriberText}>
            {channel.subscriberCount}{' '}
            {channel.subscriberCount === 1 ? 'subscriber' : 'subscribers'}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bgHeader,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.primary,
  },
  // Channel rows
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  channelInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  channelNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  channelName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  ownerBadge: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  ownerBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  channelDesc: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  subscriberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  subscriberText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyText: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});

export default ChannelsScreen;
