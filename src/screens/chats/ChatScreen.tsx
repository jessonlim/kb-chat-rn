import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  Alert,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Ionicons } from '@expo/vector-icons';
import * as ExpoClipboard from 'expo-clipboard';
import chatService from '../../services/chatService';
import socketService from '../../services/socketService';
import { useAuth } from '../../stores/authStore';
import { useCall } from '../../context/CallContext';
import { useGroupCall } from '../../context/GroupCallContext';
import MessageBubble from '../../components/chat/MessageBubble';
import MessageInput from '../../components/chat/MessageInput';
import MessageActions, { type MessageAction } from '../../components/chat/MessageActions';
import AttachmentMenu from '../../components/chat/AttachmentMenu';
import VoiceRecorder from '../../components/chat/VoiceRecorder';
import ImageViewer from '../../components/chat/ImageViewer';
import VideoViewer from '../../components/chat/VideoViewer';
import SelectionToolbar from '../../components/chat/SelectionToolbar';
import MessageInfoModal from '../../components/chat/MessageInfoModal';
import StickerPicker from '../../components/chat/StickerPicker';
import LocationPicker from '../../components/chat/LocationPicker';
import ContactPicker from '../../components/chat/ContactPicker';
import GifPicker from '../../components/chat/GifPicker';
import Toast from 'react-native-toast-message';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize } from '../../utils/theme';
import type { Chat, Message, User, Attachment, SendMessageAck } from '../../types';

interface Props {
  route: { params: { chatId: string } };
  navigation: any;
}

