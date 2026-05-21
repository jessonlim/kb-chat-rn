export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatar: string;
  about: string;
  isOnline: boolean;
  lastSeen: string;
}

export interface Chat {
  _id: string;
  type: 'private' | 'group';
  participants: User[];
  groupName?: string;
  groupImage?: string;
  groupAdmin?: string;
  lastMessage?: Message;
  unreadCount?: number;
  isPinned?: boolean;
  isMuted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  _id: string;
  chat: string;
  sender: User | string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'sticker' | 'location' | 'contact' | 'system';
  attachments: Attachment[];
  replyTo?: Message;
  readBy: ReadReceipt[];
  status: 'sending' | 'failed' | 'sent' | 'delivered' | 'read';
  edited: boolean;
  deleted: boolean;
  reactions?: Reaction[];
  starredBy?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Reaction {
  user: string;
  emoji: string;
  createdAt: string;
}

export interface Attachment {
  url: string;
  type: string;
  name: string;
  size: number;
}

export interface ReadReceipt {
  user: string;
  readAt: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ApiError {
  message: string;
  errors?: { field: string; message: string }[];
}

export interface UsersSearchResponse {
  users: User[];
}

export interface ChatsResponse {
  chats: Chat[];
}

export interface ChatResponse {
  chat: Chat;
}

export interface MessagesResponse {
  messages: Message[];
}

export interface MessageResponse {
  message: Message;
}

export interface SendMessageAck {
  ok: boolean;
  message?: Message;
  error?: string;
}

export type TabKey = 'chats' | 'contacts' | 'discover' | 'me';

export type ContactStatus = 'self' | 'none' | 'pending_sent' | 'pending_received' | 'friends';

export interface FriendRequest {
  _id: string;
  requester: User;
  recipient: string | User;
  status: 'pending' | 'accepted';
  createdAt: string;
  updatedAt: string;
}

export interface ContactsResponse {
  contacts: User[];
}

export interface FriendRequestsResponse {
  requests: FriendRequest[];
}

export interface FriendRequestStatusResponse {
  status: ContactStatus;
  requestId?: string;
}

export interface SendFriendRequestResponse {
  status: 'pending' | 'accepted';
  requestId?: string;
  message?: string;
}
