// QR scanner screen — full-screen camera view with QR detection.
//
// When a code is scanned we parse it against the kb-chat.com format. If it
// matches, we look up the user via /api/users/:id and navigate to their
// profile (where they can send a friend request).
//
// The camera ref is stopped as soon as we have a valid code so we don't
// keep firing onBarcodeScanned during the navigation transition.

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
import { spacing, fontSize } from '../../utils/theme';

interface Props {
  navigation: any;
}

// Accept both forms of the friend QR:
//   https://kb-chat.com/u/<userId>?u=<username>   (legacy / shareable URL)
//   kbchat://user/<userId>?u=<username>           (custom-scheme deep link)
const QR_HOST_PATTERN = /(?:https?:\/\/(?:www\.)?kb-chat\.com\/u\/|kbchat:\/\/user\/)([a-fA-F0-9]+)/i;

const ScanQRScreen = ({ navigation }: Props) => {
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

      const match = data.match(QR_HOST_PATTERN);
      if (!match) {
        // Not our QR. Show a toast but don't navigate away — let the user
        // try again with a different code.
        if (handlingRef.current) return;
        handlingRef.current = true;
        Toast.show({ type: 'error', text1: t('qr.invalidQR') });
        // Allow another scan after a short delay
        setTimeout(() => { handlingRef.current = false; }, 1500);
        return;
      }

      handlingRef.current = true;
      setHandling(true);

      const scannedUserId = match[1];

      // DEBUG: surface raw scanned data + extracted ID so we can see
      // exactly what's going wrong when "user not found" fires.
      Toast.show({
        type: 'info',
        text1: '🔍 Scanned',
        text2: `id="${scannedUserId.slice(0, 12)}…" len=${scannedUserId.length}`,
        position: 'top',
        visibilityTime: 4000,
      });

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

export default ScanQRScreen;
