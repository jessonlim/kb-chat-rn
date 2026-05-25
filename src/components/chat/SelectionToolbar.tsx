// Bottom toolbar shown while the chat is in multi-select mode. Provides
// batch Forward / Delete / Star / Copy actions. Lives in a fixed bar
// above the safe area, so the keyboard / input bar don't appear while
// selecting.

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../i18n/I18nContext';
import { spacing, fontSize } from '../../utils/theme';

interface Props {
  count: number;
  canDelete: boolean;     // only true when all selected msgs are own
  onForward: () => void;
  onDelete: () => void;
  onStar: () => void;
  onCopy: () => void;
  onCancel: () => void;
}

const SelectionToolbar = ({
  count,
  canDelete,
  onForward,
  onDelete,
  onStar,
  onCopy,
  onCancel,
}: Props) => {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onCancel} activeOpacity={0.7} style={styles.cancelBtn}>
          <Ionicons name="close" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.count}>{t('select.toolbar.title', { n: count })}</Text>
        <View style={styles.cancelBtn} />
      </View>

      <View style={styles.actionsRow}>
        <ToolbarAction
          icon="arrow-redo-outline"
          label={t('select.action.forward')}
          disabled={count === 0}
          onPress={onForward}
        />
        <ToolbarAction
          icon="star-outline"
          label={t('select.action.star')}
          disabled={count === 0}
          onPress={onStar}
        />
        <ToolbarAction
          icon="copy-outline"
          label={t('select.action.copy')}
          disabled={count === 0}
          onPress={onCopy}
        />
        <ToolbarAction
          icon="trash-outline"
          label={t('select.action.delete')}
          disabled={count === 0 || !canDelete}
          danger
          onPress={onDelete}
        />
      </View>
    </View>
  );
};

const ToolbarAction = ({
  icon,
  label,
  onPress,
  disabled,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const color = disabled
    ? colors.textMuted
    : danger
      ? colors.danger
      : colors.primary;
  return (
    <TouchableOpacity
      style={[styles.action, disabled && styles.actionDisabled]}
      activeOpacity={disabled ? 1 : 0.7}
      onPress={disabled ? undefined : onPress}
    >
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    wrap: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.bgCard,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    cancelBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    count: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingHorizontal: spacing.md,
    },
    action: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      gap: 4,
    },
    actionDisabled: {
      opacity: 0.5,
    },
    actionLabel: {
      fontSize: fontSize.xs,
      fontWeight: '500',
    },
  });

export default SelectionToolbar;
