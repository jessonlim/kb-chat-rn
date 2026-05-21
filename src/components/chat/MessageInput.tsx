import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../utils/theme';

interface Props {
  onSend: (text: string) => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
}

const MessageInput = ({ onSend, onTypingStart, onTypingStop }: Props) => {
  const [text, setText] = useState('');
  const typingRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleChangeText = (value: string) => {
    setText(value);

    // Typing indicator logic
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
    onSend(trimmed);
    setText('');
    // Clear typing
    if (typingRef.current) {
      typingRef.current = false;
      onTypingStop?.();
    }
  };

  const hasText = text.trim().length > 0;

  return (
    <View style={styles.container}>
      {/* Attachment button — Phase 4 */}
      <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
        <Ionicons name="add-circle-outline" size={26} color={colors.textMuted} />
      </TouchableOpacity>

      <TextInput
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
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
          <Ionicons name="mic-outline" size={26} color={colors.textMuted} />
        </TouchableOpacity>
      )}
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
});

export default MessageInput;
