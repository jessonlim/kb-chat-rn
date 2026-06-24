// IncomingCallOverlay — shown when someone is calling us.
// Full-screen overlay with caller info + Accept / Decline buttons.

import React, { useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCall } from '../../context/CallContext';
import Avatar from '../common/Avatar';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../i18n/I18nContext';
import { fontSize, spacing } from '../../utils/theme';

const IncomingCallOverlay = () => {
  const { callState, callType, remoteUser, acceptCall, rejectCall } = useCall();
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Pulse animation for the avatar ring
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (callState !== 'ringing') return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [callState, pulseAnim]);

  // Only show when ringing (we are the callee). On iOS, CallKit's native call UI
  // is the incoming-call experience — a banner while you're in the app, a
  // full-screen screen when the phone is locked. Rendering our own overlay on
  // top of it is a duplicate ("full-screen overlay + CallKit drop-down"), so on
  // iOS we never show this; CallKit owns incoming UI and the answer flows back
  // through callkitService → acceptCall. (Android still uses this overlay.)
  if (Platform.OS === 'ios' || callState !== 'ringing') return null;

  const name = remoteUser?.displayName || remoteUser?.username || 'Unknown';
  const isVideo = callType === 'video';

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.content}>
        {/* Call type label */}
        <View style={styles.typeRow}>
          <Ionicons
            name={isVideo ? 'videocam' : 'call'}
            size={20}
            color={colors.primary}
          />
          <Text style={styles.typeText}>
            {t(isVideo ? 'call.incomingVideo' : 'call.incomingVoice')}
          </Text>
        </View>

        {/* Caller avatar + name */}
        <View style={styles.center}>
          <Animated.View
            style={[styles.avatarRing, { transform: [{ scale: pulseAnim }] }]}
          >
            <Avatar name={name} src={remoteUser?.avatar} size={120} />
          </Animated.View>
          <Text style={styles.name}>{name}</Text>
        </View>

        {/* Accept / Decline buttons */}
        <View style={styles.buttons}>
          {/* Decline */}
          <TouchableOpacity
            style={styles.declineBtn}
            onPress={() => rejectCall()}
            activeOpacity={0.7}
          >
            <Ionicons
              name="call"
              size={28}
              color="#fff"
              style={{ transform: [{ rotate: '135deg' }] }}
            />
            <Text style={styles.btnLabel}>{t('call.decline')}</Text>
          </TouchableOpacity>

          {/* Accept */}
          <TouchableOpacity
            style={styles.acceptBtn}
            onPress={acceptCall}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isVideo ? 'videocam' : 'call'}
              size={28}
              color="#fff"
            />
            <Text style={styles.btnLabel}>{t('call.accept')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 10, 0.97)',
    zIndex: 10000,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 60,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  typeText: {
    color: colors.primary,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  center: {
    alignItems: 'center',
    gap: spacing.xl,
  },
  avatarRing: {
    padding: 6,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  name: {
    color: '#fff',
    fontSize: fontSize.xxl,
    fontWeight: '700',
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 60,
  },
  declineBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabel: {
    color: '#fff',
    fontSize: 11,
    marginTop: 8,
    position: 'absolute',
    bottom: -24,
  },
});

export default IncomingCallOverlay;
