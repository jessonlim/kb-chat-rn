import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../stores/authStore';
import { spacing, fontSize, borderRadius } from '../../utils/theme';
import { Video, ResizeMode } from 'expo-av';
import { useMediaUrl } from '../../hooks/useMediaUrl';
import AudioPlayer from './AudioPlayer';
import LinkPreview, { extractUrl } from './LinkPreview';
import type { Message, User } from '../../types';

interface Props {
  message: Message;
  isOwn: boolean;
  showSenderName?: boolean;
  onLongPress?: (message: Message) => void;
  onImagePress?: (uri: string) => void;
  onVideoPress?: (uri: string) => void;
  // Multi-select integration. When `selectMode` is true the bubble
  // becomes a single-tap toggle (long-press is disabled) and we render
  // a checkbox circle on the leading side.
  selectMode?: boolean;
  selected?: boolean;
  onSelectToggle?: (message: Message) => void;
  // Tapping the bubble itself (when not in select mode). Optional —
  // currently used by location messages to open in maps.
  onPress?: (message: Message) => void;
  // Optional translated version of the text — rendered as a faint
  // sub-text below the original when present.
  translation?: string;
  // True if this message is currently pinned in the chat — shows a pin icon
  // on the bubble (pinned state lives on the chat, so it's passed in).
  isPinned?: boolean;
  // Briefly true right after the user jumps to this message (tapping the pinned
  // banner or a search result) — the row flashes a tint so it's easy to spot.
  highlighted?: boolean;
  // Tapping an existing reaction chip toggles that emoji for the current user.
  onReactionPress?: (emoji: string) => void;
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
  onPress,
}: {
  url: string;
  isOwn: boolean;
  onPress?: (uri: string) => void;
}) => {
  const { colors } = useTheme();
  const vidStyles = useMemo(() => makeVidStyles(colors), [colors]);
  const { uri, loading } = useMediaUrl(url);

  return (
    <TouchableOpacity
      style={vidStyles.wrapper}
      activeOpacity={0.85}
      onPress={() => uri && onPress?.(uri)}
      disabled={!uri}
    >
      {loading || !uri ? (
        <View style={vidStyles.placeholder}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <View style={vidStyles.placeholder}>
          {/* First-frame thumbnail: render a paused <Video> in cover mode.
              A plain <Image source={{ uri: videoFile }}> can't decode a
              video file — that's why our previous thumbnail was blank.
              Setting shouldPlay=false freezes on the first frame. */}
          <Video
            source={{ uri }}
            style={vidStyles.thumb}
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
            isMuted
            // Prevents the player from buffering more than needed for the
            // first frame; we don't actually play it here.
            positionMillis={0}
          />
          <View style={vidStyles.playOverlay}>
            <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.85)" />
          </View>
        </View>
      )}
    </TouchableOpacity>
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

// ── Sticker / Location / Contact card sub-components ────────────────

// Stickers are stored as image attachments with type='sticker'. We render
// them larger than a regular image and skip the bubble padding.
const StickerAttachment = ({ url }: { url: string }) => {
  const { uri } = useMediaUrl(url);
  if (!uri) return null;
  return (
    <Image
      source={{ uri }}
      style={{ width: 140, height: 140, backgroundColor: 'transparent' }}
      resizeMode="contain"
    />
  );
};

// Location messages encode their data in `content` as JSON:
//   { "lat": 3.1234, "lng": 101.6789, "name": "Optional venue name" }
const LocationAttachment = ({ message, isOwn }: { message: Message; isOwn: boolean }) => {
  const { colors } = useTheme();
  let lat = 0;
  let lng = 0;
  let name = '';
  try {
    const parsed = JSON.parse(message.content || '{}');
    lat = parsed.lat || 0;
    lng = parsed.lng || 0;
    name = parsed.name || '';
  } catch {
    /* ignore */
  }

  const openInMaps = () => {
    const url =
      Platform.OS === 'ios'
        ? `maps:0,0?q=${lat},${lng}`
        : `geo:${lat},${lng}?q=${lat},${lng}`;
    Linking.openURL(url).catch(() => {
      // Fall back to Google Maps web
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
    });
  };

  return (
    <TouchableOpacity
      onPress={openInMaps}
      activeOpacity={0.85}
      style={{
        width: 220,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.xs,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
        }}
      >
        <Ionicons name="location" size={22} color={isOwn ? '#fff' : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: fontSize.sm,
            color: isOwn ? colors.bubbleSentText : colors.bubbleReceivedText,
            fontWeight: '600',
          }}
          numberOfLines={1}
        >
          {name || 'Location'}
        </Text>
        <Text
          style={{
            fontSize: fontSize.xs,
            color: isOwn ? 'rgba(255,255,255,0.6)' : colors.textMuted,
            marginTop: 2,
          }}
          numberOfLines={1}
        >
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// Contact card messages encode the shared user in `content` as JSON:
//   { "userId": "...", "username": "...", "displayName": "...", "avatar": "..." }
const ContactCardAttachment = ({ message, isOwn }: { message: Message; isOwn: boolean }) => {
  const { colors } = useTheme();
  let card: { userId?: string; username?: string; displayName?: string; avatar?: string } = {};
  try {
    card = JSON.parse(message.content || '{}');
  } catch {
    /* ignore */
  }
  const { uri } = useMediaUrl(card.avatar);
  return (
    <View
      style={{
        width: 220,
        paddingVertical: spacing.xs,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {uri ? (
          <Image source={{ uri }} style={{ width: 44, height: 44, borderRadius: 22 }} />
        ) : (
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>
              {(card.displayName || card.username || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: fontSize.sm,
              fontWeight: '600',
              color: isOwn ? colors.bubbleSentText : colors.bubbleReceivedText,
            }}
            numberOfLines={1}
          >
            {card.displayName || card.username}
          </Text>
          <Text
            style={{
              fontSize: fontSize.xs,
              color: isOwn ? 'rgba(255,255,255,0.6)' : colors.textMuted,
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            @{card.username}
          </Text>
        </View>
      </View>
    </View>
  );
};

// ── Main bubble ───────────────────────────────────────────────────────

const MessageBubble = ({
  message,
  isOwn,
  showSenderName,
  onLongPress,
  onImagePress,
  onVideoPress,
  selectMode,
  selected,
  onSelectToggle,
  onPress,
  translation,
  isPinned,
  highlighted,
  onReactionPress,
}: Props) => {
  const { colors, fontScaleMultiplier } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const sender = typeof message.sender === 'object' ? message.sender : null;
  // Cluster reactions by emoji → { emoji, count, mine } for the chips below the bubble.
  const reactionGroups = useMemo(() => {
    const groups: Record<string, { count: number; mine: boolean }> = {};
    for (const r of message.reactions || []) {
      if (!groups[r.emoji]) groups[r.emoji] = { count: 0, mine: false };
      groups[r.emoji].count += 1;
      if (String(r.user) === user?.id) groups[r.emoji].mine = true;
    }
    return Object.entries(groups);
  }, [message.reactions, user?.id]);
  // Starred BY ME — starredBy is per-user, so a message shows a star only
  // if the current user starred it. IDs may arrive as ObjectId strings, so
  // compare stringified.
  const isStarred = !!message.starredBy?.some(
    (id) => String(id) === user?.id
  );

  const handleLongPress = () => {
    // While in select mode we suppress long-press so we don't open the
    // message-action sheet on top of the selection toolbar.
    if (selectMode) return;
    if (onLongPress && !message.deleted && message.type !== 'system') {
      onLongPress(message);
    }
  };

  const handlePress = () => {
    if (selectMode) {
      if (onSelectToggle) onSelectToggle(message);
      return;
    }
    if (onPress) onPress(message);
  };

  // System messages (user joined, etc.) — not selectable, no checkbox
  if (message.type === 'system') {
    return (
      <View style={styles.systemRow}>
        <Text style={styles.systemText}>{message.content}</Text>
      </View>
    );
  }

  // Render the selection checkbox to the left of every row when in select
  // mode. Wraps the entire row in a Pressable so taps anywhere in the row
  // (including outside the bubble) toggle selection.
  const checkbox = selectMode ? (
    <View style={styles.selectionCheckbox}>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={selected ? colors.primary : colors.textMuted}
      />
    </View>
  ) : null;

  // Deleted messages
  if (message.deleted) {
    return (
      <TouchableOpacity
        activeOpacity={selectMode ? 0.6 : 1}
        onPress={selectMode && onSelectToggle ? () => onSelectToggle(message) : undefined}
        style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther, selected && styles.selectedRow]}
      >
        {checkbox}
        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther, styles.deleted]}>
          <Text style={styles.deletedText}>This message was deleted</Text>
        </View>
      </TouchableOpacity>
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
      onPress={handlePress}
      delayLongPress={300}
      style={[
        styles.row,
        isOwn ? styles.rowOwn : styles.rowOther,
        selected && styles.selectedRow,
        highlighted && styles.highlightedRow,
      ]}
    >
      {checkbox}
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
          <VideoAttachment url={attachment.url} isOwn={isOwn} onPress={onVideoPress} />
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

        {/* Sticker — rendered as a transparent image, no bubble background.
            We still wrap it in the bubble so meta/timestamp fits below. */}
        {message.type === 'sticker' && attachment && (
          <StickerAttachment url={attachment.url} />
        )}

        {/* Location — static "card" with a pin + name + lat/lng */}
        {message.type === 'location' && (
          <LocationAttachment message={message} isOwn={isOwn} />
        )}

        {/* Contact card — shared user reference */}
        {message.type === 'contact' && (
          <ContactCardAttachment message={message} isOwn={isOwn} />
        )}

        {/* Text content — fontSize scales with the user's font-scale pref */}
        {message.content && (message.type === 'text' || !message.type) ? (
          <Text
            style={[
              styles.content,
              isOwn ? styles.contentOwn : styles.contentOther,
              { fontSize: fontSize.md * fontScaleMultiplier },
            ]}
          >
            {message.content}
          </Text>
        ) : null}

        {/* Inline OG link preview — only for text messages with a URL */}
        {(message.type === 'text' || !message.type) && (() => {
          const url = extractUrl(message.content);
          return url ? <LinkPreview url={url} isOwn={isOwn} /> : null;
        })()}

        {/* Translation line — appears as a small italic block below the
            original message text when the parent supplies one. */}
        {translation ? (
          <View style={[styles.translationWrap, isOwn ? styles.translationWrapOwn : styles.translationWrapOther]}>
            <Text style={[styles.translationText, isOwn ? styles.contentOwn : styles.contentOther]}>
              {translation}
            </Text>
          </View>
        ) : null}

        {/* Timestamp + status */}
        <View style={styles.meta}>
          {isPinned && (
            <Ionicons
              name="bookmark"
              size={11}
              color={colors.primary}
              style={{ marginRight: 3 }}
            />
          )}
          {isStarred && (
            <Ionicons
              name="star"
              size={11}
              color="#FFC107"
              style={{ marginRight: 3 }}
            />
          )}
          {message.edited && <Text style={styles.edited}>edited</Text>}
          <Text style={styles.time}>{formatTime(message.createdAt)}</Text>
          {isOwn && (
            <Text style={[styles.status, message.status === 'read' && styles.statusRead]}>
              {statusIcon(message.status)}
            </Text>
          )}
        </View>

        {/* Reaction chips — tap one to toggle that emoji for yourself */}
        {reactionGroups.length > 0 && (
          <View style={styles.reactionsWrap}>
            {reactionGroups.map(([emoji, info]) => (
              <TouchableOpacity
                key={emoji}
                style={[styles.reactionChip, info.mine && styles.reactionChipMine]}
                activeOpacity={0.7}
                onPress={() => onReactionPress?.(emoji)}
              >
                <Text style={styles.reactionChipEmoji}>{emoji}</Text>
                {info.count > 1 && <Text style={styles.reactionChipCount}>{info.count}</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  row: {
    paddingHorizontal: spacing.md,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  rowOwn: {
    justifyContent: 'flex-end',
  },
  rowOther: {
    justifyContent: 'flex-start',
  },
  selectedRow: {
    backgroundColor: colors.primary + '12', // ~7% opacity tint
  },
  highlightedRow: {
    // Brief flash when you jump to a message (pinned banner / search). A bit
    // stronger than the select tint so it reads as "here it is", then the
    // parent clears it after ~1.8s.
    backgroundColor: colors.primary + '33', // ~20% opacity tint
    borderRadius: borderRadius.md,
  },
  selectionCheckbox: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    marginBottom: 4,
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
  translationWrap: {
    marginTop: 6,
    paddingTop: 6,
    paddingHorizontal: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  translationWrapOwn: {
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  translationWrapOther: {
    borderTopColor: colors.border,
  },
  translationText: {
    fontSize: fontSize.sm,
    fontStyle: 'italic',
    opacity: 0.85,
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
  reactionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: spacing.xs,
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reactionChipMine: {
    backgroundColor: colors.primary + '22',
    borderColor: colors.primary,
  },
  reactionChipEmoji: {
    fontSize: 13,
  },
  reactionChipCount: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
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
