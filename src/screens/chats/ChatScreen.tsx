import React, { useEffect, useState, useCallback, useRef } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ExpoClipboard from 'expo-clipboard';
import chatService from '../../services/chatService';
import socketService from '../../services/socketService';
import { useAuth } from '../../stores/authStore';
import { useCall } from '../../context/CallContext';
import MessageBubble from '../../components/chat/MessageBubble';
import MessageInput from '../../components/chat/MessageInput';
import MessageActions, { type MessageAction } from '../../components/chat/MessageActions';
import AttachmentMenu from '../../components/chat/AttachmentMenu';
import VoiceRecorder from '../../components/chat/VoiceRecorder';
import ImageViewer from '../../components/chat/ImageViewer';
import { useT } from '../../i18n/I18nContext';
import { colors, spacing, fontSize } from '../../utils/theme';
import type { Chat, Message, User, Attachment, SendMessageAck } from '../../types';

interface Props {
  route: { params: { chatId: string } };
  navigation: any;
}

const ChatScreen = ({ route, navigation }: Props) => {
  const { chatId } = route.params;
  const { user } = useAuth();
  const { startCall, callState } = useCall();
  const { t } = useT();

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

  // Message actions state
  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editMessage, setEditMessage] = useState<Message | null>(null);

  // Phase 4: media state
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [viewerImage, setViewerImage] = useState<string | null>(null);

  // Load chat info + initial messages
  useEffect(() => {
    const init = async () => {
      try {
        const [chatRes, msgRes] = await Promise.all([
          chatService.getChatById(chatId),
          chatService.getMessages(chatId),
        ]);
        setChat(chatRes.chat);
        setMessages(msgRes.messages.reverse()); // API returns newest first
        if (msgRes.messages.length < 50) setHasMore(false);
      } catch (err) {
        console.warn('Failed to load chat:', err);
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
      navigation.setOptions({
        headerTitle: () => (
          <View style={styles.headerTitle}>
            <Text style={styles.headerName} numberOfLines={1}>
              {chat.groupName || t('group.info')}
            </Text>
            <Text style={styles.headerSub}>
              {t('group.membersCount', { n: memberCount })}
              {onlineCount > 0 ? ` · ${onlineCount} ${t('chat.online')}` : ''}
            </Text>
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
            </View>
          ),
        });
      }
    }
  }, [chat, navigation, user?.id, callState, startCall, chatId]);

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

  // Join socket room
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('join_chat', chatId);

    // Mark as read
    socket.emit('mark_chat_read', { chatId });

    return () => {
      socket.emit('leave_chat', chatId);
    };
  }, [chatId]);

  // Socket listeners for real-time messages
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const onReceiveMessage = (data: { message: Message }) => {
      if (data.message.chat !== chatId) return;
      setMessages((prev) => [...prev, data.message]);

      // Mark as read since we're in the chat
      socket.emit('mark_chat_read', { chatId });

      // Send delivery receipt
      const senderId =
        typeof data.message.sender === 'object'
          ? data.message.sender.id
          : data.message.sender;
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

      socket.emit(
        'send_message',
        {
          chatId,
          content: text,
          type: 'text',
          ...(replyTo ? { replyTo: replyTo._id } : {}),
        },
        (ack: SendMessageAck) => {
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

  // Load older messages
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0];
      const { messages: older } = await chatService.getMessages(chatId, oldest._id);
      if (older.length < 50) setHasMore(false);
      setMessages((prev) => [...older.reverse(), ...prev]);
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
          // Forward — Phase 5+ (would navigate to a chat picker)
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
    [actionMessage, handleDeleteMessage, handleToggleStar]
  );

  const isGroup = chat?.type === 'group';

  const isOwnMessage = (msg: Message): boolean => {
    return (typeof msg.sender === 'object' ? msg.sender.id : msg.sender) === user?.id;
  };

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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m) => m._id}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            isOwn={isOwnMessage(item)}
            showSenderName={isGroup}
            onLongPress={handleLongPress}
            onImagePress={handleImagePress}
          />
        )}
        contentContainerStyle={styles.messageList}
        onEndReachedThreshold={0.1}
        onStartReached={() => loadMore()}
        inverted={false}
        ListHeaderComponent={
          loadingMore ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={{ paddingVertical: spacing.md }}
            />
          ) : null
        }
        // Auto-scroll to bottom on new message
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }}
      />

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <View style={styles.typingBar}>
          <Text style={styles.typingText}>
            {typingUsers.length === 1 ? t('chat.typing') : t('chat.typingMany')}
          </Text>
        </View>
      )}

      {/* Voice recorder replaces the normal input bar */}
      {showVoiceRecorder ? (
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
      />

      {/* Fullscreen image viewer */}
      <ImageViewer
        visible={!!viewerImage}
        uri={viewerImage}
        onClose={() => setViewerImage(null)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
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
