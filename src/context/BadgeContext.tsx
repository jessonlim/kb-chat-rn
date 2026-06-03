// BadgeContext — global unread / pending-request counts for the bottom
// tab bar.
//
// Why this exists: ChatListScreen tracks per-chat unread and
// ContactsScreen tracks pending friend requests, but both are LOCAL to
// their screens — so the tab bar can't show "you have unread messages"
// or "someone added you" until you navigate into that tab. This context
// lifts those two totals to the app level so the bottom tabs can badge
// them (matches WhatsApp/WeChat).
//
// Strategy: keep it simple + always-correct by re-fetching the small
// counts (debounced) whenever a relevant socket event fires, plus on
// mount and whenever the app returns to the foreground. The numbers are
// tiny (a sum + a length) so a refetch is cheap, and refetching avoids
// the drift you get from purely incremental counters.

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import socketService from '../services/socketService';
import chatService from '../services/chatService';
import contactService from '../services/contactService';
import { useAuth } from '../stores/authStore';

interface BadgeState {
  /** Total unread messages across all chats (from other people). */
  totalUnread: number;
  /** Pending incoming friend requests. */
  pendingRequests: number;
  /** Force a refresh (e.g. after the user accepts a request). */
  refresh: () => void;
}

const BadgeContext = createContext<BadgeState>({
  totalUnread: 0,
  pendingRequests: 0,
  refresh: () => {},
});

export const useBadges = () => useContext(BadgeContext);

export const BadgeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [totalUnread, setTotalUnread] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const { chats } = await chatService.getMyChats();
      const total = chats.reduce(
        (sum: number, c: any) => sum + (c.unreadCount || 0),
        0
      );
      setTotalUnread(total);
    } catch {
      /* leave the last known count on a transient failure */
    }
  }, []);

  const refreshPending = useCallback(async () => {
    try {
      const { requests } = await contactService.getPendingRequests();
      setPendingRequests(requests.length);
    } catch {
      /* leave the last known count */
    }
  }, []);

  // Debouncers so a burst of socket events triggers only one refetch each.
  const unreadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedUnread = useCallback(() => {
    if (unreadTimer.current) clearTimeout(unreadTimer.current);
    unreadTimer.current = setTimeout(refreshUnread, 500);
  }, [refreshUnread]);
  const debouncedPending = useCallback(() => {
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(refreshPending, 500);
  }, [refreshPending]);

  // Initial load + reset when the signed-in user changes.
  useEffect(() => {
    if (!user) {
      setTotalUnread(0);
      setPendingRequests(0);
      return;
    }
    refreshUnread();
    refreshPending();
  }, [user, refreshUnread, refreshPending]);

  // Real-time updates via the same socket events the screens already use.
  // The socket is created synchronously by authStore before this provider's
  // effects run, so getSocket() is non-null here for a logged-in user.
  useEffect(() => {
    if (!user) return;
    const socket = socketService.getSocket();
    if (!socket) return;

    const onChatUpdated = () => debouncedUnread();
    const onMessagesRead = () => debouncedUnread();
    const onFriendRequest = () => debouncedPending();
    const onFriendAccepted = () => debouncedPending();

    socket.on('chat_updated', onChatUpdated);
    socket.on('messages_read', onMessagesRead);
    socket.on('friend_request_received', onFriendRequest);
    socket.on('friend_request_accepted', onFriendAccepted);

    return () => {
      socket.off('chat_updated', onChatUpdated);
      socket.off('messages_read', onMessagesRead);
      socket.off('friend_request_received', onFriendRequest);
      socket.off('friend_request_accepted', onFriendAccepted);
    };
  }, [user, debouncedUnread, debouncedPending]);

  // Re-sync when the app returns to the foreground (catches anything that
  // happened while backgrounded — especially important on iOS where push
  // isn't wired yet, so the foreground refetch is the only catch-up path).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && user) {
        refreshUnread();
        refreshPending();
      }
    });
    return () => sub.remove();
  }, [user, refreshUnread, refreshPending]);

  const refresh = useCallback(() => {
    refreshUnread();
    refreshPending();
  }, [refreshUnread, refreshPending]);

  return (
    <BadgeContext.Provider value={{ totalUnread, pendingRequests, refresh }}>
      {children}
    </BadgeContext.Provider>
  );
};
