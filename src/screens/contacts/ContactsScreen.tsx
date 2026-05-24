import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import contactService from '../../services/contactService';
import socketService from '../../services/socketService';
import Avatar from '../../components/common/Avatar';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';
import type { User } from '../../types';

interface Props {
  navigation: any;
}

interface Section {
  title: string;
  data: User[];
}

const ContactsScreen = ({ navigation }: Props) => {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [contacts, setContacts] = useState<User[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadContacts = useCallback(async () => {
    // Use allSettled so one failure doesn't blank the other section.
    // Previously a single 404 on the pending endpoint hid the entire
    // contact list because the catch block reset state to default.
    const [contactsRes, pendingRes] = await Promise.allSettled([
      contactService.getContacts(),
      contactService.getPendingRequests(),
    ]);
    if (contactsRes.status === 'fulfilled') {
      setContacts(contactsRes.value.contacts);
    } else {
      console.warn('getContacts failed:', contactsRes.reason);
    }
    if (pendingRes.status === 'fulfilled') {
      setPendingCount(pendingRes.value.requests.length);
    } else {
      console.warn('getPendingRequests failed:', pendingRes.reason);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Reload contacts every time this screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadContacts();
    });
    return unsubscribe;
  }, [navigation, loadContacts]);

  // Socket listeners
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const onFriendRequestReceived = () => {
      setPendingCount((prev) => prev + 1);
    };

    const onFriendRequestAccepted = () => {
      loadContacts();
    };

    const onUserOnline = (data: { userId: string }) => {
      setContacts((prev) =>
        prev.map((c) => (c.id === data.userId ? { ...c, isOnline: true } : c))
      );
    };

    const onUserOffline = (data: { userId: string }) => {
      setContacts((prev) =>
        prev.map((c) => (c.id === data.userId ? { ...c, isOnline: false } : c))
      );
    };

    socket.on('friend_request_received', onFriendRequestReceived);
    socket.on('friend_request_accepted', onFriendRequestAccepted);
    socket.on('user_online', onUserOnline);
    socket.on('user_offline', onUserOffline);

    return () => {
      socket.off('friend_request_received', onFriendRequestReceived);
      socket.off('friend_request_accepted', onFriendRequestAccepted);
      socket.off('user_online', onUserOnline);
      socket.off('user_offline', onUserOffline);
    };
  }, [loadContacts]);

  // Build alphabetical sections from contacts
  const sections: Section[] = useMemo(() => {
    const sorted = [...contacts].sort((a, b) => {
      const nameA = (a.displayName || a.username).toLowerCase();
      const nameB = (b.displayName || b.username).toLowerCase();
      return nameA.localeCompare(nameB);
    });

    const map: Record<string, User[]> = {};
    for (const contact of sorted) {
      const firstChar = (contact.displayName || contact.username)[0]?.toUpperCase() || '#';
      const letter = /[A-Z]/.test(firstChar) ? firstChar : '#';
      if (!map[letter]) map[letter] = [];
      map[letter].push(contact);
    }

    return Object.keys(map)
      .sort()
      .map((letter) => ({ title: letter, data: map[letter] }));
  }, [contacts]);

  const onRefresh = () => {
    setRefreshing(true);
    loadContacts();
  };

  const renderContact = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.contactRow}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
    >
      <Avatar
        name={item.displayName || item.username}
        src={item.avatar}
        size={48}
        online={item.isOnline}
      />
      <View style={styles.contactInfo}>
        <Text style={styles.contactName} numberOfLines={1}>
          {item.displayName || item.username}
        </Text>
        <Text style={styles.contactAbout} numberOfLines={1}>
          {item.about || `@${item.username}`}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  const renderHeader = () => (
    <TouchableOpacity
      style={styles.newFriendsRow}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('NewFriends')}
    >
      <View style={styles.newFriendsIcon}>
        <Ionicons name="person-add" size={22} color="#fff" />
      </View>
      <Text style={styles.newFriendsText}>{t('contacts.newFriends')}</Text>
      <View style={styles.newFriendsRight}>
        {pendingCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {pendingCount > 99 ? '99+' : pendingCount}
            </Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderContact}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t('contacts.empty')}</Text>
            <Text style={styles.emptySubtext}>
              {t('contacts.emptyHint')}
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bgDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // New Friends row
  newFriendsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  newFriendsIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newFriendsText: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
    marginLeft: spacing.md,
  },
  newFriendsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  // Section headers
  sectionHeader: {
    backgroundColor: colors.bgDark,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  // Contact rows
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  contactInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  contactName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  contactAbout: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
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
  },
});

export default ContactsScreen;
