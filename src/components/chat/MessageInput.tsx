import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../utils/theme';
import type { Message } from '../../types';

interface Props {
  onSend: (text: string) => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  replyTo?: Message | null;
  onCancelReply?: () => void;
  editMessage?: Message | null;
  onCancelEdit?: () => void;
  onSendEdit?: (messageId: string, newContent: string) => void;
}

const MessageInput = ({
  onSend,
  onTypingStart,
  onTypingStop,
  replyTo,
  onCancelReply,
  editMessage,
  onCancelEdit,
  onSendEdit,
}: Props) => {
  const [text, setText] = useState('');
  const typingRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const inputRef = useRef<TextInput>(null);

  // When entering edit mode, pre-fill the text
  useEffect(() => {
    if (editMessage) {
      setText(editMessage.content);
      // Focus the input after a short delay so keyboard opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [editMessage]);

  // When entering reply mode, focus the input
  useEffect(() => {
    if (replyTo) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [replyTo]);

  const handleChangeText = (value: string) => {
    setText(value);

    // Typing indicator logic (skip during edit)
    if (editMessage) return;
    if (value.length > 0 && !typingRef.current) {
      typingRef.current = true;
      onTypingStart?.();
    }
    // Reset stop timer
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      if (typingRef.current) {
        typingRef.current = false;
        onTypingStop?.();
      }
    }, 2000);
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (editMessage && onSendEdit) {
      // Edit mode — send edit
      onSendEdit(editMessage._id, trimmed);
      setText('');
      return;
    }

    onSend(trimmed);
    setText('');
    // Clear typing
    if (typingRef.current) {
      typingRef.current = false;
      onTypingStop?.();
    }
  };

  const handleCancelReply = () => {
    onCancelReply?.();
  };

  const handleCancelEdit = () => {
    onCancelEdit?.();
    setText('');
  };

  const getReplyPreview = (): string => {
    if (!replyTo) return '';
    if (replyTo.type === 'image') return 'Photo';
    if (replyTo.type === 'video') return 'Video';
    if (replyTo.type === 'audio') return 'Voice message';
    if (replyTo.type === 'file') return 'File';
    return replyTo.content || '';
  };

  const getReplyName = (): string => {
    if (!replyTo) return '';
    const sender = replyTo.sender;
    if (typeof sender === 'object') {
      return sender.displayName || sender.username;
    }
    return 'User';
  };

  const hasText = text.trim().length > 0;
  const showReplyBar = replyTo && !editMessage;
  const showEditBar = !!editMessage;

  return (
    <View>
      {/* Reply-to bar */}
      {showReplyBar && (
        <View style={styles.replyBar}>
          <View style={styles.replyIndicator} />
          <View style={styles.replyContent}>
            <Text style={styles.replyName} numberOfLines={1}>
              {getReplyName()}
            </Text>
            <Text style={styles.replyPreview} numberOfLines={1}>
              {getReplyPreview()}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelReply}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Edit bar */}
      {showEditBar && (
        <View style={styles.replyBar}>
          <View style={[styles.replyIndicator, { backgroundColor: colors.info }]} />
          <View style={styles.replyContent}>
            <Text style={[styles.replyName, { color: colors.info }]}>Editing message</Text>
            <Text style={styles.replyPreview} numberOfLines={1}>
              {editMessage!.content}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelEdit}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input row */}
      <View style={styles.container}>
        {/* Attachment button — Phase 4 */}
        <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
          <Ionicons name="add-circle-outline" size={26} color={colors.textMuted} />
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Message"
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={handleChangeText}
          multiline
          maxLength={10000}
        />

        {hasText ? (
          <TouchableOpacity style={styles.sendButton} onPress={handleSend} activeOpacity={0.7}>
            <Ionicons
              name={editMessage ? 'checkmark' : 'send'}
              size={20}
              color="#fff"
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
            <Ionicons name="mic-outline" size={26} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgHeader,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.bgInput,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    maxHeight: 120,
    minHeight: 40,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgHeader,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  replyIndicator: {
    width: 3,
    height: '100%',
    minHeight: 32,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  replyContent: {
    flex: 1,
    justifyContent: 'center',
  },
  replyName: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 1,
  },
  replyPreview: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  cancelButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MessageInput;
