// "My QR Code" screen — WeChat-style card showing a QR that other users
// can scan to send a friend request. The payload is a deep link of the
// form `https://kb-chat.com/u/<userId>` so a generic camera app can also
// open it as a regular URL (graceful degradation).
//
// Tap-and-hold on the QR copies the link to clipboard.

import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '../../stores/authStore';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import Avatar from '../../components/common/Avatar';
import { spacing, fontSize, borderRadius } from '../../utils/theme';

const buildQRPayload = (userId: string, username: string) => {
  // Encode as a URL so generic QR scanners get a usable link.
  // Our in-app scanner recognises the kb-chat.com host and short-circuits
  // straight to the in-app add-friend flow.
  return `https://kb-chat.com/u/${userId}?u=${encodeURIComponent(username)}`;
};

const MyQRScreen = () => {
  const { user } = useAuth();
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const qrValue = user ? buildQRPayload(user.id, user.username) : '';

  const handleCopyLink = async () => {
    if (!qrValue) return;
    await Clipboard.setStringAsync(qrValue);
    Toast.show({ type: 'success', text1: t('qr.linkCopied') });
  };

  if (!user) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{t('common.error')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        {/* Header — avatar + name */}
        <View style={styles.header}>
          <Avatar
            name={user.displayName || user.username}
            src={user.avatar}
            size={56}
          />
          <View style={styles.headerText}>
            <Text style={styles.displayName} numberOfLines={1}>
              {user.displayName || user.username}
            </Text>
            <Text style={styles.username} numberOfLines={1}>
              KB Chat ID: {user.username}
            </Text>
          </View>
        </View>

        {/* QR code */}
        <View style={styles.qrWrap}>
          <QRCode
            value={qrValue}
            size={240}
            backgroundColor="#ffffff"
            color="#000000"
          />
        </View>

        <Text style={styles.hint}>{t('qr.scanToAdd')}</Text>
      </View>

      {/* Actions */}
      <TouchableOpacity
        style={styles.actionRow}
        activeOpacity={0.7}
        onPress={handleCopyLink}
      >
        <Text style={styles.actionText}>{t('qr.shareLink')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgDark,
    },
    content: {
      padding: spacing.lg,
      paddingTop: spacing.xl,
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgDark,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: fontSize.md,
    },
    card: {
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      alignItems: 'center',
      gap: spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      gap: spacing.md,
    },
    headerText: {
      flex: 1,
    },
    displayName: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    username: {
      fontSize: fontSize.sm,
      color: colors.textMuted,
      marginTop: 2,
    },
    qrWrap: {
      // The QR library renders SVG with its own background, but we keep a
      // white card around it so it looks crisp in both light + dark themes.
      backgroundColor: '#ffffff',
      padding: spacing.lg,
      borderRadius: borderRadius.md,
    },
    hint: {
      fontSize: fontSize.sm,
      color: colors.textMuted,
      textAlign: 'center',
    },
    actionRow: {
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.lg,
      paddingVertical: 14,
      marginTop: spacing.xl,
      alignItems: 'center',
    },
    actionText: {
      fontSize: fontSize.md,
      color: colors.primary,
      fontWeight: '500',
    },
  });

export default MyQRScreen;
