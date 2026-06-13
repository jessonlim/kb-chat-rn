import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../stores/authStore';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import Avatar from '../../components/common/Avatar';
import { spacing, fontSize, borderRadius } from '../../utils/theme';

interface Props {
  navigation: any;
}

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
}

const MeScreen = ({ navigation }: Props) => {
  const { user, logout } = useAuth();
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const handleSignOut = () => {
    Alert.alert(t('me.logout'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('me.logout'), style: 'destructive', onPress: logout },
    ]);
  };

  const menuItems: MenuItem[] = [
    {
      icon: 'qr-code-outline',
      label: t('qr.myQR'),
      onPress: () => navigation.navigate('MyQR'),
    },
    {
      icon: 'people-circle-outline',
      label: t('account.switch'),
      onPress: () => navigation.navigate('AccountSwitcher'),
    },
    {
      icon: 'settings-outline',
      label: t('settings.title'),
      onPress: () => navigation.navigate('Settings'),
    },
    {
      icon: 'star-outline',
      label: t('me.starredMessages'),
      onPress: () => navigation.navigate('StarredMessages'),
    },
    {
      icon: 'shield-checkmark-outline',
      label: t('settings.section.security'),
      onPress: () => navigation.navigate('AccountSecurity'),
    },
    {
      icon: 'information-circle-outline',
      label: t('settings.section.about'),
      onPress: () => navigation.navigate('About'),
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile card */}
      <TouchableOpacity
        style={styles.profileCard}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('ProfileEdit')}
      >
        <Avatar
          name={user?.displayName || user?.username || '?'}
          src={user?.avatar}
          size={72}
        />
        <View style={styles.profileInfo}>
          <Text style={styles.displayName} numberOfLines={1}>
            {user?.displayName || user?.username}
          </Text>
          <Text style={styles.username} numberOfLines={1}>
            @{user?.username}
          </Text>
          {user?.about ? (
            <Text style={styles.about} numberOfLines={2}>
              {user.about}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Menu items */}
      <View style={styles.menuSection}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            style={[
              styles.menuRow,
              index < menuItems.length - 1 && styles.menuRowBorder,
            ]}
            activeOpacity={0.7}
            onPress={item.onPress}
          >
            <Ionicons name={item.icon} size={22} color={colors.textSecondary} />
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        style={styles.signOutButton}
        activeOpacity={0.7}
        onPress={handleSignOut}
      >
        <Ionicons name="log-out-outline" size={22} color={colors.danger} />
        <Text style={styles.signOutText}>{t('me.logout')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 40,
  },
  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  profileInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  username: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  about: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  // Menu
  menuSection: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    marginTop: spacing.xl,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  menuRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuLabel: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  // Sign Out
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  signOutText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.danger,
  },
});

export default MeScreen;
