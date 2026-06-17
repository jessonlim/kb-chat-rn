// Landing screen for a group invite DEEP LINK (https://kb-chat.com/g/<chatId>
// or kbchat://group/<chatId>). React Navigation's linking config routes the URL
// here; we join the group and replace ourselves with the chat. The user already
// chose to open the link, so we join directly (no extra confirm) and just show a
// spinner. Mirrors the QR-scan join in ScanQRScreenInner.

import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import Toast from 'react-native-toast-message';
import chatService from '../../services/chatService';
import { useAuth } from '../../stores/authStore';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  navigation: any;
  route: { params: { chatId: string } };
}

const GroupJoinScreen = ({ navigation, route }: Props) => {
  const { chatId } = route.params || ({} as { chatId: string });
  const { user } = useAuth();
  const { t } = useT();
  const { colors } = useTheme();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      // Defensive: this screen only mounts inside MainTabs (logged in), but if
      // a deep link races auth, bail to the list rather than join with no user.
      if (!chatId || !user) {
        navigation.replace('ChatList');
        return;
      }
      try {
        const res = await chatService.joinGroup(chatId);
        const cid = (res.chat as any)?._id || (res.chat as any)?.id;
        if (!cid) throw new Error('no chat in join response');
        if (res.joined) Toast.show({ type: 'success', text1: t('qr.joinedGroup') });
        navigation.replace('ChatScreen', { chatId: cid });
      } catch (err: any) {
        const status = err?.response?.status;
        Toast.show({
          type: 'error',
          text1: status === 404 ? t('qr.groupNotFound') : t('qr.joinGroupFailed'),
        });
        navigation.replace('ChatList');
      }
    })();
  }, [chatId, user, navigation, t]);

  return (
    <View style={[styles.center, { backgroundColor: colors.bgDark }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default GroupJoinScreen;
