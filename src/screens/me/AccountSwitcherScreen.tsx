// Multi-account switcher (Batch 3 Phase 3). Lists the saved accounts on this
// device (up to 5), lets you switch between them without re-entering a password,
// add another, or remove one. The active account shows a check; tap another to
// switch; tap + to add. Removing the active account = log out (use Settings).

import React, { useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../stores/authStore';
import { accountsStore } from '../../stores/accountsStore';
import Avatar from '../../components/common/Avatar';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';

interface Props {
  navigation: any;
}

const AccountSwitcherScreen = ({ navigation }: Props) => {
  const { accounts, switchAccount, beginAddAccount, removeAccount } = useAuth();
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const activeId = accountsStore.getActiveId();

  const onRemove = (id: string, name: string) => {
    Alert.alert(t('account.removeTitle'), t('account.removeConfirm', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('account.removeAction'), style: 'destructive', onPress: () => { void removeAccount(id); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={accounts}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => {
          const isActive = item.id === activeId;
          return (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.7}
              disabled={isActive}
              onPress={() => switchAccount(item.id)}
            >
              <Avatar name={item.displayName || item.username} src={item.avatar} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{item.displayName || item.username}</Text>
                <Text style={styles.username} numberOfLines={1}>@{item.username}</Text>
              </View>
              {isActive ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
              ) : (
                <TouchableOpacity
                  onPress={() => onRemove(item.id, item.displayName || item.username)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle-outline" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          <TouchableOpacity style={styles.addRow} activeOpacity={0.7} onPress={() => beginAddAccount()}>
            <View style={styles.addIcon}>
              <Ionicons name="add" size={24} color={colors.primary} />
            </View>
            <Text style={styles.addText}>{t('account.add')}</Text>
          </TouchableOpacity>
        }
      />
      <Text style={styles.hint}>{t('account.hint')}</Text>
    </View>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  content: { paddingTop: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    backgroundColor: colors.bgCard,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  name: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  username: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 16,
  },
  addIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { fontSize: fontSize.md, fontWeight: '600', color: colors.primary },
  hint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
});

export default AccountSwitcherScreen;
