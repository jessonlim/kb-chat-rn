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
import { useT } from '../../i18n/I18nContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';
import type { Message } from '../../types';

export type MessageAction =
  | 'reply'
  | 'copy'
  | 'edit'
  | 'delete'
  | 'forward'
  | 'star'
  | 'react'
  | 'select'
  | 'info'
  | 'translate'
  | 'transcribe'
  | 'pin';

interface Props {
  visible: boolean;
  message: Message | null;
  isOwn: boolean;
  onAction: (action: MessageAction) => void;
  // Called with the chosen emoji string when the user taps a quick-react
  // chip. If omitted, the parent should fall back to handling 'react' as
  // the legacy 👍 reaction.
  onReact?: (emoji: string) => void;
  onClose: () => void;
  // Group admins can pin/unpin a message. `isPinned` = this message is the
  // currently-pinned one (so the action toggles to "Unpin").
  canPin?: boolean;
  isPinned?: boolean;
}

interface ActionItem {
  key: MessageAction;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  ownOnly?: boolean;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const MessageActions = ({ visible, message, isOwn, onAction, onReact, onClose, canPin, isPinned }: Props) => {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const ACTIONS: ActionItem[] = [
    { key: 'reply', label: t('msg.reply'), icon: 'arrow-undo-outline' },
    { key: 'copy', label: t('msg.copy'), icon: 'copy-outline' },
    { key: 'edit', label: t('msg.edit'), icon: 'create-outline', ownOnly: true },
    { key: 'forward', label: t('msg.forward'), icon: 'arrow-redo-outline' },
    { key: 'star', label: t('msg.star'), icon: 'star-outline' },
    { key: 'pin', label: isPinned ? t('msg.unpin') : t('msg.pin'), icon: 'bookmark-outline' },
    { key: 'react', label: t('msg.react'), icon: 'happy-outline' },
    { key: 'select', label: t('select.menu'), icon: 'checkmark-circle-outline' },
    { key: 'translate', label: t('translate.action'), icon: 'language-outline' },
    { key: 'transcribe', label: t('voiceToText.transcribe'), icon: 'mic-outline' },
    { key: 'info', label: t('msgInfo.title'), icon: 'information-circle-outline', ownOnly: true },
    { key: 'delete', label: t('common.delete'), icon: 'trash-outline', color: colors.danger, ownOnly: true },
  ];

  if (!message) return null;

  const filteredActions = ACTIONS.filter((a) => {
    if (a.ownOnly && !isOwn) return false;
    // Can't copy non-text messages
    if (a.key === 'copy' && !message.content) return false;
    // Edit: your own TEXT message, not deleted, and only within 15 minutes of
    // sending (matches the backend's edit window — hide it once it's too late so
    // the user isn't offered an option that would just fail).
    if (a.key === 'edit') {
      if (message.deleted) return false;
      if (message.type !== 'text' || !message.content) return false;
      const sentAt = message.createdAt ? new Date(message.createdAt).getTime() : 0;
      if (sentAt && Date.now() - sentAt > 15 * 60 * 1000) return false;
    }
    // Pin/unpin: group admins only, and not on deleted/system messages.
    if (a.key === 'pin') {
      if (!canPin) return false;
      if (message.deleted || message.type === 'system') return false;
    }
    // Can't translate non-text messages
    if (a.key === 'translate' && (message.type !== 'text' || !message.content)) return false;
    // Transcribe is only meaningful for voice messages
    if (a.key === 'transcribe' && message.type !== 'audio') return false;
    // Can't get info for messages still sending or already deleted
    if (a.key === 'info' && (message.status === 'sending' || message.deleted)) return false;
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
          {/* Quick reactions row — each chip sends its own emoji.
              We close the sheet via the parent's onClose because reacting
              shouldn't dismiss to an action handler. */}
          <View style={styles.reactionsRow}>
            {QUICK_REACTIONS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionButton}
                activeOpacity={0.7}
                onPress={() => {
                  if (onReact) onReact(emoji);
                  else onAction('react'); // legacy fallback
                  onClose();
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
                  ? t('msg.unstar')
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
            <Text style={[styles.actionLabel, { color: colors.textMuted }]}>{t('common.cancel')}</Text>
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
