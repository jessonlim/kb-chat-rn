import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import userService from '../../services/userService';
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

const CreateGroupScreen = ({ navigation }: Props) => {
  const { user } = useAuth();
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Step 1: select members   Step 2: enter group name + create
  const [step, setStep] = useState<1 | 2>(1);

  // Search state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Selection state
  const [selected, setSelected] = useState<User[]>([]);

  // Group name state
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  const doSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (trimmed.length < 2) {
        setResults([]);
        return;
      }

      setSearching(true);
      try {
        const { users } = await userService.searchUsers(trimmed);
        setResults(users.filter((u) => u.id !== user?.id));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [user?.id]
  );

  const handleChangeText = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(text), 400);
    },
    [doSearch]
  );

  const toggleUser = useCallback((u: User) => {
    setSelected((prev) => {
      const exists = prev.find((s) => s.id === u.id);
      if (exists) return prev.filter((s) => s.id !== u.id);
      return [...prev, u];
    });
  }, []);

  const removeSelected = useCallback((userId: string) => {
    setSelected((prev) => prev.filter((s) => s.id !== userId));
  }, []);

  const handleNext = () => {
    if (selected.length === 0) {
      Alert.alert(t('group.atLeastOne'), t('group.atLeastOne'));
      return;
    }
    setStep(2);
  };

  const handleCreate = async () => {
    const name = groupName.trim();
    if (!name) {
      Alert.alert(t('group.groupName'), t('group.groupNameRequired'));
      return;
    }

    setCreating(true);
    try {
      const memberIds = selected.map((u) => u.id);
      const { chat } = await chatService.createGroup({ groupName: name, memberIds });
      // Navigate to the new group chat
      navigation.replace('ChatScreen', { chatId: chat._id });
    } catch (err) {
      console.warn('Failed to create group:', err);
      Alert.alert(t('common.failed'), t('group.failedCreate'));
      setCreating(false);
    }
  };

  const isUserSelected = (userId: string) => selected.some((s) => s.id === userId);

  // ─── Step 2: Group name ────────────────────────────────────────────
  if (step === 2) {
    return (
      <View style={styles.container}>
        {/* Group name input */}
        <View style={styles.groupNameSection}>
          <View style={styles.groupIconPlaceholder}>
            <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
          </View>
          <TextInput
            style={styles.groupNameInput}
            placeholder={t('group.groupNamePlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={groupName}
            onChangeText={setGroupName}
            autoFocus
            maxLength={50}
          />
        </View>

        <View style={styles.divider} />

        {/* Member list */}
        <Text style={styles.sectionTitle}>
          {t('group.membersCount', { n: selected.length })}
        </Text>
        <FlatList
          data={selected}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => (
            <View style={styles.userRow}>
              <Avatar
                name={item.displayName || item.username}
                src={item.avatar}
                size={44}
              />
              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {item.displayName || item.username}
                </Text>
                <Text style={styles.userAbout}>@{item.username}</Text>
              </View>
              <TouchableOpacity
                onPress={() => removeSelected(item.id)}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}
        />

        {/* Create button */}
        <TouchableOpacity
          style={[
            styles.createButton,
            (!groupName.trim() || creating) && styles.createButtonDisabled,
          ]}
          onPress={handleCreate}
          disabled={!groupName.trim() || creating}
          activeOpacity={0.7}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark" size={22} color="#fff" />
              <Text style={styles.createButtonText}>{t('group.create')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Step 1: Select members ────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('group.searchByUsername')}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={handleChangeText}
          autoFocus
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setQuery('');
              setResults([]);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Selected chips */}
      {selected.length > 0 && (
        <View style={styles.chipsContainer}>
          {selected.map((u) => (
            <TouchableOpacity
              key={u.id}
              style={styles.chip}
              onPress={() => removeSelected(u.id)}
              activeOpacity={0.7}
            >
              <Avatar
                name={u.displayName || u.username}
                src={u.avatar}
                size={24}
              />
              <Text style={styles.chipText} numberOfLines={1}>
                {u.displayName || u.username}
              </Text>
              <Ionicons name="close" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.divider} />

      {/* Loading */}
      {searching && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>{t('chats.searching')}</Text>
        </View>
      )}

      {/* User list */}
      <FlatList
        data={results}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => {
          const isSelected = isUserSelected(item.id);
          return (
            <TouchableOpacity
              style={styles.userRow}
              activeOpacity={0.7}
              onPress={() => toggleUser(item)}
            >
              <Avatar
                name={item.displayName || item.username}
                src={item.avatar}
                size={44}
                online={item.isOnline}
              />
              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {item.displayName || item.username}
                </Text>
                <Text style={styles.userAbout}>@{item.username}</Text>
              </View>
              <View
                style={[
                  styles.checkbox,
                  isSelected && styles.checkboxSelected,
                ]}
              >
                {isSelected && (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          !searching ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>{t('group.searchByUsername')}</Text>
              <Text style={styles.emptySubtext}>
                {t('chat.searchHint')}
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={
          results.length === 0 && !searching
            ? { flex: 1, justifyContent: 'center' }
            : undefined
        }
        keyboardShouldPersistTaps="handled"
      />

      {/* Next button */}
      {selected.length > 0 && (
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNext}
          activeOpacity={0.7}
        >
          <Text style={styles.nextButtonText}>
            {selected.length === 1
              ? t('group.selected', { n: selected.length })
              : t('group.selectedPlural', { n: selected.length })}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
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
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: borderRadius.full,
    paddingRight: spacing.sm,
    paddingLeft: 2,
    paddingVertical: 2,
    gap: spacing.xs,
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    maxWidth: 100,
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
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  nextButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#fff',
  },
  // Step 2 styles
  groupNameSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  groupIconPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupNameInput: {
    flex: 1,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    paddingVertical: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#fff',
  },
});

export default CreateGroupScreen;
