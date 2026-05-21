// IncomingCallOverlay — shown when someone is calling us.
// Full-screen overlay with caller info + Accept / Decline buttons.

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCall } from '../../context/CallContext';
import Avatar from '../common/Avatar';
import { colors, fontSize, spacing } from '../../utils/theme';

const IncomingCallOverlay = () => {
  const { callState, callType, remoteUser, acceptCall, rejectCall } = useCall();

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

  // Only show when ringing (we are the callee)
  if (callState !== 'ringing') return null;

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
            Incoming {isVideo ? 'Video' : 'Voice'} Call
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
            <Text style={styles.btnLabel}>Decline</Text>
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
            <Text style={styles.btnLabel}>Accept</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
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
