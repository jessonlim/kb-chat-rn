// GroupCallScreen — full-screen overlay for multi-participant calls.
// Rendered above everything when GroupCallContext.state !== 'idle'.
//
// Three views in one component:
//   - state === 'incoming' : ringing screen (Accept / Decline)
//   - state === 'joining'  : connecting placeholder
//   - state === 'in_call'  : participant grid + controls

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Participant } from 'livekit-client';
import { useGroupCall } from '../../context/GroupCallContext';
import { useAuth } from '../../stores/authStore';
import { useT } from '../../i18n/I18nContext';
import Avatar from '../common/Avatar';
import { spacing, fontSize, borderRadius } from '../../utils/theme';
import { getLiveKitClient, getLiveKitRN } from '../../utils/nativeModules';

// LiveKit's Track enum + the VideoTrack component are resolved lazily
// inside ParticipantTile (which only mounts during an active call), so
// this root-rendered overlay doesn't pull LiveKit into the launch path
// (audit M4).

const formatDuration = (s: number): string => {
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const GroupCallScreen = () => {
  const {
    state,
    type,
    groupName,
    starter,
    participants,
    isMuted,
    isCameraOff,
    isSpeakerOn,
    durationSec,
    joinGroupCall,
    declineIncoming,
    leaveGroupCall,
    toggleMute,
    toggleCamera,
    toggleSpeaker,
  } = useGroupCall();
  const { t } = useT();

  // Visible whenever there's an active call in any state except idle
  const visible = state !== 'idle';

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      {state === 'incoming' && (
        <IncomingView
          starter={starter}
          groupName={groupName}
          type={type}
          onAccept={() => { void joinGroupCall(); }}
          onDecline={declineIncoming}
          t={t}
        />
      )}
      {(state === 'joining' || state === 'in_call') && (
        <InCallView
          participants={participants}
          type={type}
          groupName={groupName}
          state={state}
          durationSec={durationSec}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          isSpeakerOn={isSpeakerOn}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          onToggleSpeaker={toggleSpeaker}
          onLeave={() => { void leaveGroupCall(); }}
          t={t}
        />
      )}
    </Modal>
  );
};

// ── Incoming ring screen ────────────────────────────────────────────
const IncomingView = ({
  starter,
  groupName,
  type,
  onAccept,
  onDecline,
  t,
}: {
  starter: any;
  groupName: string;
  type: 'voice' | 'video' | null;
  onAccept: () => void;
  onDecline: () => void;
  t: (key: any) => string;
}) => (
  <View style={styles.fullscreen}>
    <View style={styles.incomingHero}>
      {starter && (
        <Avatar
          name={starter.displayName || starter.username || '?'}
          src={starter.avatar}
          size={96}
        />
      )}
      <Text style={styles.incomingName}>
        {starter?.displayName || starter?.username || t('call.unknownCaller')}
      </Text>
      <Text style={styles.incomingSubtitle}>
        {groupName ? `${groupName} · ` : ''}
        {type === 'video' ? t('groupCall.incomingVideo') : t('groupCall.incomingVoice')}
      </Text>
    </View>
    <View style={styles.incomingActions}>
      <TouchableOpacity style={styles.declineButton} onPress={onDecline} activeOpacity={0.8}>
        <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.acceptButton} onPress={onAccept} activeOpacity={0.8}>
        <Ionicons name="call" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  </View>
);

