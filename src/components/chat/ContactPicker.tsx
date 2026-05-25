// Pick one of your friends to share as a contact card in chat.
// The picked contact is serialised to JSON and stored in `content`
// (no attachments). The receiving bubble renders an actionable card
// the recipient can tap to view that person's profile.

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../common/Avatar';
import contactService from '../../services/contactService';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../i18n/I18nContext';
import { displayNameOf } from '../../stores/remarksStore';
import { spacing, fontSize, borderRadius } from '../../utils/theme';
import type { User } from '../../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (card: {
    userId: string;
    username: string;
    displayName?: string;
    avatar?: string;
  }) => void;
}

const ContactPicker = ({ visible, onClose, onPick }: Props) => {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [contacts, setContacts] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) {
      setQuery('');
      return;
    }
    let alive = true;
    setLoading(true);
    contactService
      .getContacts()
      .then((res) => alive && setContacts(res.contacts))
      .catch((err) => console.warn('[ContactPicker] load failed', err))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [visible]);

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return contacts;
    return contacts.filter((u) => {
      const name = displayNameOf(u).toLowerCase();
      const username = (u.username || '').toLowerCase();
      return name.includes(trimmed) || username.includes(trimmed);
    });
  }, [contacts, query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>{t('contactCard.title')}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </Pressable>
          </View>

          <Text style={styles.subtitle}>{t('contactCard.pick')}</Text>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={t('contact.searchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
          ) : (
            <FlatList
              data={results}
              keyExtractor={(u) => u.id}
              style={{ maxHeight: 380 }}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.empty}>{t('contact.noFriends')}</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => {
                    onPick({
                      userId: item.id,
                      username: item.username,
                      displayName: item.displayName,
                      avatar: item.avatar,
                    });
                    onClose();
                  }}
                >
                  <Avatar name={displayNameOf(item)} src={item.avatar} size={42} />
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {displayNameOf(item)}
                    </Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      @{item.username}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.bgCard,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
      maxHeight: '75%',
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
    },
    title: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    subtitle: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
      paddingBottom: spacing.md,
      fontSize: fontSize.sm,
      color: colors.textMuted,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginHorizontal: spacing.lg,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.bgInput,
      borderRadius: borderRadius.md,
      height: 40,
      marginBottom: spacing.sm,
    },
    searchInput: {
      flex: 1,
      fontSize: fontSize.md,
      color: colors.textPrimary,
      height: '100%',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    rowInfo: { flex: 1 },
    rowName: {
      fontSize: fontSize.md,
      color: colors.textPrimary,
    },
    rowSub: {
      fontSize: fontSize.xs,
      color: colors.textMuted,
      marginTop: 2,
    },
    empty: {
      textAlign: 'center',
      color: colors.textMuted,
      paddingVertical: spacing.lg,
    },
  });

export default ContactPicker;
