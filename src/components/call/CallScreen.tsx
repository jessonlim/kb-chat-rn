// CallScreen — full-screen overlay for active 1:1 calls.
// Voice: dark background + avatar + controls.
// Video: remote stream fullscreen + local PiP + controls.

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { Ionicons } from '@expo/vector-icons';
import { useCall } from '../../context/CallContext';
import Avatar from '../common/Avatar';
import { colors, fontSize, spacing } from '../../utils/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PIP_W = 120;
const PIP_H = 160;

const formatDuration = (secs: number): string => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const statusLabel = (state: string): string => {
  switch (state) {
    case 'calling':
      return 'Calling...';
    case 'ringing':
      return 'Ringing...';
    case 'connecting':
      return 'Connecting...';
    default:
      return '';
  }
};

const CallScreen = () => {
  const {
    callState,
    callType,
    remoteUser,
    isMuted,
    isSpeaker,
    isCameraOn,
    localStream,
    remoteStream,
    duration,
    endCall,
    toggleMute,
    toggleSpeaker,
    toggleCamera,
  } = useCall();

  // Only show when we're actively in a call (not idle, not ringing as callee)
  if (callState === 'idle' || callState === 'ringing') return null;

  const isVideo = callType === 'video';
  const isConnected = callState === 'in_call';
  const name = remoteUser?.displayName || remoteUser?.username || 'Unknown';

  // ── Video call layout ──────────────────────────────────────────
  if (isVideo) {
    return (
      <View style={styles.container}>
        {/* Remote video — fullscreen */}
        {remoteStream ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.remoteVideo}
            objectFit="cover"
            mirror={false}
          />
        ) : (
          <View style={styles.remoteVideoPlaceholder}>
            <Avatar name={name} src={remoteUser?.avatar} size={120} />
            <Text style={styles.placeholderName}>{name}</Text>
            <Text style={styles.placeholderStatus}>
              {statusLabel(callState)}
            </Text>
          </View>
        )}

        {/* Local video — PiP in top right */}
        {localStream && isCameraOn && (
          <View style={styles.localPip}>
            <RTCView
              streamURL={localStream.toURL()}
              style={styles.localVideo}
              objectFit="cover"
              mirror={true}
              zOrder={1}
            />
          </View>
        )}

        {/* Top bar — name + duration */}
        <SafeAreaView style={styles.topBar}>
          <Text style={styles.topName}>{name}</Text>
          {isConnected && (
            <Text style={styles.topDuration}>{formatDuration(duration)}</Text>
          )}
          {!isConnected && (
            <Text style={styles.topStatus}>{statusLabel(callState)}</Text>
          )}
        </SafeAreaView>

        {/* Controls */}
        <SafeAreaView style={styles.controlBar}>
          <View style={styles.controls}>
            <ControlButton
              icon={isCameraOn ? 'videocam' : 'videocam-off'}
              label={isCameraOn ? 'Camera' : 'Camera Off'}
              onPress={toggleCamera}
              active={!isCameraOn}
            />
            <ControlButton
              icon={isMuted ? 'mic-off' : 'mic'}
              label={isMuted ? 'Unmute' : 'Mute'}
              onPress={toggleMute}
              active={isMuted}
            />
            <ControlButton
              icon={isSpeaker ? 'volume-high' : 'volume-low'}
              label={isSpeaker ? 'Speaker' : 'Earpiece'}
              onPress={toggleSpeaker}
              active={isSpeaker}
            />
            <TouchableOpacity
              style={styles.endButton}
              onPress={endCall}
              activeOpacity={0.7}
            >
              <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Voice call layout ─────────────────────────────────────────
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.voiceContent}>
        {/* Avatar + name + status */}
        <View style={styles.voiceCenter}>
          <Avatar name={name} src={remoteUser?.avatar} size={120} />
          <Text style={styles.voiceName}>{name}</Text>
          {isConnected ? (
            <Text style={styles.voiceDuration}>{formatDuration(duration)}</Text>
          ) : (
            <Text style={styles.voiceStatus}>{statusLabel(callState)}</Text>
          )}
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <ControlButton
            icon={isMuted ? 'mic-off' : 'mic'}
            label={isMuted ? 'Unmute' : 'Mute'}
            onPress={toggleMute}
            active={isMuted}
          />
          <ControlButton
            icon={isSpeaker ? 'volume-high' : 'volume-low'}
            label={isSpeaker ? 'Speaker' : 'Earpiece'}
            onPress={toggleSpeaker}
            active={isSpeaker}
          />
          <TouchableOpacity
            style={styles.endButton}
            onPress={endCall}
            activeOpacity={0.7}
          >
            <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

// ── Reusable control button ──────────────────────────────────────
const ControlButton = ({
  icon,
  label,
  onPress,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active: boolean;
}) => (
  <TouchableOpacity
    style={[styles.controlBtn, active && styles.controlBtnActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Ionicons name={icon} size={24} color={active ? '#000' : '#fff'} />
    <Text style={[styles.controlLabel, active && styles.controlLabelActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0a',
    zIndex: 9999,
  },

  // ── Video layout ──
  remoteVideo: {
    flex: 1,
    backgroundColor: '#000',
  },
  remoteVideoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a',
  },
  placeholderName: {
    color: '#fff',
    fontSize: fontSize.xl,
    fontWeight: '600',
    marginTop: spacing.lg,
  },
  placeholderStatus: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginTop: spacing.sm,
  },
  localPip: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: PIP_W,
    height: PIP_H,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  localVideo: {
    width: '100%',
    height: '100%',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  topName: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  topDuration: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: fontSize.sm,
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  topStatus: {
    color: colors.primary,
    fontSize: fontSize.sm,
    marginTop: 4,
  },
  controlBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: spacing.xxl,
  },

  // ── Voice layout ──
  voiceContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  voiceCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceName: {
    color: '#fff',
    fontSize: fontSize.xxl,
    fontWeight: '600',
    marginTop: spacing.xl,
  },
  voiceDuration: {
    color: colors.primary,
    fontSize: fontSize.lg,
    marginTop: spacing.sm,
    fontVariant: ['tabular-nums'],
  },
  voiceStatus: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    marginTop: spacing.sm,
  },

  // ── Controls ──
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 32,
  },
  controlBtn: {
    width: 64,
    height: 72,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  controlBtnActive: {
    backgroundColor: '#fff',
  },
  controlLabel: {
    color: '#fff',
    fontSize: 10,
  },
  controlLabelActive: {
    color: '#000',
  },
  endButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CallScreen;