// ── Active call: grid + controls ───────────────────────────────────
const InCallView = ({
  participants,
  type,
  groupName,
  state,
  durationSec,
  isMuted,
  isCameraOff,
  isSpeakerOn,
  onToggleMute,
  onToggleCamera,
  onToggleSpeaker,
  onLeave,
  t,
}: {
  participants: Participant[];
  type: 'voice' | 'video' | null;
  groupName: string;
  state: 'joining' | 'in_call';
  durationSec: number;
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeakerOn: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleSpeaker: () => void;
  onLeave: () => void;
  t: (key: any, vars?: any) => string;
}) => {
  const isVideo = type === 'video';

  // Choose a column count that gives roughly square tiles for the current
  // participant count. 1 → 1col, 2 → 1col, 3-4 → 2col, 5+ → 2col on phone,
  // 3col on wider screens. Tiles fill the rest with flex.
  const columns = useMemo(() => {
    const n = participants.length;
    if (n <= 1) return 1;
    if (n <= 2) return 1;
    if (n <= 4) return 2;
    return 2;
  }, [participants.length]);

  return (
    <View style={styles.fullscreen}>
      {/* Header */}
      <View style={styles.topBar}>
        <Text style={styles.topTitle} numberOfLines={1}>
          {groupName || t('groupCall.title')}
        </Text>
        <Text style={styles.topSubtitle}>
          {state === 'joining'
            ? t('call.connecting')
            : `${t('groupCall.participants', { n: participants.length })} · ${formatDuration(durationSec)}`}
        </Text>
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {participants.map((p) => (
          <View
            key={p.identity}
            style={[
              styles.tile,
              { width: `${100 / columns}%` },
            ]}
          >
            <ParticipantTile participant={p} isVideoCall={isVideo} t={t} />
          </View>
        ))}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <ControlButton
          icon={isMuted ? 'mic-off' : 'mic'}
          active={isMuted}
          onPress={onToggleMute}
        />
        {isVideo && (
          <ControlButton
            icon={isCameraOff ? 'videocam-off' : 'videocam'}
            active={isCameraOff}
            onPress={onToggleCamera}
          />
        )}
        <ControlButton
          icon={isSpeakerOn ? 'volume-high' : 'ear'}
          active={isSpeakerOn}
          onPress={onToggleSpeaker}
        />
        <TouchableOpacity style={styles.hangup} onPress={onLeave} activeOpacity={0.8}>
          <Ionicons
            name="call"
            size={26}
            color="#fff"
            style={{ transform: [{ rotate: '135deg' }] }}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ── Single participant tile ─────────────────────────────────────────
const ParticipantTile = ({
  participant,
  isVideoCall,
  t,
}: {
  participant: Participant;
  isVideoCall: boolean;
  t: (key: any) => string;
}) => {
  const { user } = useAuth();
  const isLocal = user?.id === participant.identity;

  // Lazy-resolve LiveKit here — ParticipantTile only mounts once a call
  // has participants, so this never runs at app launch (audit M4).
  const { Track } = getLiveKitClient();
  const { VideoTrack } = getLiveKitRN();

  // Signature that changes whenever a video publication is added, becomes
  // SUBSCRIBED (pub.track null -> track), or mutes. Keying the memo on the
  // track *count* alone missed the publish->subscribe transition, so a remote
  // participant's camera never rendered. Recompute on any of those changes.
  const videoSig = Array.from(participant.videoTrackPublications.values())
    .map((p) => `${p.trackSid}:${p.track ? 1 : 0}:${p.isMuted ? 'm' : ''}`)
    .join('|');

  // Find the camera publication for this participant (if any, and not muted)
  const cameraPublication = useMemo(() => {
    if (!isVideoCall) return null;
    for (const pub of participant.videoTrackPublications.values()) {
      if (pub.source === Track.Source.Camera && pub.track && !pub.isMuted) {
        return pub;
      }
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participant, isVideoCall, videoSig]);

  // LiveKit VideoTrack wants a "TrackReference" object
  const trackRef = useMemo(() => {
    if (!cameraPublication) return undefined;
    return {
      participant,
      publication: cameraPublication,
      source: Track.Source.Camera,
    } as any;
  }, [cameraPublication, participant]);

  // Parse displayName + avatar from participant metadata (we set it on connect)
  const meta = useMemo(() => {
    if (!participant.metadata) return { name: null, avatar: null };
    try {
      const o = JSON.parse(participant.metadata);
      return {
        name: o?.displayName || o?.username || null,
        avatar: o?.avatar || null,
      };
    } catch {
      return { name: null, avatar: null };
    }
  }, [participant.metadata]);

  const name =
    meta.name ||
    participant.name ||
    participant.identity?.slice(0, 6) ||
    'User';

  return (
    <View style={styles.tileInner}>
      {trackRef ? (
        <VideoTrack
          trackRef={trackRef}
          style={StyleSheet.absoluteFill as any}
          objectFit="cover"
          mirror={isLocal}
        />
      ) : (
        <View style={styles.tileAvatar}>
          <Avatar name={name} src={meta.avatar || undefined} size={64} />
          <Text style={styles.tileName} numberOfLines={1}>
            {name}
          </Text>
        </View>
      )}
      <View style={styles.tileLabel}>
        <Text style={styles.tileLabelText}>{isLocal ? t('groupCall.you') : name}</Text>
      </View>
    </View>
  );
};

// ── Control button (circle, toggles active state) ──────────────────
const ControlButton = ({
  icon,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    style={[styles.controlButton, active && styles.controlButtonActive]}
  >
    <Ionicons name={icon} size={22} color={active ? '#000000' : '#fff'} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  // Incoming
  incomingHero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  incomingName: {
    color: '#fff',
    fontSize: fontSize.xxl,
    fontWeight: '600',
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  incomingSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  incomingActions: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: spacing.xxl,
    paddingBottom: 50,
    paddingTop: spacing.xl,
  },
  acceptButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // In-call header
  topBar: {
    paddingTop: 50,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  topTitle: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  topSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  // Grid
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 4,
  },
  tile: {
    aspectRatio: 1, // square-ish
    padding: 4,
  },
  tileInner: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  tileAvatar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  tileName: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  tileLabel: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tileLabelText: {
    color: '#fff',
    fontSize: 11,
  },
  // Controls
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: 40,
    paddingTop: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  controlButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: '#fff',
  },
  hangup: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
});

export default GroupCallScreen;
