export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatar: string;
  about: string;
  isOnline: boolean;
  lastSeen: string;
  /** Optional — only set if the user added their phone to enable contact discovery */
  phone?: string;
}

export interface Chat {
  _id: string;
  type: 'private' | 'group';
  participants: User[];
  groupName?: string;
  groupImage?: string;
  groupAdmin?: string; // the owner (creator)
  groupAdmins?: string[]; // promoted admins
  inviteToken?: string; // rotating group invite token (for the /g/<token> link)
  pinnedMessage?: string | Message; // legacy single pin (most recent of pinnedMessages)
  pinnedMessages?: (string | Message)[]; // multiple pinned messages (Telegram-style)
  announcement?: string; // group announcement / notice
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

// ── Channels ──

export interface ChannelOwner {
  _id: string;
  displayName: string;
  username: string;
  avatar?: string;
}

export interface Channel {
  _id: string;
  name: string;
  description: string;
  avatar: string;
  owner: ChannelOwner;
  subscriberCount: number;
  isSubscribed: boolean;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
  lastPostAt?: string;
}

export interface ChannelPostAttachment {
  url: string;
  type: 'image' | 'video';
  width?: number;
  height?: number;
}

export interface ChannelPost {
  _id: string;
  channel: string;
  author: ChannelOwner;
  content: string;
  attachments: ChannelPostAttachment[];
  likes: string[];
  commentCount: number;
  createdAt: string;
}

export interface ChannelComment {
  _id: string;
  post: string;
  author: ChannelOwner;
  content: string;
  createdAt: string;
}

// ── Moments ──

export interface MomentAttachment {
  url: string;
  type: 'image' | 'video';
  width?: number;
  height?: number;
}

export interface MomentAuthor {
  _id: string;
  displayName: string;
  username: string;
  avatar?: string;
}

export interface MomentComment {
  _id: string;
  author: MomentAuthor;
  content: string;
  createdAt: string;
}

export interface Moment {
  _id: string;
  author: MomentAuthor;
  content: string;
  attachments: MomentAttachment[];
  likes: string[];
  comments: MomentComment[];
  createdAt: string;
}
