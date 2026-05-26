// Group QR Code — a join code for the current group chat. Anyone who
// scans this with KB Chat will be navigated into the group (the in-app
// scanner's URL pattern is extended to recognise /g/<chatId>).
//
// Format: https://kb-chat.com/g/<chatId> · kbchat://group/<chatId>

import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import QRCode from 'react-native-qrcode-svg';
import Avatar from '../../components/common/Avatar';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';

interface Props {
  route: {
    params: {
      chatId: string;
      groupName?: string;
      groupImage?: string;
      memberCount?: number;
    };
  };
}

const GroupQRScreen = ({ route }: Props) => {
  const { chatId, groupName, groupImage, memberCount } = route.params;
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const qrValue = `https://kb-chat.com/g/${chatId}`;

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(qrValue);
    Toast.show({ type: 'success', text1: t('qr.linkCopied') });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Avatar name={groupName || 'G'} src={groupImage} size={56} />
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>
              {groupName || t('group.info')}
            </Text>
            {!!memberCount && (
              <Text style={styles.subtitle}>
                {t('group.membersCount', { n: memberCount })}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.qrWrap}>
          <QRCode value={qrValue} size={240} backgroundColor="#ffffff" color="#000000" />
        </View>

        <Text style={styles.hint}>
          {t('group.qr.scanToJoin') || 'Scan this code to join the group'}
        </Text>
      </View>

      <TouchableOpacity style={styles.actionRow} activeOpacity={0.7} onPress={handleCopyLink}>
        <Text style={styles.actionText}>{t('qr.shareLink')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgDark },
    content: { padding: spacing.lg, paddingTop: spacing.xl },
    card: {
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.lg,
      padding: spacing.xl,
      alignItems: 'center',
      gap: spacing.lg,
    },
    header: { flexDirection: 'row', alignSelf: 'stretch', alignItems: 'center', gap: spacing.md },
    headerText: { flex: 1 },
    title: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary },
    subtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
    qrWrap: {
      backgroundColor: '#ffffff',
      padding: spacing.lg,
      borderRadius: borderRadius.md,
    },
    hint: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center' },
    actionRow: {
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.lg,
      paddingVertical: 14,
      marginTop: spacing.xl,
      alignItems: 'center',
    },
    actionText: { fontSize: fontSize.md, color: colors.primary, fontWeight: '500' },
  });

export default GroupQRScreen;