const ChatScreen = ({ route, navigation }: Props) => {
  const { chatId } = route.params;
  // openSearch can be passed via route params when navigating from ChatInfo
  const openSearchOnMount = (route.params as any).openSearch as boolean | undefined;
  const { user } = useAuth();
  const { startCall, callState } = useCall();
  const { startGroupCall, state: groupCallState } = useGroupCall();
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // True height of the stack-navigator header. With edge-to-edge enabled,
  // KeyboardAvoidingView measures from the top of the screen (not from
  // below the header), so we have to pass this as the offset or the
  // input bar lifts by (keyboard - headerHeight) instead of by the full
  // keyboard height.
  const headerHeight = useHeaderHeight();

  const formatLastSeen = useCallback((dateStr: string): string => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return t('chat.lastSeen.justNow');
    if (diffMin < 60) return t('chat.lastSeen.minAgo', { n: diffMin });
    if (diffHr < 24) {
      if (diffHr === 1) return t('chat.lastSeen.hourAgo', { n: diffHr });
      return t('chat.lastSeen.hoursAgo', { n: diffHr });
    }
    if (diffDay === 1) return t('chat.lastSeen.yesterday');
    return t('chat.lastSeen.date', {
      date: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
    });
  }, [t]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const flatListRef = useRef<FlatList>(null);

  // Reversed view of messages for the inverted FlatList. Memoised so the
  // list doesn't re-render every parent render.
  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

  // Message actions state
  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editMessage, setEditMessage] = useState<Message | null>(null);

  // Multi-select state. selectMode = false means single-tap on a bubble is
  // a no-op; selectMode = true means single-tap toggles selection.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Message info modal target (null = closed)
  const [infoMessage, setInfoMessage] = useState<Message | null>(null);

  // Translation in-bubble state: messageId → translated text
  const [translations, setTranslations] = useState<Record<string, string>>({});

  // Ref to the latest isOwnMessage function so selection-mode useMemos can
  // access it without re-running on every user.id change.
  const isOwnMessageRef = useRef<(msg: Message) => boolean>(() => false);

  // Phase 4: media state
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [viewerVideo, setViewerVideo] = useState<string | null>(null);
  const [showStickers, setShowStickers] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);

  // In-chat search state
  const [searchVisible, setSearchVisible] = useState(!!openSearchOnMount);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search — fire 350ms after the user stops typing
  useEffect(() => {
    if (!searchVisible) {
      setSearchResults([]);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const { messages: results } = await chatService.searchChatMessages(chatId, q);
        setSearchResults(results);
      } catch (err) {
        console.warn('Search failed:', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, searchVisible, chatId]);

  // Load chat info + initial messages.
  //
  // Backend returns messages in OLDEST-first order (it sorts newest-first
  // then reverses). We store state in that same chronological order so
  // appending real-time receives (`[...prev, newMsg]`) keeps newest at
  // the end. The render uses `reversedMessages = [...messages].reverse()`
  // to feed the inverted FlatList so newest lands at the visual bottom.
  //
  // The previous .reverse() on the API response was a leftover from an
  // earlier API contract and was producing an off-screen ordering bug —
  // chats appeared empty even when messages existed in the DB.
  useEffect(() => {
    const init = async () => {
      try {
        const [chatRes, msgRes] = await Promise.all([
          chatService.getChatById(chatId),
          chatService.getMessages(chatId),
        ]);
        setChat(chatRes.chat);
        setMessages(msgRes.messages);
        if (msgRes.messages.length < 50) setHasMore(false);
        // Diagnostic — strip after confirming fix lands
        if (msgRes.messages.length === 0) {
          Toast.show({ type: 'info', text1: 'Loaded 0 messages', text2: 'Empty chat', visibilityTime: 2000 });
        }
      } catch (err: any) {
        console.warn('Failed to load chat:', err);
        Toast.show({ type: 'error', text1: 'Load chat failed', text2: err?.message || 'unknown', visibilityTime: 3000 });
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [chatId]);

  // Set header with online status / member count
  useEffect(() => {
    if (!chat) return;

    if (chat.type === 'group') {
      const memberCount = chat.participants.length;
      const onlineCount = chat.participants.filter((p) => p.isOnline).length;
      const groupTitle = chat.groupName || t('group.info');
      const canStartCall = groupCallState === 'idle';
      navigation.setOptions({
        headerTitle: () => (
          <View style={styles.headerTitle}>
            <Text style={styles.headerName} numberOfLines={1}>
              {groupTitle}
            </Text>
            <Text style={styles.headerSub}>
              {t('group.membersCount', { n: memberCount })}
              {onlineCount > 0 ? ` · ${onlineCount} ${t('chat.online')}` : ''}
            </Text>
          </View>
        ),
        headerRight: () => (
          <View style={styles.headerCallButtons}>
            <TouchableOpacity
              onPress={() => canStartCall && startGroupCall(chatId, 'voice', groupTitle)}
              activeOpacity={0.7}
              style={styles.headerCallBtn}
              disabled={!canStartCall}
            >
              <Ionicons name="call-outline" size={22} color={canStartCall ? colors.primary : colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => canStartCall && startGroupCall(chatId, 'video', groupTitle)}
              activeOpacity={0.7}
              style={styles.headerCallBtn}
              disabled={!canStartCall}
            >
              <Ionicons name="videocam-outline" size={22} color={canStartCall ? colors.primary : colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSearchVisible((v) => !v)}
              activeOpacity={0.7}
              style={styles.headerCallBtn}
            >
              <Ionicons name="search" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('ChatInfo', { chatId })}
              activeOpacity={0.7}
              style={styles.headerCallBtn}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
        ),
      });
    } else {
      const other = chat.participants.find((p: User) => p.id !== user?.id);
      if (other) {
        const remoteTarget = {
          id: other.id,
          displayName: other.displayName || other.username,
          username: other.username,
          avatar: other.avatar,
        };
        navigation.setOptions({
          headerTitle: () => (
            <View style={styles.headerTitle}>
              <Text style={styles.headerName} numberOfLines={1}>
                {other.displayName || other.username}
              </Text>
              <Text style={styles.headerSub}>
                {other.isOnline ? t('chat.online') : formatLastSeen(other.lastSeen)}
              </Text>
            </View>
          ),
          headerRight: () => (
            <View style={styles.headerCallButtons}>
              <TouchableOpacity
                onPress={() => callState === 'idle' && startCall(remoteTarget, chatId, 'voice')}
                activeOpacity={0.7}
                style={styles.headerCallBtn}
                disabled={callState !== 'idle'}
              >
                <Ionicons name="call-outline" size={22} color={callState === 'idle' ? colors.primary : colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => callState === 'idle' && startCall(remoteTarget, chatId, 'video')}
                activeOpacity={0.7}
                style={styles.headerCallBtn}
                disabled={callState !== 'idle'}
              >
                <Ionicons name="videocam-outline" size={22} color={callState === 'idle' ? colors.primary : colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('ChatInfo', { chatId })}
                activeOpacity={0.7}
                style={styles.headerCallBtn}
              >
                <Ionicons name="ellipsis-horizontal" size={22} color={colors.primary} />
              </TouchableOpacity>
            </View>
          ),
        });
      }
    }
  }, [chat, navigation, user?.id, callState, startCall, chatId, groupCallState, startGroupCall, t]);

  // Update other user's online status from socket
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket || !chat) return;

    const onOnline = (data: { userId: string }) => {
      setChat((prev) =>
        prev
          ? {
              ...prev,
              participants: prev.participants.map((p) =>
                p.id === data.userId ? { ...p, isOnline: true } : p
              ),
            }
          : prev
      );
    };

    const onOffline = (data: { userId: string; lastSeen?: string }) => {
      setChat((prev) =>
        prev
          ? {
              ...prev,
              participants: prev.participants.map((p) =>
                p.id === data.userId
                  ? { ...p, isOnline: false, lastSeen: data.lastSeen || p.lastSeen }
                  : p
              ),
            }
          : prev
      );
    };

    socket.on('user_online', onOnline);
    socket.on('user_offline', onOffline);

    return () => {
      socket.off('user_online', onOnline);
      socket.off('user_offline', onOffline);
    };
  }, [chat]);

  // Join socket room + mark chat as read.
  //
  // We do TWO things to clear the unread count, because each path covers a
  // different failure case:
  //   1. REST call (chatService.markChatRead) — guaranteed to reach the
  //      backend and persist to the DB, even if the socket isn't connected
  //      yet. This is the reliable path that makes the badge stay cleared
  //      after a reload.
  //   2. Socket emit ('mark_chat_read') — broadcasts to OTHER clients in
  //      the chat room so their checkmarks (sent/delivered/read) update
  //      instantly. The REST handler doesn't broadcast.
  useEffect(() => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('join_chat', chatId);
      socket.emit('mark_chat_read', { chatId });
    }
    // Always hit the REST endpoint as a reliable backup. Fire-and-forget.
    chatService.markChatRead(chatId).catch((err) => {
      console.warn('[chat] markChatRead REST failed:', err?.response?.data || err?.message);
    });
    return () => {
      socket?.emit('leave_chat', chatId);
    };
  }, [chatId]);

  // Socket listeners for real-time messages
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const onReceiveMessage = (data: { message: Message }) => {
      if (data.message.chat !== chatId) return;

      // The server broadcasts `receive_message` to the entire chat room,
      // INCLUDING the sender. Without dedup, the sender ends up with two
      // copies of every message they send: one from the optimistic
      // ack-callback replacement, and one from this broadcast.
      //
      // We handle three cases:
      // 1. The message is already in state (by real _id) — we already
      //    processed it via the ack. Skip.
      // 2. We have a temp/optimistic message from ourselves pending —
      //    replace it in place with this real one.
      // 3. Genuine incoming from someone else — append.
      const senderId =
        typeof data.message.sender === 'object'
          ? data.message.sender.id
          : data.message.sender;

      setMessages((prev) => {
        if (prev.some((m) => m._id === data.message._id)) {
          return prev; // already have it
        }
        if (senderId === user?.id) {
          const tempIdx = prev.findIndex((m) => m._id.startsWith('temp-'));
          if (tempIdx >= 0) {
            const next = [...prev];
            next[tempIdx] = data.message;
            return next;
          }
        }
        return [...prev, data.message];
      });

      // Mark as read since we're in the chat
      socket.emit('mark_chat_read', { chatId });

      // Send delivery receipt for messages from others
      if (senderId !== user?.id) {
        socket.emit('message_delivered', {
          messageId: data.message._id,
          chatId,
        });
      }
    };

    const onMessageDeleted = (data: { messageId: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === data.messageId ? { ...m, deleted: true, content: '' } : m
        )
      );
    };

    const onMessageEdited = (data: { messageId: string; content: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === data.messageId
            ? { ...m, content: data.content, edited: true }
            : m
        )
      );
    };

    const onMessagesRead = (data: {
      chatId: string;
      readerId: string;
      messageIds: string[];
    }) => {
      if (data.chatId !== chatId) return;
      setMessages((prev) =>
        prev.map((m) =>
          data.messageIds.includes(m._id) ? { ...m, status: 'read' } : m
        )
      );
    };

    const onStatusUpdated = (data: {
      chatId: string;
      messageIds: string[];
      status: Message['status'];
    }) => {
      if (data.chatId !== chatId) return;
      setMessages((prev) =>
        prev.map((m) =>
          data.messageIds.includes(m._id) ? { ...m, status: data.status } : m
        )
      );
    };

    const onReaction = (data: {
      messageId: string;
      reactions: Message['reactions'];
    }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === data.messageId ? { ...m, reactions: data.reactions } : m
        )
      );
    };

    const onTypingStart = (data: { userId: string; chatId: string }) => {
      if (data.chatId !== chatId || data.userId === user?.id) return;
      setTypingUsers((prev) =>
        prev.includes(data.userId) ? prev : [...prev, data.userId]
      );
    };

    const onTypingStop = (data: { userId: string; chatId: string }) => {
      if (data.chatId !== chatId) return;
      setTypingUsers((prev) => prev.filter((id) => id !== data.userId));
    };

    socket.on('receive_message', onReceiveMessage);
    socket.on('message_deleted', onMessageDeleted);
    socket.on('message_edited', onMessageEdited);
    socket.on('messages_read', onMessagesRead);
    socket.on('message_status_updated', onStatusUpdated);
    socket.on('message_reaction', onReaction);
    socket.on('typing_start', onTypingStart);
    socket.on('typing_stop', onTypingStop);

    return () => {
      socket.off('receive_message', onReceiveMessage);
      socket.off('message_deleted', onMessageDeleted);
      socket.off('message_edited', onMessageEdited);
      socket.off('messages_read', onMessagesRead);
      socket.off('message_status_updated', onStatusUpdated);
      socket.off('message_reaction', onReaction);
      socket.off('typing_start', onTypingStart);
      socket.off('typing_stop', onTypingStop);
    };
  }, [chatId, user?.id]);

  // Send text message via socket
  const handleSend = useCallback(
    (text: string) => {
      const socket = socketService.getSocket();
      if (!socket) return;

      // Optimistic: add message immediately
      const tempId = `temp-${Date.now()}`;
      const optimistic: Message = {
        _id: tempId,
        chat: chatId,
        sender: user as User,
        content: text,
        type: 'text',
        attachments: [],
        readBy: [],
        status: 'sending',
        edited: false,
        deleted: false,
        replyTo: replyTo || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);

      // Clear reply state
      if (replyTo) setReplyTo(null);

      // Failsafe timeout — if the server doesn't ack within 15s, flip the
      // optimistic message from 'sending' to 'failed' so the user sees
      // a clear failure state instead of an indefinite "..." spinner.
      // Cleared inside the ack callback below if we hear back in time.
      let timeoutFired = false;
      const ackTimeout = setTimeout(() => {
        timeoutFired = true;
        setMessages((prev) =>
          prev.map((m) =>
            m._id === tempId && m.status === 'sending'
              ? { ...m, status: 'failed' as const }
              : m
          )
        );
      }, 15_000);

      socket.emit(
        'send_message',
        {
          chatId,
          content: text,
          type: 'text',
          ...(replyTo ? { replyTo: replyTo._id } : {}),
        },
        (ack: SendMessageAck) => {
          clearTimeout(ackTimeout);
          if (timeoutFired) return; // already gave up
          if (ack.ok && ack.message) {
            // Replace optimistic with real message
            setMessages((prev) =>
              prev.map((m) => (m._id === tempId ? ack.message! : m))
            );
          } else {
            // Mark as failed
            setMessages((prev) =>
              prev.map((m) =>
                m._id === tempId ? { ...m, status: 'failed' as const } : m
              )
            );
          }
        }
      );
    },
    [chatId, user, replyTo]
  );

  // ── Phase 4: Send attachment (image/video/audio/file) via socket ──
  const handleSendAttachment = useCallback(
    (type: 'image' | 'video' | 'audio' | 'file', attachments: Attachment[]) => {
      const socket = socketService.getSocket();
      if (!socket) return;

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimistic: Message = {
        _id: tempId,
        chat: chatId,
        sender: user as User,
        content: '',
        type,
        attachments,
        readBy: [],
        status: 'sending',
        edited: false,
        deleted: false,
        replyTo: replyTo || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);

      if (replyTo) setReplyTo(null);

      socket.emit(
        'send_message',
        {
          chatId,
          content: '',
          type,
          attachments: attachments.map((a) => ({
            url: a.url,
            type: a.type,
            name: a.name,
            size: a.size,
          })),
          ...(replyTo ? { replyTo: replyTo._id } : {}),
        },
        (ack: SendMessageAck) => {
          if (ack.ok && ack.message) {
            setMessages((prev) =>
              prev.map((m) => (m._id === tempId ? ack.message! : m))
            );
          } else {
            setMessages((prev) =>
              prev.map((m) =>
                m._id === tempId ? { ...m, status: 'failed' as const } : m
              )
            );
          }
        }
      );
    },
    [chatId, user, replyTo]
  );

  // Voice message send handler (from VoiceRecorder)
  const handleVoiceSend = useCallback(
    (attachments: Attachment[]) => {
      setShowVoiceRecorder(false);
      handleSendAttachment('audio', attachments);
    },
    [handleSendAttachment]
  );

  // Generic "send a non-attachment-shaped message" helper. Used by sticker,
  // location, and contact card flows — they all live in `content` rather
  // than `attachments[]` because they're small JSON payloads.
  const handleSendStructured = useCallback(
    (type: 'sticker' | 'location' | 'contact', content: string, attachments: Attachment[] = []) => {
      const socket = socketService.getSocket();
      if (!socket) return;
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimistic: Message = {
        _id: tempId,
        chat: chatId,
        sender: user as User,
        content,
        type,
        attachments,
        readBy: [],
        status: 'sending',
        edited: false,
        deleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      socket.emit(
        'send_message',
        { chatId, content, type, attachments },
        (ack: SendMessageAck) => {
          if (ack.ok && ack.message) {
            setMessages((prev) => prev.map((m) => (m._id === tempId ? ack.message! : m)));
          } else {
            setMessages((prev) =>
              prev.map((m) => (m._id === tempId ? { ...m, status: 'failed' as const } : m))
            );
          }
        }
      );
    },
    [chatId, user]
  );

  const handleSendSticker = useCallback(
    (url: string) => {
      // The sticker URL goes in the first attachment so the bubble can
      // resolve it through useMediaUrl just like an image. NOTE: the
      // attachment.type field is the message BUCKET ('image' / 'sticker'
      // / etc), not the MIME type — backend uses it for the Message
      // model's `type` enum. Putting 'image/png' here would fail enum
      // validation and silently drop the message.
      handleSendStructured('sticker', '', [
        { url, type: 'sticker', name: 'sticker', size: 0 },
      ]);
    },
    [handleSendStructured]
  );

  const handleSendLocation = useCallback(
    (lat: number, lng: number, name?: string) => {
      handleSendStructured('location', JSON.stringify({ lat, lng, name: name || '' }));
    },
    [handleSendStructured]
  );

  const handleSendContact = useCallback(
    (card: { userId: string; username: string; displayName?: string; avatar?: string }) => {
      handleSendStructured('contact', JSON.stringify(card));
    },
    [handleSendStructured]
  );

  const handleSendGif = useCallback(
    (gif: { url: string; width: number; height: number }) => {
      // GIFs go through the regular image pipeline so they animate via the
      // platform Image renderer. We mark them as type='image' so existing
      // image bubble code handles display.
      handleSendAttachment('image', [
        { url: gif.url, type: 'image/gif', name: 'gif', size: 0 },
      ]);
    },
    [handleSendAttachment]
  );

  // Edit message via socket
  const handleSendEdit = useCallback(
    (messageId: string, newContent: string) => {
      const socket = socketService.getSocket();
      if (!socket) return;

      socket.emit('edit_message', { messageId, content: newContent });

      // Optimistic update
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId ? { ...m, content: newContent, edited: true } : m
        )
      );

      setEditMessage(null);
    },
    []
  );

  // Delete message via socket
  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      const socket = socketService.getSocket();
      if (!socket) return;

      Alert.alert(t('msg.deleted'), t('msg.confirmDeleteAll'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            socket.emit('delete_message', { messageId });
            // Optimistic update
            setMessages((prev) =>
              prev.map((m) =>
                m._id === messageId ? { ...m, deleted: true, content: '' } : m
              )
            );
          },
        },
      ]);
    },
    [t]
  );

  // Star/unstar message
  const handleToggleStar = useCallback(
    async (messageId: string) => {
      try {
        await chatService.toggleStar(chatId, messageId);
        setMessages((prev) =>
          prev.map((m) => {
            if (m._id !== messageId) return m;
            const starredBy = m.starredBy || [];
            const isStarred = starredBy.includes(user?.id || '');
            return {
              ...m,
              starredBy: isStarred
                ? starredBy.filter((id) => id !== user?.id)
                : [...starredBy, user?.id || ''],
            };
          })
        );
      } catch {
        console.warn('Failed to toggle star');
      }
    },
    [chatId, user?.id]
  );

  const handleTypingStart = useCallback(() => {
    socketService.emit('typing_start', { chatId });
  }, [chatId]);

  const handleTypingStop = useCallback(() => {
    socketService.emit('typing_stop', { chatId });
  }, [chatId]);

  // Load older messages (chronological pagination — prepend to state).
  // Backend already returns oldest-first, so we prepend directly without
  // reversing. State invariant: messages[] is always oldest → newest.
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0];
      const { messages: older } = await chatService.getMessages(chatId, oldest._id);
      if (older.length < 50) setHasMore(false);
      setMessages((prev) => [...older, ...prev]);
    } catch {
      // Ignore
    } finally {
      setLoadingMore(false);
    }
  }, [chatId, loadingMore, hasMore, messages]);

  // Long-press handler
  const handleLongPress = useCallback((message: Message) => {
    setActionMessage(message);
    setShowActions(true);
  }, []);

  // Image tap handler — open fullscreen viewer
  const handleImagePress = useCallback((uri: string) => {
    setViewerImage(uri);
  }, []);

  // Video tap handler — open fullscreen player
  const handleVideoPress = useCallback((uri: string) => {
    setViewerVideo(uri);
  }, []);

  // Bubble tap handler — currently only used for contact cards (open the
  // referenced user's profile). Other types ignore the tap.
  const handleBubblePress = useCallback(
    (message: Message) => {
      if (message.type !== 'contact') return;
      try {
        const card = JSON.parse(message.content || '{}');
        if (card.userId) {
          navigation.getParent()?.navigate('ContactsTab', {
            screen: 'UserProfile',
            params: { userId: card.userId },
          });
        }
      } catch {
        /* ignore */
      }
    },
    [navigation]
  );

  // Translate a single message's text. Stores the result in `translations`
  // keyed by message id; MessageBubble checks this map and renders the
  // translated text below the original.
  const handleTranslateMessage = useCallback(
    async (msg: Message) => {
      if (translations[msg._id]) {
        // Toggle off — second tap removes the translation
        setTranslations((prev) => {
          const next = { ...prev };
          delete next[msg._id];
          return next;
        });
        return;
      }
      // Optimistic: show a "translating…" placeholder
      setTranslations((prev) => ({ ...prev, [msg._id]: '…' }));
      try {
        // Auto-pick target lang: if message looks Chinese → English, else → Chinese
        const hasChinese = /[一-鿿]/.test(msg.content || '');
        const target = hasChinese ? 'en' : 'zh';
        const { translation } = await chatService.translateMessage(msg._id, target);
        setTranslations((prev) => ({ ...prev, [msg._id]: translation }));
      } catch (err) {
        Toast.show({ type: 'error', text1: t('translate.failed') });
        setTranslations((prev) => {
          const next = { ...prev };
          delete next[msg._id];
          return next;
        });
      }
    },
    [translations, t]
  );

  // Selection helpers ─────────────────────────────────────────────────
  const enterSelectMode = useCallback((seedMessage?: Message) => {
    setSelectMode(true);
    setSelectedIds(seedMessage ? new Set([seedMessage._id]) : new Set());
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelected = useCallback((message: Message) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(message._id)) next.delete(message._id);
      else next.add(message._id);
      return next;
    });
  }, []);

  // Snapshot of currently selected message objects (in chronological order)
  const selectedMessages = useMemo(
    () => messages.filter((m) => selectedIds.has(m._id) && !m.deleted),
    [messages, selectedIds]
  );

  const canDeleteSelection = useMemo(
    () => selectedMessages.length > 0 && selectedMessages.every((m) => isOwnMessageRef.current(m)),
    [selectedMessages]
  );

  // Bulk forward — opens ForwardMessage with the selected messages array
  const handleBulkForward = useCallback(() => {
    if (selectedMessages.length === 0) return;
    navigation.navigate('ForwardMessage', { messages: selectedMessages });
    exitSelectMode();
  }, [selectedMessages, navigation, exitSelectMode]);

  // Bulk delete — loops the existing single-message delete socket emit
  const handleBulkDelete = useCallback(() => {
    if (selectedMessages.length === 0) return;
    Alert.alert(
      t('msg.deleted'),
      t('select.deleteConfirm', { n: selectedMessages.length }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            const socket = socketService.getSocket();
            if (!socket) return;
            for (const m of selectedMessages) {
              socket.emit('delete_message', { messageId: m._id });
            }
            // Optimistic — flip all to deleted locally
            setMessages((prev) =>
              prev.map((m) =>
                selectedIds.has(m._id) ? { ...m, deleted: true, content: '' } : m
              )
            );
            exitSelectMode();
          },
        },
      ]
    );
  }, [selectedMessages, selectedIds, t, exitSelectMode]);

  // Bulk star — loops the existing single-message star toggle
  const handleBulkStar = useCallback(async () => {
    if (selectedMessages.length === 0) return;
    for (const m of selectedMessages) {
      await handleToggleStar(m._id);
    }
    exitSelectMode();
  }, [selectedMessages, handleToggleStar, exitSelectMode]);

  // Bulk copy — concatenates the text content of selected messages
  const handleBulkCopy = useCallback(async () => {
    if (selectedMessages.length === 0) return;
    const text = selectedMessages
      .map((m) => m.content || `[${m.type}]`)
      .join('\n');
    await ExpoClipboard.setStringAsync(text);
    Toast.show({ type: 'success', text1: t('select.copied') });
    exitSelectMode();
  }, [selectedMessages, t, exitSelectMode]);

  // Handle action selection
  const handleAction = useCallback(
    (action: MessageAction) => {
      if (!actionMessage) return;
      setShowActions(false);

      switch (action) {
        case 'reply':
          setEditMessage(null);
          setReplyTo(actionMessage);
          break;

        case 'copy':
          ExpoClipboard.setStringAsync(actionMessage.content);
          Toast.show({ type: 'success', text1: t('select.copied') });
          break;

        case 'edit':
          setReplyTo(null);
          setEditMessage(actionMessage);
          break;

        case 'delete':
          handleDeleteMessage(actionMessage._id);
          break;

        case 'star':
          handleToggleStar(actionMessage._id);
          break;

        case 'forward':
          navigation.navigate('ForwardMessage', { message: actionMessage });
          break;

        case 'select':
          // Enter multi-select with the just-acted-on message seeded
          enterSelectMode(actionMessage);
          break;

        case 'info':
          setInfoMessage(actionMessage);
          break;

        case 'translate':
          handleTranslateMessage(actionMessage);
          break;

        case 'transcribe':
          (async () => {
            Toast.show({ type: 'info', text1: t('voiceToText.transcribing') });
            try {
              const { text } = await chatService.transcribeMessage(actionMessage._id);
              // Stuff the transcription in translations[] so it renders
              // below the audio player using the same machinery.
              setTranslations((prev) => ({ ...prev, [actionMessage._id]: text }));
            } catch (err) {
              Toast.show({ type: 'error', text1: t('voiceToText.failed') });
            }
          })();
          break;

        case 'react':
          // Quick reaction — for now emit a default reaction
          const socket = socketService.getSocket();
          if (socket) {
            socket.emit('react_message', {
              messageId: actionMessage._id,
              emoji: '👍',
            });
          }
          break;
      }

      setActionMessage(null);
    },
    [actionMessage, handleDeleteMessage, handleToggleStar, enterSelectMode, navigation, t]
  );

  const isGroup = chat?.type === 'group';

  const isOwnMessage = useCallback(
    (msg: Message): boolean => {
      return (typeof msg.sender === 'object' ? msg.sender.id : msg.sender) === user?.id;
    },
    [user?.id]
  );

  // Ref-tracked isOwnMessage so callbacks that fire from useMemo dependencies
  // don't need to re-create on every user change.
  isOwnMessageRef.current = isOwnMessage;

  // Tapping a search result scrolls to that message in the chat.
  // Find its index in the reversed list, then scroll. If the message isn't
  // in the currently-loaded slice, we'd need to fetch it (out of scope for v1
  // — for now the result just closes the search and hopes it's visible).
  //
  // NOTE: this hook MUST stay above the `if (loading) return ...` early
  // return below. React requires the same number of hooks on every render;
  // putting a useCallback after a conditional return triggers the
  // "Rendered more hooks than during the previous render" error on the
  // first → second render transition.
  const handleSearchResultTap = useCallback(
    (msg: Message) => {
      setSearchVisible(false);
      setSearchQuery('');
      const idx = reversedMessages.findIndex((m) => m._id === msg._id);
      if (idx >= 0 && flatListRef.current) {
        try {
          flatListRef.current.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
        } catch { /* ignore — message not measured yet */ }
      }
    },
    [reversedMessages],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      // 'padding' on both platforms is the most reliable behaviour: it
      // adds bottom-padding equal to the keyboard height, lifting the
      // input bar out from under the keyboard regardless of edge-to-edge
      // or windowSoftInputMode quirks.
      //
      // The offset must equal the header height so KAV doesn't double-
      // count the area above the screen content. useHeaderHeight from
      // @react-navigation/elements gives us the exact value the stack
      // navigator is using.
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
    >
      {searchVisible && (
        <View style={styles.searchBar}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              autoFocus
              style={styles.searchInput}
              placeholder={t('search.placeholder')}
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {!!searchQuery && (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => {
              setSearchVisible(false);
              setSearchQuery('');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.searchCancel}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {searchVisible && searchQuery.trim().length >= 2 && (
        <View style={styles.searchResults}>
          {searching ? (
            <ActivityIndicator color={colors.primary} style={{ padding: spacing.md }} />
          ) : searchResults.length === 0 ? (
            <Text style={styles.searchEmpty}>{t('search.noResults')}</Text>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(m) => m._id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchResultRow}
                  activeOpacity={0.7}
                  onPress={() => handleSearchResultTap(item)}
                >
                  <Text style={styles.searchResultContent} numberOfLines={2}>
                    {item.content || ''}
                  </Text>
                  <Text style={styles.searchResultTime}>
                    {new Date(item.createdAt || '').toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}

      <FlatList
        ref={flatListRef}
        // inverted means: data[0] sits at the visual bottom, last entry at top.
        // We keep state in chronological order (oldest → newest) and reverse
        // here so newest messages land at the bottom of the screen, where the
        // FlatList naturally starts. No flicker — no scrollToEnd needed.
        data={reversedMessages}
        keyExtractor={(m) => m._id}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            isOwn={isOwnMessage(item)}
            showSenderName={isGroup}
            onLongPress={handleLongPress}
            onImagePress={handleImagePress}
            onVideoPress={handleVideoPress}
            onPress={handleBubblePress}
            selectMode={selectMode}
            selected={selectedIds.has(item._id)}
            onSelectToggle={toggleSelected}
            translation={translations[item._id]}
          />
        )}
        contentContainerStyle={styles.messageList}
        inverted
        // With inverted, "end" = top of screen = OLDER messages → load more there
        onEndReachedThreshold={0.1}
        onEndReached={() => loadMore()}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={{ paddingVertical: spacing.md }}
            />
          ) : null
        }
      />

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <View style={styles.typingBar}>
          <Text style={styles.typingText}>
            {typingUsers.length === 1 ? t('chat.typing') : t('chat.typingMany')}
          </Text>
        </View>
      )}

      {/* In multi-select mode the input bar is replaced by the
          selection toolbar. Voice recorder takes priority otherwise. */}
      {selectMode ? (
        <SelectionToolbar
          count={selectedIds.size}
          canDelete={canDeleteSelection}
          onForward={handleBulkForward}
          onDelete={handleBulkDelete}
          onStar={handleBulkStar}
          onCopy={handleBulkCopy}
          onCancel={exitSelectMode}
        />
      ) : showVoiceRecorder ? (
        <VoiceRecorder
          onSend={handleVoiceSend}
          onCancel={() => setShowVoiceRecorder(false)}
        />
      ) : (
        <MessageInput
          onSend={handleSend}
          onTypingStart={handleTypingStart}
          onTypingStop={handleTypingStop}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          editMessage={editMessage}
          onCancelEdit={() => setEditMessage(null)}
          onSendEdit={handleSendEdit}
          onAttachPress={() => setShowAttachMenu(true)}
          onMicPress={() => setShowVoiceRecorder(true)}
        />
      )}

      {/* Message action sheet */}
      <MessageActions
        visible={showActions}
        message={actionMessage}
        isOwn={actionMessage ? isOwnMessage(actionMessage) : false}
        onAction={handleAction}
        onReact={(emoji) => {
          if (!actionMessage) return;
          const socket = socketService.getSocket();
          if (socket) {
            socket.emit('react_message', {
              messageId: actionMessage._id,
              emoji,
            });
          }
          setActionMessage(null);
        }}
        onClose={() => {
          setShowActions(false);
          setActionMessage(null);
        }}
      />

      {/* Attachment menu bottom sheet */}
      <AttachmentMenu
        visible={showAttachMenu}
        onClose={() => setShowAttachMenu(false)}
        onAttachmentReady={handleSendAttachment}
        onPickLocation={() => setShowLocationPicker(true)}
        onPickContact={() => setShowContactPicker(true)}
        onPickSticker={() => setShowStickers(true)}
        onPickGif={() => setShowGifPicker(true)}
      />

      {/* Sticker / Location / Contact / GIF pickers */}
      <StickerPicker
        visible={showStickers}
        onClose={() => setShowStickers(false)}
        onPick={handleSendSticker}
      />
      <LocationPicker
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onPick={handleSendLocation}
      />
      <ContactPicker
        visible={showContactPicker}
        onClose={() => setShowContactPicker(false)}
        onPick={handleSendContact}
      />
      <GifPicker
        visible={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onPick={handleSendGif}
      />

      {/* Fullscreen image viewer */}
      <ImageViewer
        visible={!!viewerImage}
        uri={viewerImage}
        onClose={() => setViewerImage(null)}
      />

      {/* Fullscreen video player */}
      <VideoViewer
        visible={!!viewerVideo}
        uri={viewerVideo}
        onClose={() => setViewerVideo(null)}
      />

      {/* Message info modal — read receipts + delivery list */}
      <MessageInfoModal
        message={infoMessage}
        chatType={chat?.type || 'private'}
        onClose={() => setInfoMessage(null)}
      />
    </KeyboardAvoidingView>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bgDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: {
    paddingVertical: spacing.md,
  },
  typingBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 4,
    backgroundColor: colors.bgHeader,
  },
  // In-chat search bar (rendered above the message list)
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgHeader,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    paddingVertical: 2,
  },
  searchCancel: {
    fontSize: fontSize.md,
    color: colors.primary,
    paddingHorizontal: spacing.xs,
  },
  searchResults: {
    maxHeight: 280,
    backgroundColor: colors.bgCard,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  searchResultRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  searchResultContent: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  searchResultTime: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  searchEmpty: {
    padding: spacing.lg,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
  typingText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  headerTitle: {
    alignItems: 'center',
  },
  headerName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  headerSub: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 1,
  },
  headerCallButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 8,
  },
  headerCallBtn: {
    padding: 6,
  },
});

export default ChatScreen;
