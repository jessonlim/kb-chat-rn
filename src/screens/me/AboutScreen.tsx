import React from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useT } from '../../i18n/I18nContext';
import { colors, spacing, fontSize, borderRadius } from '../../utils/theme';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

const AboutScreen = () => {
  const { t, lang } = useT();
  const openLink = (url: string) => Linking.openURL(url).catch(() => {});

  const linkItems = [
    {
      icon: 'globe-outline' as const,
      label: lang === 'zh' ? '访问官网' : 'Visit website',
      url: 'https://www.kb-chat.com',
    },
    {
      icon: 'mail-outline' as const,
      label: lang === 'zh' ? '联系客服' : 'Contact support',
      url: 'mailto:support@kb-chat.com',
    },
    {
      icon: 'shield-outline' as const,
      label: lang === 'zh' ? '隐私政策' : 'Privacy Policy',
      url: 'https://www.kb-chat.com/privacy',
    },
    {
      icon: 'document-text-outline' as const,
      label: lang === 'zh' ? '服务条款' : 'Terms of Service',
      url: 'https://www.kb-chat.com/terms',
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* App icon + name */}
      <View style={styles.header}>
        <Image source={require('../../../assets/icon.png')} style={styles.logo} />
        <Text style={styles.appName}>{t('app.appName')}</Text>
        <Text style={styles.version}>{t('about.version')} {APP_VERSION}</Text>
      </View>

      {/* Links */}
      <View style={styles.section}>
        {linkItems.map((item, i) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.row, i < linkItems.length - 1 && styles.rowBorder]}
            activeOpacity={0.7}
            onPress={() => openLink(item.url)}
          >
            <Ionicons name={item.icon} size={22} color={colors.textSecondary} />
            <Text style={styles.rowLabel}>{item.label}</Text>
            <Ionicons name="open-outline" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Credits */}
      <Text style={styles.credits}>
        {lang === 'zh' ? '由 Meka Games 出品' : 'Made by Meka Games'}
      </Text>
      <Text style={styles.copyright}>
        {lang === 'zh'
          ? '© 2026 KB Chat。保留所有权利。'
          : '© 2026 KB Chat. All rights reserved.'}
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 20,
    marginBottom: spacing.md,
  },
  appName: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  version: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  section: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  credits: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  copyright: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});

export default AboutScreen;
