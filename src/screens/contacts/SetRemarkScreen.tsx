// Set/clear a remark (private nickname) for a contact. Local-only — see
// stores/remarksStore.ts for the persistence layer.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { remarksStore } from '../../stores/remarksStore';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';

interface Props {
  route: { params: { userId: string; currentName: string } };
  navigation: any;
}

const SetRemarkScreen = ({ route, navigation }: Props) => {
  const { userId, currentName } = route.params;
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [value, setValue] = useState(remarksStore.get(userId));

  const handleSave = () => {
    const trimmed = value.trim();
    remarksStore.set(userId, trimmed);
    Toast.show({
      type: 'success',
      text1: trimmed ? t('remark.saved') : t('remark.cleared'),
    });
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.subjectName} numberOfLines={1}>
        {currentName}
      </Text>

      <Text style={styles.label}>{t('remark.label')}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setValue}
        placeholder={t('remark.placeholder')}
        placeholderTextColor={colors.textMuted}
        autoFocus
        maxLength={40}
        returnKeyType="done"
        onSubmitEditing={handleSave}
      />
      <Text style={styles.hint}>{t('remark.hint')}</Text>

      <TouchableOpacity style={styles.saveBtn} activeOpacity={0.7} onPress={handleSave}>
        <Text style={styles.saveBtnText}>{t('common.save')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgDark,
    },
    content: {
      padding: spacing.lg,
    },
    subjectName: {
      fontSize: fontSize.sm,
      color: colors.textMuted,
      marginBottom: spacing.lg,
    },
    label: {
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    input: {
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: fontSize.md,
      color: colors.textPrimary,
    },
    hint: {
      fontSize: fontSize.xs,
      color: colors.textMuted,
      marginTop: spacing.sm,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: spacing.xl,
    },
    saveBtnText: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: '#fff',
    },
  });

export default SetRemarkScreen;
