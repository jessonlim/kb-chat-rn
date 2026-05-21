import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../utils/theme';
import type { Message, User } from '../../types';

interface Props {
  message: Message;
  isOwn: boolean;
  showSenderName?: boolean;
  onLongPress?: (message: Message) => void;
}

const formatTime = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const statusIcon = (status: Message['status']): string => {
  switch (status) {
    case 'sending': return '⏳';
    case 'failed': return '❌';
    case 'sent': return '✓';
    case 'delivered': return '✓✓';
    case 'read': return '✓✓';
    default: return '';
  }
};

const MessageBubble = ({ message, isOwn, showSenderName, onLongPress }: Props) => {
  const sender = typeof message.sender === 'object' ? message.sender : null;

  const handleLongPress = () => {
    if (onLongPress && !message.deleted && message.type !== 'system') {
      onLongPress(message);
    }
  };

  // System messages (user joined, etc.)
  if (message.type === 'system') {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemText}>{message.content}</Text>
      </View>
    );
  }

  // Deleted messages
  if (message.deleted) {
    return (
      <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther, styles.deleted]}>
          <Text style={styles.deletedText}>This message was deleted</Text>
        </View>
      </View>
    );
  }

  // Reply preview
  const replyTo = message.replyTo;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onLongPress={handleLongPress}
      delayLongPress={300}
      style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}
    >
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        {/* Sender name in group chats */}
        {showSenderName && sender && !isOwn && (
          <Text style={styles.senderName}>
            {sender.displayName || sender.username}
          </Text>
        )}

        {/* Reply preview */}
        {replyTo && (
          <View style={styles.replyBar}>
            <Text style={styles.replyName} numberOfLines={1}>
              {typeof replyTo.sender === 'object'
                ? replyTo.sender.displayName || replyTo.sender.username
                : 'User'}
            </Text>
            <Text style={styles.replyContent} numberOfLines={1}>
              {replyTo.content || (replyTo.type === 'image' ? '📷 Photo' : '📎 Attachment')}
            </Text>
          </View>
        )}

        {/* Media placeholder — will be built in Phase 4 */}
        {message.type === 'image' && message.attachments?.[0] && (
          <Text style={styles.mediaPlaceholder}>📷 [Image — Phase 4]</Text>
        )}
        {message.type === 'video' && (
          <Text style={styles.mediaPlaceholder}>🎥 [Video — Phase 4]</Text>
        )}
        {message.type === 'audio' && (
          <Text style={styles.mediaPlaceholder}>🎤 [Voice — Phase 4]</Text>
        )}
        {message.type === 'file' && (
          <Text style={styles.mediaPlaceholder}>
            📎 {message.attachments?.[0]?.name || 'File'}
          </Text>
        )}

        {/* Text content */}
        {message.content ? (
          <Text style={[styles.content, isOwn ? styles.contentOwn : styles.contentOther]}>
            {message.content}
          </Text>
        ) : null}

        {/* Timestamp + status */}
        <View style={styles.meta}>
          {message.edited && <Text style={styles.edited}>edited</Text>}
          <Text style={styles.time}>{formatTime(message.createdAt)}</Text>
          {isOwn && (
            <Text style={[styles.status, message.status === 'read' && styles.statusRead]}>
              {statusIcon(message.status)}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.md,
    marginBottom: 4,
  },
  rowOwn: {
    alignItems: 'flex-end',
  },
  rowOther: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  bubbleOwn: {
    backgroundColor: colors.bubbleSent,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.bubbleReceived,
    borderBottomLeftRadius: 4,
  },
  deleted: {
    opacity: 0.6,
  },
  deletedText: {
    color: colors.textMuted,
    fontStyle: 'italic',
    fontSize: fontSize.sm,
  },
  senderName: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.primaryLight,
    marginBottom: 2,
  },
  replyBar: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryLight,
    paddingLeft: spacing.sm,
    marginBottom: spacing.xs,
    opacity: 0.8,
  },
  replyName: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.primaryLight,
  },
  replyContent: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  mediaPlaceholder: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    paddingVertical: spacing.xs,
  },
  content: {
    fontSize: fontSize.md,
    lineHeight: 20,
  },
  contentOwn: {
    color: colors.bubbleSentText,
  },
  contentOther: {
    color: colors.bubbleReceivedText,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 2,
  },
  edited: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    fontStyle: 'italic',
  },
  time: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
  },
  status: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
  },
  statusRead: {
    color: '#60a5fa',
  },
  systemRow: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  systemText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    backgroundColor: colors.bgCard,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
});

export default MessageBubble;
