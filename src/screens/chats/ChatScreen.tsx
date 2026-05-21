import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
} from 'react-native';
import chatService from '../../services/chatService';
import socketService from '../../services/socketService';
import { useAuth } from '../../stores/authStore';
import MessageBubble from '../../components/chat/MessageBubble';
import MessageInput from '../../components/chat/MessageInput';
import Avatar from '../../components/common/Avatar';
import { colors, spacing, fontSize } from '../../utils/theme';
import type { Chat, Message, User, SendMessageAck } from '../../types';

interface Props {
  route: { params: { chatId: string } };
  navigation: any;
}

const ChatScreen = ({ route, navigation }: Props) => {
  const { chatId } = route.params;
  const { user } = useAuth();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const flatListRef = useRef<FlatList>(null);

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

        // Set the header title
        const c = chatRes.chat;
        if (c.type === 'group') {
          navigation.setOptions({ title: c.groupName || 'Group' });
        } else {
          const other = c.participants.find((p: User) => p.id !== user?.id);
          navigation.setOptions({
            title: other?.displayName || other?.username || 'Chat',
          });
        }
      } catch (err) {
        console.warn('Failed to load chat:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [chatId, navigation, user?.id]);

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
    socket.on('typing_start', onTypingStart);
    socket.on('typing_stop', onTypingStop);

    return () => {
      socket.off('receive_message', onReceiveMessage);
      socket.off('message_deleted', onMessageDeleted);
      socket.off('message_edited', onMessageEdited);
      socket.off('messages_read', onMessagesRead);
      socket.off('message_status_updated', onStatusUpdated);
      socket.off('typing_start', onTypingStart);
      socket.off('typing_stop', onTypingStop);
    };
  }, [chatId, user?.id]);

  // Send message via socket
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);

      socket.emit(
        'send_message',
        { chatId, content: text, type: 'text' },
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
    [chatId, user]
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

  const isGroup = chat?.type === 'group';

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
            isOwn={
              (typeof item.sender === 'object' ? item.sender.id : item.sender) ===
              user?.id
            }
            showSenderName={isGroup}
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
            {typingUsers.length === 1 ? 'Someone is typing...' : 'Several people are typing...'}
          </Text>
        </View>
      )}

      <MessageInput
        onSend={handleSend}
        onTypingStart={handleTypingStart}
        onTypingStop={handleTypingStop}
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
});

export default ChatScreen;
