import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../utils/theme';

interface Props {
  navigation: any;
}

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  screen: string | null; // null = coming soon
}

const menuItems: MenuItem[] = [
  { icon: 'megaphone-outline', label: 'Channels', screen: 'Channels' },
  { icon: 'heart-outline', label: 'Moments', screen: 'Moments' },
  { icon: 'wallet-outline', label: 'Wallet', screen: null },
  { icon: 'compass-outline', label: 'Mini Programs', screen: null },
];

const DiscoverScreen = ({ navigation }: Props) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.menuSection}>
        {menuItems.map((item, index) => {
          const isDisabled = !item.screen;
          return (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.menuRow,
                index < menuItems.length - 1 && styles.menuRowBorder,
                isDisabled && styles.menuRowDisabled,
              ]}
              activeOpacity={isDisabled ? 1 : 0.7}
              onPress={() => {
                if (item.screen) {
                  navigation.navigate(item.screen);
                }
              }}
            >
              <Ionicons
                name={item.icon}
                size={22}
                color={isDisabled ? colors.textMuted : colors.primary}
              />
              <Text
                style={[
                  styles.menuLabel,
                  isDisabled && styles.menuLabelDisabled,
                ]}
              >
                {item.label}
              </Text>
              {isDisabled ? (
                <Text style={styles.soonBadge}>SOON</Text>
              ) : (
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textMuted}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.footer}>
        Explore channels, moments, and more
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  content: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },
  menuSection: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
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
  menuRowDisabled: {
    opacity: 0.45,
  },
  menuLabel: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  menuLabelDisabled: {
    color: colors.textMuted,
  },
  soonBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  footer: {
    textAlign: 'center',
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xxl,
  },
});

export default DiscoverScreen;
