import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';
import type { Message } from '../../types';

export type MessageAction =
  | 'reply'
  | 'copy'
  | 'edit'
  | 'delete'
  | 'forward'
  | 'star'
  | 'react';

interface Props {
  visible: boolean;
  message: Message | null;
  isOwn: boolean;
  onAction: (action: MessageAction) => void;
  onClose: () => void;
}

interface ActionItem {
  key: MessageAction;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  ownOnly?: boolean;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const MessageActions = ({ visible, message, isOwn, onAction, onClose }: Props) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const ACTIONS: ActionItem[] = [
    { key: 'reply', label: 'Reply', icon: 'arrow-undo-outline' },
    { key: 'copy', label: 'Copy', icon: 'copy-outline' },
    { key: 'edit', label: 'Edit', icon: 'create-outline', ownOnly: true },
    { key: 'forward', label: 'Forward', icon: 'arrow-redo-outline' },
    { key: 'star', label: 'Star', icon: 'star-outline' },
    { key: 'react', label: 'React', icon: 'happy-outline' },
    { key: 'delete', label: 'Delete', icon: 'trash-outline', color: colors.danger, ownOnly: true },
  ];

  if (!message) return null;

  const filteredActions = ACTIONS.filter((a) => {
    if (a.ownOnly && !isOwn) return false;
    // Can't copy non-text messages
    if (a.key === 'copy' && !message.content) return false;
    // Can't edit deleted messages
    if (a.key === 'edit' && message.deleted) return false;
    return true;
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Quick reactions row */}
          <View style={styles.reactionsRow}>
            {QUICK_REACTIONS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionButton}
                activeOpacity={0.7}
                onPress={() => {
                  onAction('react');
                  // The parent will handle sending the specific emoji
                  // For now, we emit 'react' and let the parent deal with it
                }}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.divider} />

          {/* Action list */}
          {filteredActions.map((action) => (
            <TouchableOpacity
              key={action.key}
              style={styles.actionRow}
              activeOpacity={0.7}
              onPress={() => onAction(action.key)}
            >
              <Ionicons
                name={action.icon}
                size={22}
                color={action.color || colors.textPrimary}
              />
              <Text style={[styles.actionLabel, action.color ? { color: action.color } : null]}>
                {action.key === 'star' && message.starredBy?.length
                  ? 'Unstar'
                  : action.label}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Cancel button */}
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.actionRow}
            activeOpacity={0.7}
            onPress={onClose}
          >
            <Ionicons name="close-outline" size={22} color={colors.textMuted} />
            <Text style={[styles.actionLabel, { color: colors.textMuted }]}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl + 10, // extra for safe area
  },
  reactionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  reactionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionEmoji: {
    fontSize: 22,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  actionLabel: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
});

export default MessageActions;
