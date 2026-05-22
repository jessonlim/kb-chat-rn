import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../../i18n/I18nContext';
import { colors, spacing, fontSize } from '../../utils/theme';

const StarredMessagesScreen = () => {
  const { t } = useT();
  return (
    <View style={styles.container}>
      <Ionicons name="star-outline" size={64} color={colors.textMuted} />
      <Text style={styles.title}>{t('starred.title')}</Text>
      <Text style={styles.description}>{t('starred.empty')}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  description: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 22,
  },
});

export default StarredMessagesScreen;
