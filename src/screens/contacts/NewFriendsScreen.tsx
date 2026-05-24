// NewFriendsScreen — search for users + send friend requests, and review
// any incoming pending requests. Two sections in one screen:
//   1. Top: search input + results, each result has an Add/Pending/Friends button
//   2. Bottom: incoming friend requests with Accept / Reject

import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import contactService from '../../services/contactService';
import userService from '../../services/userService';
import { useAuth } from '../../stores/authStore';
import Avatar from '../../components/common/Avatar';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';
import type { FriendRequest, User } from '../../types';

// Cached relationship status per user, used to render the right action.
type Status = 'none' | 'pending' | 'incoming' | 'friend' | 'self' | 'blocked' | 'loading';

const NewFriendsScreen = () => {
  const { user: me } = useAuth();
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // ── Search ──────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<string, Status>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Pending requests ────────────────────────────────────────────
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // ── Initial load ────────────────────────────────────────────────
  const loadRequests = useCallback(async () => {
    try {
      const { requests: data } = await contactService.getPendingRequests();
      setRequests(data);
    } catch (err) {
      console.warn('Failed to load friend requests:', err);
    } finally {
      setLoadingRequests(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // ── Search logic ────────────────────────────────────────────────
  const doSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (trimmed.length < 2) {
        setResults([]);
        setHasSearched(false);
        return;
      }
      setSearching(true);
      setHasSearched(true);
      try {
        const { users } = await userService.searchUsers(trimmed);
        const others = users.filter((u) => u.id !== me?.id);
        setResults(others);

        // Fetch friend-status for each result so we can label the button
        const updates: Record<string, Status> = {};
        others.forEach((u) => { updates[u.id] = 'loading'; });
        setStatusMap((prev) => ({ ...prev, ...updates }));

        await Promise.all(
          others.map(async (u) => {
            try {
              const res = await contactService.getStatus(u.id);
              const raw = (res as any).status ?? (res as any).relationship ?? 'none';
              const status: Status =
                raw === 'friend' || raw === 'friends' || raw === 'accepted' ? 'friend' :
                raw === 'pending' || raw === 'sent' || raw === 'requested' ? 'pending' :
                raw === 'incoming' ? 'incoming' :
                raw === 'self' ? 'self' :
                raw === 'blocked' ? 'blocked' :
                'none';
              setStatusMap((prev) => ({ ...prev, [u.id]: status }));
            } catch {
              setStatusMap((prev) => ({ ...prev, [u.id]: 'none' }));
            }
          }),
        );
      } catch (err) {
        console.warn('Search failed:', err);
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [me?.id],
  );

  // Debounced typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  // ── Send friend request ─────────────────────────────────────────
  const handleSendRequest = async (target: User) => {
    setStatusMap((prev) => ({ ...prev, [target.id]: 'loading' }));
    try {
      await contactService.sendRequest(target.id);
      setStatusMap((prev) => ({ ...prev, [target.id]: 'pending' }));
      Toast.show({ type: 'success', text1: t('requests.sent') });
    } catch (err: any) {
      setStatusMap((prev) => ({ ...prev, [target.id]: 'none' }));
      Toast.show({
        type: 'error',
        text1: err?.response?.data?.message || t('common.failed'),
      });
    }
  };

  // ── Pending request actions ─────────────────────────────────────
  const handleAccept = async (requestId: string) => {
    setProcessingIds((prev) => new Set(prev).add(requestId));
    try {
      await contactService.acceptRequest(requestId);
      setRequests((prev) => prev.filter((r) => r._id !== requestId));
    } catch (err) {
      console.warn('Failed to accept:', err);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingIds((prev) => new Set(prev).add(requestId));
    try {
      await contactService.rejectRequest(requestId);
      setRequests((prev) => prev.filter((r) => r._id !== requestId));
    } catch (err) {
      console.warn('Failed to reject:', err);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  const formatTimeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t('moments.justNow');
    if (minutes < 60) return t('moments.minutesAgo', { n: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('moments.hoursAgo', { n: hours });
    const days = Math.floor(hours / 24);
    if (days < 7) return t('moments.daysAgo', { n: days });
    return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // ── Renderers ───────────────────────────────────────────────────
  const renderSearchResult = ({ item }: { item: User }) => {
    const status = statusMap[item.id] || 'none';
    return (
      <View style={styles.searchRow}>
        <Avatar name={item.displayName || item.username} src={item.avatar} size={44} />
        <View style={styles.searchInfo}>
          <Text style={styles.searchName} numberOfLines={1}>
            {item.displayName || item.username}
          </Text>
          <Text style={styles.searchUsername} numberOfLines={1}>
            @{item.username}
          </Text>
        </View>
        <StatusButton
          status={status}
          onAdd={() => handleSendRequest(item)}
          colors={colors}
          styles={styles}
          t={t}
        />
      </View>
    );
  };

  const renderRequest = ({ item }: { item: FriendRequest }) => {
    const requester = item.requester;
    const isProcessing = processingIds.has(item._id);
    return (
      <View style={styles.requestRow}>
        <Avatar
          name={requester.displayName || requester.username}
          src={requester.avatar}
          size={48}
        />
        <View style={styles.requestInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.requestName} numberOfLines={1}>
              {requester.displayName || requester.username}
            </Text>
            <Text style={styles.timeAgo}>{formatTimeAgo(item.createdAt)}</Text>
          </View>
          <Text style={styles.requestUsername} numberOfLines={1}>
            @{requester.username}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.acceptButton}
              activeOpacity={0.7}
              onPress={() => handleAccept(item._id)}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.acceptText}>{t('requests.accept')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rejectButton}
              activeOpacity={0.7}
              onPress={() => handleReject(item._id)}
              disabled={isProcessing}
            >
              <Text style={styles.rejectText}>{t('requests.reject')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search bar — always visible at the top */}
      <View style={styles.searchBarWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('contact.searchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {!!query && (
          <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={hasSearched ? results : []}
        keyExtractor={(u) => u.id}
        renderItem={renderSearchResult}
        ListHeaderComponent={
          searching ? (
            <View style={styles.searchingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.searchingText}>{t('chats.searching')}</Text>
            </View>
          ) : hasSearched && results.length === 0 && !searching ? (
            <View style={styles.searchEmpty}>
              <Text style={styles.searchEmptyText}>{t('contact.noMatch')}</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View>
            {/* Section header for incoming requests */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{t('requests.title')}</Text>
            </View>
            {loadingRequests ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
            ) : requests.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="person-add-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>{t('requests.empty')}</Text>
              </View>
            ) : (
              requests.map((req) => <View key={req._id}>{renderRequest({ item: req })}</View>)
            )}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadRequests();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </View>
  );
};

// ── Add / Pending / Friends button ────────────────────────────────────
const StatusButton = ({
  status,
  onAdd,
  colors,
  styles,
  t,
}: {
  status: Status;
  onAdd: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  styles: ReturnType<typeof makeStyles>;
  t: (key: any) => string;
}) => {
  if (status === 'loading') {
    return <ActivityIndicator size="small" color={colors.primary} />;
  }
  if (status === 'self') return null;
  if (status === 'friend') {
    return (
      <View style={[styles.statusBtn, { backgroundColor: 'transparent' }]}>
        <Ionicons name="checkmark" size={14} color={colors.success} />
        <Text style={[styles.statusBtnText, { color: colors.success }]}>
          {t('contact.friends')}
        </Text>
      </View>
    );
  }
  if (status === 'pending') {
    return (
      <View style={[styles.statusBtn, { backgroundColor: colors.bgInput }]}>
        <Text style={[styles.statusBtnText, { color: colors.textMuted }]}>
          {t('contact.pending')}
        </Text>
      </View>
    );
  }
  if (status === 'incoming') {
    return (
      <View style={[styles.statusBtn, { backgroundColor: colors.bgInput }]}>
        <Text style={[styles.statusBtnText, { color: colors.textSecondary }]}>
          {t('contact.respond')}
        </Text>
      </View>
    );
  }
  if (status === 'blocked') {
    return (
      <View style={[styles.statusBtn, { backgroundColor: colors.bgInput }]}>
        <Text style={[styles.statusBtnText, { color: colors.textMuted }]}>—</Text>
      </View>
    );
  }
  // 'none' — show Add
  return (
    <TouchableOpacity
      style={[styles.statusBtn, { backgroundColor: colors.primary }]}
      activeOpacity={0.7}
      onPress={onAdd}
    >
      <Ionicons name="person-add" size={14} color="#fff" />
      <Text style={[styles.statusBtnText, { color: '#fff' }]}>{t('contact.add')}</Text>
    </TouchableOpacity>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  // Search bar
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    paddingVertical: 4,
  },
  // Search results
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  searchInfo: { flex: 1 },
  searchName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  searchUsername: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  statusBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  searchingText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  searchEmpty: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  searchEmptyText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  // Section header
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
  },
  sectionHeaderText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Pending request rows
  requestRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  requestInfo: { flex: 1 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requestName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  timeAgo: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  requestUsername: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  acceptButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    minWidth: 80,
    alignItems: 'center',
  },
  acceptText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: colors.bgInput,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  rejectText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
});

export default NewFriendsScreen;
