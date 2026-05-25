import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import contactService from '../../services/contactService';
import chatService from '../../services/chatService';
import { useAuth } from '../../stores/authStore';
import Avatar from '../../components/common/Avatar';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';
import type { User } from '../../types';

interface Props {
  navigation: any;
}

const NewChatScreen = ({ navigation }: Props) => {
  const { user } = useAuth();
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState<string | null>(null);

  // Load all contacts once on mount. Then filter locally as the user types —
  // way faster than hitting the API on every keystroke, and partial-matching
  // becomes trivial: just substring on username/displayName.
  // (For finding NEW people who aren't your friend, use the search in
  // Contacts → New Friends, which requires the full username for privacy.)
  useEffect(() => {
    let alive = true;
    contactService.getContacts()
      .then((res) => {
        if (!alive) return;
        // Filter out self defensively (backend already excludes us)
        setContacts(res.contacts.filter((u) => u.id !== user?.id));
      })
      .catch((err) => console.warn('Failed to load contacts:', err))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [user?.id]);

  // Local substring filter — empty query returns the full list.
  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return contacts;
    return contacts.filter((u) => {
      const username = (u.username || '').toLowerCase();
      const displayName = (u.displayName || '').toLowerCase();
      return username.includes(trimmed) || displayName.includes(trimmed);
    });
  }, [query, contacts]);

  const handleChangeText = (text: string) => setQuery(text);

  const handleSelectUser = useCallback(
    async (selectedUser: User) => {
      if (startingChat) return; // Prevent double tap
      setStartingChat(selectedUser.id);
      try {
        const { chat } = await chatService.createOrGetPrivateChat(selectedUser.id);
        // Navigate to the chat, replacing this screen so back goes to chat list
        navigation.replace('ChatScreen', { chatId: chat._id });
      } catch (err) {
        console.warn('Failed to start chat:', err);
        setStartingChat(null);
      }
    },
    [navigation, startingChat]
  );

  const renderUser = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userRow}
      activeOpacity={0.7}
      onPress={() => handleSelectUser(item)}
      disabled={startingChat === item.id}
    >
      <Avatar
        name={item.displayName || item.username}
        src={item.avatar}
        size={48}
        online={item.isOnline}
      />
      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>
          {item.displayName || item.username}
        </Text>
        {item.about ? (
          <Text style={styles.userAbout} numberOfLines={1}>
            {item.about}
          </Text>
        ) : (
          <Text style={styles.userAbout}>@{item.username}</Text>
        )}
      </View>
      {startingChat === item.id && (
        <ActivityIndicator size="small" color={colors.primary} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('chats.searchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={handleChangeText}
          autoFocus
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Create group option */}
      <TouchableOpacity
        style={styles.createGroupRow}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('CreateGroup')}
      >
        <View style={styles.createGroupIcon}>
          <Ionicons name="people" size={24} color={colors.primary} />
        </View>
        <Text style={styles.createGroupText}>{t('chats.newGroup')}</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>

      <View style={styles.divider} />

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(u) => u.id}
          renderItem={renderUser}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                {query
                  ? t('contact.noMatch')
                  : t('contacts.empty')}
              </Text>
              <Text style={styles.emptySubtext}>
                {query ? '' : t('contacts.emptyHint')}
              </Text>
            </View>
          }
          contentContainerStyle={
            results.length === 0 ? { flex: 1, justifyContent: 'center' } : undefined
          }
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 44,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    height: '100%',
  },
  createGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  createGroupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createGroupText: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  userAbout: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyText: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});

export default NewChatScreen;
