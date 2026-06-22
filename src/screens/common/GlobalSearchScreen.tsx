// Global search across the whole app: contacts, chats, channels, moments.
//
// Strategy: we don't have a unified backend search endpoint (yet), so this
// screen loads each data set once on mount then filters locally as the
// user types. That keeps results instant after the first load and avoids
// hammering the API on every keystroke.
//
// Sections render the top 5 hits each. Tapping a result navigates to the
// relevant detail screen.

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import contactService from '../../services/contactService';
import chatService from '../../services/chatService';
import channelService from '../../services/channelService';
import momentService from '../../services/momentService';
import Avatar from '../../components/common/Avatar';
import { useAuth } from '../../stores/authStore';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';
import { displayNameOf } from '../../stores/remarksStore';
import type { User, Chat, Channel, Moment, Message } from '../../types';

interface Props {
  navigation: any;
}

const MAX_PER_SECTION = 5;

const GlobalSearchScreen = ({ navigation }: Props) => {
  const { user } = useAuth();
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<User[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);
  // Messages can't be preloaded (too many) — searched on the backend, debounced.
  const [messageResults, setMessageResults] = useState<Message[]>([]);
  const [searchingMsgs, setSearchingMsgs] = useState(false);
  const msgDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load all data sources in parallel on mount.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [c, ch, chan, mo] = await Promise.allSettled([
        contactService.getContacts(),
        chatService.getMyChats(),
        channelService.listAll(),
        momentService.list ? momentService.list() : Promise.resolve({ moments: [] }),
      ]);
      if (!alive) return;
      if (c.status === 'fulfilled') setContacts(c.value.contacts);
      if (ch.status === 'fulfilled') setChats(ch.value.chats);
      if (chan.status === 'fulfilled') setChannels(chan.value.channels);
      if (mo.status === 'fulfilled') setMoments((mo.value as any).moments || []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Message content search hits the backend (debounced). CJK-aware min length so
  // a single Chinese character still searches.
  useEffect(() => {
    if (msgDebounceRef.current) clearTimeout(msgDebounceRef.current);
    const q = query.trim();
    const minLen = /[㐀-鿿぀-ヿ가-힯]/.test(q) ? 1 : 2;
    if (q.length < minLen) {
      setMessageResults([]);
      setSearchingMsgs(false);
      return;
    }
    setSearchingMsgs(true);
    msgDebounceRef.current = setTimeout(async () => {
      try {
        const { messages } = await chatService.searchMessagesGlobal(q);
        setMessageResults(messages);
      } catch {
        setMessageResults([]);
      } finally {
        setSearchingMsgs(false);
      }
    }, 350);
    return () => {
      if (msgDebounceRef.current) clearTimeout(msgDebounceRef.current);
    };
  }, [query]);

  const trimmed = query.trim().toLowerCase();

  // Per-section filtered lists, capped at MAX_PER_SECTION.
  const contactResults = useMemo(() => {
    if (!trimmed) return [];
    return contacts
      .filter((u) => {
        const name = displayNameOf(u).toLowerCase();
        const username = (u.username || '').toLowerCase();
        return name.includes(trimmed) || username.includes(trimmed);
      })
      .slice(0, MAX_PER_SECTION);
  }, [contacts, trimmed]);

  const chatResults = useMemo(() => {
    if (!trimmed) return [];
    return chats
      .filter((c) => {
        if (c.type === 'group') {
          return (c.groupName || '').toLowerCase().includes(trimmed);
        }
        const other = c.participants.find((p) => p.id !== user?.id);
        if (!other) return false;
        const name = displayNameOf(other).toLowerCase();
        return name.includes(trimmed) || (other.username || '').toLowerCase().includes(trimmed);
      })
      .slice(0, MAX_PER_SECTION);
  }, [chats, trimmed, user?.id]);

  const channelResults = useMemo(() => {
    if (!trimmed) return [];
    return channels
      .filter((c) => {
        const name = (c.name || '').toLowerCase();
        const desc = (c.description || '').toLowerCase();
        return name.includes(trimmed) || desc.includes(trimmed);
      })
      .slice(0, MAX_PER_SECTION);
  }, [channels, trimmed]);

  const momentResults = useMemo(() => {
    if (!trimmed) return [];
    return moments
      .filter((m) => (m.content || '').toLowerCase().includes(trimmed))
      .slice(0, MAX_PER_SECTION);
  }, [moments, trimmed]);

  const hasAnyResults =
    contactResults.length +
      chatResults.length +
      channelResults.length +
      momentResults.length +
      messageResults.length >
    0;

  // Navigation handlers — jump cross-tab using getParent() to reach root.
  const openContact = useCallback(
    (u: User) => {
      navigation.getParent()?.navigate('ContactsTab', {
        screen: 'UserProfile',
        params: { userId: u.id },
      });
    },
    [navigation]
  );

  const openChat = useCallback(
    (c: Chat) => {
      navigation.getParent()?.navigate('ChatsTab', {
        screen: 'ChatScreen',
        params: { chatId: c._id },
      });
    },
    [navigation]
  );

  const openChannel = useCallback(
    (c: Channel) => {
      navigation.getParent()?.navigate('DiscoverTab', {
        screen: 'ChannelDetail',
        params: { channelId: c._id },
      });
    },
    [navigation]
  );

  const openMoment = useCallback(() => {
    navigation.getParent()?.navigate('DiscoverTab', { screen: 'Moments' });
  }, [navigation]);

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('globalSearch.placeholder')}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {!!query && (
          <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : !trimmed ? (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={48} color={colors.textMuted} />
          <Text style={styles.hint}>{t('globalSearch.hint')}</Text>
        </View>
      ) : !hasAnyResults && !searchingMsgs ? (
        <View style={styles.center}>
          <Text style={styles.empty}>{t('globalSearch.empty')}</Text>
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xl }}>
          {/* Contacts */}
          {contactResults.length > 0 && (
            <Section title={t('globalSearch.section.contacts')}>
              {contactResults.map((u) => (
                <TouchableOpacity
                  key={u.id}
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => openContact(u)}
                >
                  <Avatar name={displayNameOf(u)} src={u.avatar} size={40} />
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {displayNameOf(u)}
                    </Text>
                    <Text style={styles.rowSubtitle} numberOfLines={1}>
                      @{u.username}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </Section>
          )}

          {/* Chats */}
          {chatResults.length > 0 && (
            <Section title={t('globalSearch.section.chats')}>
              {chatResults.map((c) => {
                const isGroup = c.type === 'group';
                const other = isGroup
                  ? null
                  : c.participants.find((p) => p.id !== user?.id);
                const name = isGroup ? c.groupName : other ? displayNameOf(other) : '';
                const src = isGroup ? c.groupImage : other?.avatar;
                return (
                  <TouchableOpacity
                    key={c._id}
                    style={styles.row}
                    activeOpacity={0.7}
                    onPress={() => openChat(c)}
                  >
                    <Avatar name={name || '?'} src={src} size={40} />
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {name}
                      </Text>
                      <Text style={styles.rowSubtitle} numberOfLines={1}>
                        {isGroup
                          ? t('group.membersCount', { n: c.participants.length })
                          : `@${other?.username}`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </Section>
          )}

          {/* Channels */}
          {channelResults.length > 0 && (
            <Section title={t('globalSearch.section.channels')}>
              {channelResults.map((c) => (
                <TouchableOpacity
                  key={c._id}
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => openChannel(c)}
                >
                  <Avatar name={c.name} src={c.avatar} size={40} />
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={styles.rowSubtitle} numberOfLines={1}>
                      {c.description || `@${c.owner.username}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </Section>
          )}

          {/* Moments */}
          {momentResults.length > 0 && (
            <Section title={t('globalSearch.section.moments')}>
              {momentResults.map((m) => (
                <TouchableOpacity
                  key={m._id}
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={openMoment}
                >
                  <Avatar
                    name={m.author.displayName || m.author.username}
                    src={m.author.avatar}
                    size={40}
                  />
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {m.author.displayName || m.author.username}
                    </Text>
                    <Text style={styles.rowSubtitle} numberOfLines={2}>
                      {m.content}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </Section>
          )}

          {/* Messages (full content search, from the backend) */}
          {messageResults.length > 0 && (
            <Section title={t('globalSearch.section.messages')}>
              {messageResults.map((m) => {
                const chat = m.chat as any;
                const isGroup = chat?.type === 'group';
                const other =
                  !isGroup && Array.isArray(chat?.participants)
                    ? chat.participants.find((p: any) => (p._id || p.id) !== user?.id)
                    : null;
                const senderName =
                  typeof m.sender === 'object' ? displayNameOf(m.sender as any) : '';
                const chatName = isGroup
                  ? chat?.groupName || ''
                  : other
                    ? displayNameOf(other)
                    : senderName;
                return (
                  <TouchableOpacity
                    key={m._id}
                    style={styles.row}
                    activeOpacity={0.7}
                    onPress={() => chat?._id && openChat({ _id: chat._id } as Chat)}
                  >
                    <Avatar
                      name={chatName || '?'}
                      src={isGroup ? chat?.groupImage : other?.avatar}
                      size={40}
                    />
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {chatName}
                      </Text>
                      <Text style={styles.rowSubtitle} numberOfLines={2}>
                        {isGroup && senderName ? `${senderName}: ` : ''}
                        {m.content}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </Section>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgDark,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.bgInput,
      borderRadius: borderRadius.md,
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      paddingHorizontal: spacing.md,
      height: 44,
    },
    searchInput: {
      flex: 1,
      fontSize: fontSize.md,
      color: colors.textPrimary,
      height: '100%',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      gap: spacing.md,
    },
    hint: {
      fontSize: fontSize.sm,
      color: colors.textMuted,
      textAlign: 'center',
    },
    empty: {
      fontSize: fontSize.md,
      color: colors.textMuted,
    },
    section: {
      paddingTop: spacing.md,
    },
    sectionTitle: {
      fontSize: fontSize.xs,
      fontWeight: '700',
      color: colors.textMuted,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    rowInfo: {
      flex: 1,
    },
    rowTitle: {
      fontSize: fontSize.md,
      color: colors.textPrimary,
    },
    rowSubtitle: {
      fontSize: fontSize.sm,
      color: colors.textMuted,
      marginTop: 2,
    },
  });

export default GlobalSearchScreen;
