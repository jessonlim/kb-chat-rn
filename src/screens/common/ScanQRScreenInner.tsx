// QR scanner — inner implementation (camera-dependent).
//
// This file eager-imports expo-camera (CameraView + the
// useCameraPermissions hook, which can't be lazy-required because hooks
// must run unconditionally). To keep expo-camera OUT of the app launch
// path (audit M4), this component is NOT imported directly by the
// navigator. Instead `ScanQRScreen.tsx` is a thin wrapper that
// lazy-`require()`s this file the first time the QR screen renders — so
// expo-camera only resolves when the user actually opens the scanner.

import React, { useMemo, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../stores/authStore';
import userService from '../../services/userService';
import chatService from '../../services/chatService';
import { spacing, fontSize } from '../../utils/theme';

interface Props {
  navigation: any;
}

// Accept both forms of the friend QR:
//   https://kb-chat.com/u/<userId>?u=<username>   (legacy / shareable URL)
//   kbchat://user/<userId>?u=<username>           (custom-scheme deep link)
const QR_HOST_PATTERN = /(?:https?:\/\/(?:www\.)?kb-chat\.com\/u\/|kbchat:\/\/user\/)([a-fA-F0-9]+)/i;

// Group invite QR:
//   https://kb-chat.com/g/<chatId>   (shareable URL)
//   kbchat://group/<chatId>          (custom-scheme deep link)
const GROUP_QR_PATTERN = /(?:https?:\/\/(?:www\.)?kb-chat\.com\/g\/|kbchat:\/\/group\/)([a-fA-F0-9]+)/i;

const ScanQRScreenInner = ({ navigation }: Props) => {
  const { t } = useT();
  const { colors } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [permission, requestPermission] = useCameraPermissions();
  const [handling, setHandling] = useState(false);
  const handlingRef = useRef(false);

  const handleScanned = useCallback(
    async ({ data }: { data: string }) => {
      // Hard-debounce — barcodes fire continuously while the code is in
      // frame. We only want to process the first one.
      if (handlingRef.current) return;

      const groupMatch = data.match(GROUP_QR_PATTERN);
      const match = data.match(QR_HOST_PATTERN);
      if (!groupMatch && !match) {
        // Not our QR. Show a toast but don't navigate away — let the user
        // try again with a different code.
        handlingRef.current = true;
        Toast.show({ type: 'error', text1: t('qr.invalidQR') });
        // Allow another scan after a short delay
        setTimeout(() => { handlingRef.current = false; }, 1500);
        return;
      }

      handlingRef.current = true;
      setHandling(true);

      // ── Group invite QR → join the group + open it ──
      if (groupMatch) {
        const groupId = groupMatch[1];
        try {
          const res = await chatService.joinGroup(groupId);
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
          setHandling(false);
          setTimeout(() => { handlingRef.current = false; }, 1500);
        }
        return;
      }

      const scannedUserId = match![1];

      if (user && scannedUserId === user.id) {
        Toast.show({ type: 'info', text1: t('qr.cantScanSelf') });
        setHandling(false);
        setTimeout(() => { handlingRef.current = false; }, 1500);
        return;
      }

      try {
        const { user: scannedUser } = await userService.getUserById(scannedUserId);
        // Replace the scanner so back goes to where we came from, not back
        // to the camera.
        // Defensive: backend may return { user: { _id, ... } } without the
        // `id` virtual depending on .select() projection. Fall back to _id.
        const targetId = (scannedUser as any).id || (scannedUser as any)._id;
        if (!targetId) {
          Toast.show({
            type: 'error',
            text1: '⚠️ User has no ID',
            text2: 'response: ' + JSON.stringify(scannedUser).slice(0, 100),
            visibilityTime: 5000,
          });
          setHandling(false);
          setTimeout(() => { handlingRef.current = false; }, 1500);
          return;
        }
        navigation.replace('UserProfile', { userId: targetId });
      } catch (err: any) {
        console.warn('[ScanQR] lookup failed:', err);
        // Surface the actual HTTP status / error
        const status = err?.response?.status;
        const msg = err?.response?.data?.message || err?.message || 'unknown';
        Toast.show({
          type: 'error',
          text1: `❌ Lookup failed (${status || '?'})`,
          text2: `${msg} · id=${scannedUserId.slice(0, 12)}…`,
          visibilityTime: 5000,
        });
        setHandling(false);
        setTimeout(() => { handlingRef.current = false; }, 1500);
      }
    },
    [navigation, t, user]
  );

  // Permission flows ───────────────────────────────────────────────────
  if (!permission) {
    return (
      <View style={styles.permissionWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionWrap}>
        <Ionicons name="camera-outline" size={64} color={colors.textMuted} />
        <Text style={styles.permissionText}>{t('qr.cameraDenied')}</Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
          activeOpacity={0.7}
        >
          <Text style={styles.permissionButtonText}>{t('common.allow') || 'Allow'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handling ? undefined : handleScanned}
      />

      {/* Dim mask with a clear cutout in the middle */}
      <View pointerEvents="none" style={styles.overlay}>
        <View style={styles.dimTop} />
        <View style={styles.middleRow}>
          <View style={styles.dimSide} />
          <View style={styles.reticle}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.dimSide} />
        </View>
        <View style={styles.dimBottom}>
          <Text style={styles.hint}>{t('qr.aimAtCode')}</Text>
        </View>
      </View>

      {handling && (
        <View style={styles.handlingBadge}>
          <ActivityIndicator color="#fff" />
        </View>
      )}
    </View>
  );
};

const RETICLE = 240;

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    permissionWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.lg,
      padding: spacing.xl,
      backgroundColor: colors.bgDark,
    },
    permissionText: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      textAlign: 'center',
    },
    permissionButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: 8,
    },
    permissionButtonText: {
      color: '#fff',
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-start',
    },
    dimTop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    middleRow: {
      flexDirection: 'row',
      height: RETICLE,
    },
    dimSide: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    reticle: {
      width: RETICLE,
      height: RETICLE,
    },
    corner: {
      position: 'absolute',
      width: 28,
      height: 28,
      borderColor: '#ffffff',
    },
    cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
    cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
    cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
    cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
    dimBottom: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      paddingTop: spacing.xl,
    },
    hint: {
      color: '#ffffff',
      fontSize: fontSize.md,
      textAlign: 'center',
      paddingHorizontal: spacing.xl,
    },
    handlingBadge: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: [{ translateX: -20 }, { translateY: -20 }],
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.7)',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

export default ScanQRScreenInner;
