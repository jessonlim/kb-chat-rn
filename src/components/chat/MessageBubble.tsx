import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';
import { useMediaUrl } from '../../hooks/useMediaUrl';
import AudioPlayer from './AudioPlayer';
import type { Message, User } from '../../types';

interface Props {
  message: Message;
  isOwn: boolean;
  showSenderName?: boolean;
  onLongPress?: (message: Message) => void;
  onImagePress?: (uri: string) => void;
}

const formatTime = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const statusIcon = (status: Message['status']): string => {
  switch (status) {
    case 'sending': return '...';
    case 'failed': return '!';
    case 'sent': return '✓';
    case 'delivered': return '✓✓';
    case 'read': return '✓✓';
    default: return '';
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ── Sub-components for media types ────────────────────────────────────

const ImageAttachment = ({
  url,
  isOwn,
  onPress,
}: {
  url: string;
  isOwn: boolean;
  onPress?: (uri: string) => void;
}) => {
  const { colors } = useTheme();
  const imgStyles = useMemo(() => makeImgStyles(colors), [colors]);
  const { uri, loading } = useMediaUrl(url);

  if (loading || !uri) {
    return (
      <View style={imgStyles.placeholder}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress?.(uri)}
      style={imgStyles.wrapper}
    >
      <Image source={{ uri }} style={imgStyles.image} resizeMode="cover" />
    </TouchableOpacity>
  );
};

const makeImgStyles = (_colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  wrapper: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: 4,
  },
  image: {
    width: 220,
    height: 180,
    borderRadius: borderRadius.md,
  },
  placeholder: {
    width: 220,
    height: 180,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const VideoAttachment = ({
  url,
  isOwn,
}: {
  url: string;
  isOwn: boolean;
}) => {
  const { colors } = useTheme();
  const vidStyles = useMemo(() => makeVidStyles(colors), [colors]);
  const { uri, loading } = useMediaUrl(url);

  return (
    <View style={vidStyles.wrapper}>
      {loading || !uri ? (
        <View style={vidStyles.placeholder}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <View style={vidStyles.placeholder}>
          {/* Video thumbnail — we show a play overlay on a dark bg */}
          <Image source={{ uri }} style={vidStyles.thumb} resizeMode="cover" />
          <View style={vidStyles.playOverlay}>
            <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.85)" />
          </View>
        </View>
      )}
    </View>
  );
};

const makeVidStyles = (_colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  wrapper: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: 4,
  },
  placeholder: {
    width: 220,
    height: 160,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.md,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
});

const FileAttachment = ({
  name,
  size,
  isOwn,
}: {
  name: string;
  size: number;
  isOwn: boolean;
}) => {
  const { colors } = useTheme();
  const fileStyles = useMemo(() => makeFileStyles(colors), [colors]);
  return (
    <View style={fileStyles.row}>
      <View style={[fileStyles.iconBox, isOwn ? fileStyles.iconBoxOwn : fileStyles.iconBoxOther]}>
        <Ionicons name="document-outline" size={22} color={isOwn ? colors.bubbleSent : colors.primary} />
      </View>
      <View style={fileStyles.info}>
        <Text style={fileStyles.name} numberOfLines={1}>
          {name || 'File'}
        </Text>
        {size > 0 && <Text style={fileStyles.size}>{formatFileSize(size)}</Text>}
      </View>
    </View>
  );
};

const makeFileStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxOwn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  iconBoxOther: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  size: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 1,
  },
});

// ── Main bubble ───────────────────────────────────────────────────────

const MessageBubble = ({ message, isOwn, showSenderName, onLongPress, onImagePress }: Props) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
  const attachment = message.attachments?.[0];

  // For media messages, use a slightly wider bubble
  const isMedia = message.type === 'image' || message.type === 'video';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onLongPress={handleLongPress}
      delayLongPress={300}
      style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}
    >
      <View
        style={[
          styles.bubble,
          isOwn ? styles.bubbleOwn : styles.bubbleOther,
          isMedia && styles.mediaBubble,
        ]}
      >
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
              {replyTo.content || (replyTo.type === 'image' ? 'Photo' : 'Attachment')}
            </Text>
          </View>
        )}

        {/* ── Media content ── */}
        {message.type === 'image' && attachment && (
          <ImageAttachment
            url={attachment.url}
            isOwn={isOwn}
            onPress={onImagePress}
          />
        )}

        {message.type === 'video' && attachment && (
          <VideoAttachment url={attachment.url} isOwn={isOwn} />
        )}

        {message.type === 'audio' && attachment && (
          <AudioPlayer url={attachment.url} isOwn={isOwn} />
        )}

        {message.type === 'file' && attachment && (
          <FileAttachment
            name={attachment.name}
            size={attachment.size}
            isOwn={isOwn}
          />
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

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
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
  mediaBubble: {
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
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
    paddingHorizontal: spacing.sm,
  },
  replyBar: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryLight,
    paddingLeft: spacing.sm,
    marginBottom: spacing.xs,
    opacity: 0.8,
    marginHorizontal: spacing.sm,
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
  content: {
    fontSize: fontSize.md,
    lineHeight: 20,
    paddingHorizontal: spacing.sm,
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
    paddingHorizontal: spacing.sm,
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
