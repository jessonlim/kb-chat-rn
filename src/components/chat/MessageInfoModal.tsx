// Message info modal — shows per-participant delivery + read state for a
// single message. Fetches `/api/chats/messages/:id/info` lazily when
// opened. Falls back to the local readBy array if the API isn't available.

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../common/Avatar';
import chatService from '../../services/chatService';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../i18n/I18nContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';
import type { Message, User } from '../../types';

interface Props {
  message: Message | null;
  chatType: 'private' | 'group';
  onClose: () => void;
}

interface ReceiptEntry {
  user: User;
  at: string;
}

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const MessageInfoModal = ({ message, chatType, onClose }: Props) => {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(false);
  const [readBy, setReadBy] = useState<ReceiptEntry[]>([]);
  const [deliveredTo, setDeliveredTo] = useState<ReceiptEntry[]>([]);

  useEffect(() => {
    if (!message) return;
    let alive = true;
    setLoading(true);
    chatService
      .getMessageInfo(message._id)
      .then((data) => {
        if (!alive) return;
        setReadBy(
          (data.readBy || []).map((r) => ({ user: r.user, at: r.readAt }))
        );
        setDeliveredTo(
          (data.deliveredTo || []).map((d) => ({ user: d.user, at: d.deliveredAt }))
        );
      })
      .catch(() => {
        // Backend not ready — fall back to local readBy data we have
        if (!alive) return;
        // We don't have full User objects here, just IDs. Show what we can.
        setReadBy([]);
        setDeliveredTo([]);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [message]);

  if (!message) return null;

  return (
    <Modal
      visible={!!message}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>{t('msgInfo.title')}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </Pressable>
          </View>

          <Text style={styles.sentRow}>
            {t('msgInfo.sent', { time: formatTime(message.createdAt) })}
          </Text>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.lg }} />
          ) : (
            <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: spacing.xl }}>
              {/* Read by section */}
              <View style={styles.sectionHeader}>
                <Ionicons name="checkmark-done" size={16} color={colors.primary} />
                <Text style={styles.sectionTitle}>{t('msgInfo.readBy')}</Text>
                <Text style={styles.sectionCount}>{readBy.length}</Text>
              </View>
              {readBy.length === 0 ? (
                <Text style={styles.emptyText}>{t('msgInfo.pending')}</Text>
              ) : (
                readBy.map((r) => (
                  <ReceiptRow key={`read-${r.user.id}`} entry={r} />
                ))
              )}

              {/* Delivered section (only relevant in group chats — in 1:1 read
                  implies delivered) */}
              {chatType === 'group' && (
                <>
                  <View style={[styles.sectionHeader, { marginTop: spacing.lg }]}>
                    <Ionicons name="checkmark" size={16} color={colors.textMuted} />
                    <Text style={styles.sectionTitle}>{t('msgInfo.deliveredTo')}</Text>
                    <Text style={styles.sectionCount}>{deliveredTo.length}</Text>
                  </View>
                  {deliveredTo.length === 0 ? (
                    <Text style={styles.emptyText}>{t('msgInfo.pending')}</Text>
                  ) : (
                    deliveredTo.map((d) => (
                      <ReceiptRow key={`del-${d.user.id}`} entry={d} />
                    ))
                  )}
                </>
              )}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const ReceiptRow = ({ entry }: { entry: ReceiptEntry }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.receiptRow}>
      <Avatar
        name={entry.user.displayName || entry.user.username}
        src={entry.user.avatar}
        size={36}
      />
      <View style={styles.receiptInfo}>
        <Text style={styles.receiptName} numberOfLines={1}>
          {entry.user.displayName || entry.user.username}
        </Text>
        <Text style={styles.receiptTime}>{formatTime(entry.at)}</Text>
      </View>
    </View>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.bgCard,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
      maxHeight: '75%',
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    title: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    sentRow: {
      paddingHorizontal: spacing.lg,
      fontSize: fontSize.sm,
      color: colors.textMuted,
      paddingBottom: spacing.md,
    },
    body: {
      paddingHorizontal: spacing.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    sectionTitle: {
      flex: 1,
      fontSize: fontSize.md,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    sectionCount: {
      fontSize: fontSize.sm,
      color: colors.textMuted,
    },
    emptyText: {
      fontSize: fontSize.sm,
      color: colors.textMuted,
      fontStyle: 'italic',
      paddingVertical: spacing.sm,
    },
    receiptRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    receiptInfo: {
      flex: 1,
    },
    receiptName: {
      fontSize: fontSize.md,
      color: colors.textPrimary,
    },
    receiptTime: {
      fontSize: fontSize.xs,
      color: colors.textMuted,
      marginTop: 2,
    },
  });

export default MessageInfoModal;
