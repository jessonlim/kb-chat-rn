// GroupCallContext — multi-participant voice/video via LiveKit.
// Ported from the web app's GroupCallContext, adapted for React Native:
//   - Uses InCallManager for audio routing (instead of the web app's audioMode)
//   - LiveKit RN SDK uses livekit-client + @livekit/react-native-webrtc
//   - State machine: idle -> incoming -> joining -> in_call -> idle
//
// Backend signaling stays identical to the web version:
//   - emit 'group_call_start' { chatId, type } to ring everyone
//   - emit 'group_call_end' { chatId } to tell others we left
//   - listen for 'group_call_start' to know when someone is calling us
//   - listen for 'group_call_end' to clear an unanswered incoming call

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type {
  Room,
  RemoteParticipant,
  Participant,
} from 'livekit-client';
import Toast from 'react-native-toast-message';
import { useAuth } from '../stores/authStore';
import { useT } from '../i18n/I18nContext';
import socketService from '../services/socketService';
import groupCallService from '../services/groupCallService';
import { storage } from '../services/api';
import { getLiveKitClient, getInCallManager } from '../utils/nativeModules';

// LiveKit + InCallManager loaded lazily (audit M4). Types are erased at
// compile time via `import type`; the runtime classes (Room, RoomEvent,
// Track) and InCallManager only resolve when a group call actually
// starts — not at app launch where this provider is mounted.

export type GroupCallState = 'idle' | 'incoming' | 'joining' | 'in_call';
export type GroupCallType = 'voice' | 'video';

export interface GroupCallStarter {
  _id: string;
  displayName: string;
  username: string;
  avatar: string;
}

interface GroupCallContextType {
  state: GroupCallState;
  type: GroupCallType | null;
  chatId: string | null;
  groupName: string;
  starter: GroupCallStarter | null;
  room: Room | null;
  participants: Participant[];
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeakerOn: boolean;
  durationSec: number;
  startGroupCall: (chatId: string, type: GroupCallType, groupName?: string) => Promise<void>;
  joinGroupCall: () => Promise<void>;
  declineIncoming: () => void;
  leaveGroupCall: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleSpeaker: () => void;
}

const GroupCallContext = createContext<GroupCallContextType | undefined>(undefined);

export const GroupCallProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { t } = useT();
  const [state, setState] = useState<GroupCallState>('idle');
  const [type, setType] = useState<GroupCallType | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [starter, setStarter] = useState<GroupCallStarter | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs for socket handlers (so they always see latest state without re-binding)
  const stateRef = useRef(state);
  const chatIdRef = useRef(chatId);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { chatIdRef.current = chatId; }, [chatId]);

  // ── Timer helpers ─────────────────────────────────────────────────
  const stopDurationTimer = () => {
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    durationTimerRef.current = null;
  };
  const startDurationTimer = () => {
    stopDurationTimer();
    setDurationSec(0);
    const startedAt = Date.now();
    durationTimerRef.current = setInterval(() => {
      setDurationSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
  };

  // ── Cleanup: tear down everything ─────────────────────────────────
  const cleanup = useCallback(async () => {
    stopDurationTimer();
    try { getInCallManager().stopRingtone(); } catch { /* noop */ }
    try { getInCallManager().stop(); } catch { /* noop */ }
    if (room) {
      try { await room.disconnect(); } catch { /* noop */ }
    }
    setRoom(null);
    setParticipants([]);
    setIsMuted(false);
    setIsCameraOff(false);
    setIsSpeakerOn(false);
    setDurationSec(0);
    setState('idle');
    setType(null);
    setChatId(null);
    setGroupName('');
    setStarter(null);
  }, [room]);

  // ── Connect to the LiveKit room ───────────────────────────────────
  const connectToRoom = useCallback(
    async (targetChatId: string, callType: GroupCallType): Promise<Room> => {
      // Resolve LiveKit lazily here, the first time a call connects (M4).
      const { Room, RoomEvent } = getLiveKitClient();
      // Call setup is sensitive to transient network blips (mobile networks +
      // the LiveKit websocket handshake), which surfaced as intermittent
      // "Network Error" on group-call start. Retry the whole token-fetch +
      // connect a few times with backoff before giving up.
      const attemptConnect = async (): Promise<Room> => {
        const { token, url } = await groupCallService.getToken(targetChatId);
        const r = new Room({
          adaptiveStream: true,
          dynacast: true,
        });

        // Keep participant list in sync as people join / leave / mute
        const refreshParticipants = () => {
          const all: Participant[] = [
            r.localParticipant,
            ...Array.from(r.remoteParticipants.values()),
          ];
          setParticipants(all);
        };

        r.on(RoomEvent.ParticipantConnected, refreshParticipants);
        r.on(RoomEvent.ParticipantDisconnected, (_p: RemoteParticipant) => {
          refreshParticipants();
          // If we're the last one, end the call
          if (r.remoteParticipants.size === 0) {
            Toast.show({ type: 'info', text1: t('groupCall.everyoneLeft') });
            cleanup();
          }
        });
        // A joiner sets their display-name metadata AFTER connecting, so
        // participants already in the call must re-render on metadata/name
        // change — otherwise the joiner shows with no name. (The joiner sees
        // everyone fine because those names were set before they joined.)
        r.on(RoomEvent.ParticipantMetadataChanged, refreshParticipants);
        r.on(RoomEvent.ParticipantNameChanged, refreshParticipants);
        r.on(RoomEvent.TrackMuted, refreshParticipants);
        r.on(RoomEvent.TrackUnmuted, refreshParticipants);
        r.on(RoomEvent.TrackPublished, refreshParticipants);
        r.on(RoomEvent.TrackUnpublished, refreshParticipants);
        // CRITICAL: a remote participant's video only becomes renderable once
        // its track is SUBSCRIBED (publication.track goes from null -> a track).
        // Without re-rendering on subscribe, remote video never appears even
        // though it's flowing — each person only ever sees their own camera.
        r.on(RoomEvent.TrackSubscribed, refreshParticipants);
        r.on(RoomEvent.TrackUnsubscribed, refreshParticipants);
        r.on(RoomEvent.LocalTrackPublished, refreshParticipants);
        r.on(RoomEvent.LocalTrackUnpublished, refreshParticipants);
        r.on(RoomEvent.Disconnected, () => { cleanup(); });

        try {
          await r.connect(url, token);
        } catch (e) {
          // Tear down the half-open room before retrying so its handlers and
          // websocket don't leak.
          try { await r.disconnect(); } catch { /* noop */ }
          throw e;
        }

        // Publish our identity so other participants see our name + avatar.
        // Non-fatal: if the token somehow lacks canUpdateOwnMetadata, joining
        // without metadata is far better than failing the whole call.
        if (user) {
          try {
            await r.localParticipant.setMetadata(JSON.stringify({
              displayName: user.displayName,
              username: user.username,
              avatar: user.avatar || '',
            }));
          } catch (err) {
            console.warn('[groupcall] setMetadata failed (non-fatal):', err);
          }
        }

        // Turn on mic always, camera only for video calls
        await r.localParticipant.setMicrophoneEnabled(true);
        if (callType === 'video') {
          await r.localParticipant.setCameraEnabled(true);
        }

        refreshParticipants();
        return r;
      };

      let lastErr: any;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await attemptConnect();
        } catch (err) {
          lastErr = err;
          console.warn(`[groupcall] connect attempt ${attempt + 1}/3 failed:`, err);
          if (attempt < 2) {
            await new Promise((res) => setTimeout(res, 700 * (attempt + 1)));
          }
        }
      }
      throw lastErr;
    },
    [user, t, cleanup],
  );

  // ── Audio routing helper (reads user pref for default speaker) ───
  const applyAudioRouting = (callType: GroupCallType) => {
    const useSpeaker = callType === 'video' || (storage.getBoolean('pref.defaultSpeakerOn') ?? false);
    // getInCallManager().start sets the right Android audio mode for a call
    try {
      getInCallManager().start({ media: callType === 'video' ? 'video' : 'audio' });
      getInCallManager().setForceSpeakerphoneOn(useSpeaker);
      setIsSpeakerOn(useSpeaker);
    } catch (err) {
      console.warn('audio routing failed', err);
    }
  };

  // ── Caller flow: start a new group call ──────────────────────────
  const startGroupCall = useCallback(
    async (targetChatId: string, callType: GroupCallType, name?: string) => {
      if (stateRef.current !== 'idle' || !user) return;
      setState('joining');
      setType(callType);
      setChatId(targetChatId);
      setGroupName(name || '');
      try {
        const r = await connectToRoom(targetChatId, callType);
        setRoom(r);
        setState('in_call');
        startDurationTimer();
        applyAudioRouting(callType);
        // Tell the rest of the chat that a call is starting (they'll ring)
        socketService.getSocket()?.emit('group_call_start', {
          chatId: targetChatId,
          type: callType,
        });
      } catch (err: any) {
        Toast.show({
          type: 'error',
          text1: err?.response?.data?.message || err?.message || t('call.failed'),
        });
        cleanup();
      }
    },
    [user, connectToRoom, cleanup, t],
  );

  // ── Callee flow: accept an incoming call ─────────────────────────
  const joinGroupCall = useCallback(async () => {
    if (stateRef.current !== 'incoming' || !chatIdRef.current || !type) return;
    const targetChatId = chatIdRef.current;
    const callType = type;
    setState('joining');
    try {
      const r = await connectToRoom(targetChatId, callType);
      setRoom(r);
      setState('in_call');
      startDurationTimer();
      applyAudioRouting(callType);
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: err?.response?.data?.message || err?.message || t('call.failed'),
      });
      cleanup();
    }
  }, [type, connectToRoom, cleanup, t]);

  const declineIncoming = useCallback(() => {
    if (stateRef.current !== 'incoming') return;
    cleanup();
  }, [cleanup]);

  const leaveGroupCall = useCallback(async () => {
    const cId = chatIdRef.current;
    await cleanup();
    if (cId) {
      socketService.getSocket()?.emit('group_call_end', { chatId: cId });
    }
  }, [cleanup]);

  // ── Controls ─────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (!room) return;
    const next = !isMuted;
    void room.localParticipant.setMicrophoneEnabled(!next);
    setIsMuted(next);
  }, [room, isMuted]);

  const toggleCamera = useCallback(() => {
    if (!room) return;
    const next = !isCameraOff;
    void room.localParticipant.setCameraEnabled(!next);
    setIsCameraOff(next);
  }, [room, isCameraOff]);

  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn((prev) => {
      const next = !prev;
      try { getInCallManager().setForceSpeakerphoneOn(next); } catch { /* noop */ }
      return next;
    });
  }, []);

  // ── Socket: handle incoming-call and call-ended broadcasts ───────
  useEffect(() => {
    if (!user) return;
    const socket = socketService.getSocket();
    if (!socket) return;

    const onStart = (data: {
      chatId: string;
      type: GroupCallType;
      groupName: string;
      starter: GroupCallStarter;
    }) => {
      // Already in another call → ignore (could queue, but simpler to drop)
      if (stateRef.current !== 'idle') return;
      setState('incoming');
      setType(data.type);
      setChatId(data.chatId);
      setGroupName(data.groupName);
      setStarter(data.starter);
    };

    const onEnd = (data: { chatId: string }) => {
      // The incoming call was canceled before we picked up
      if (stateRef.current === 'incoming' && data.chatId === chatIdRef.current) {
        cleanup();
      }
    };

    socket.on('group_call_start', onStart);
    socket.on('group_call_end', onEnd);
    return () => {
      socket.off('group_call_start', onStart);
      socket.off('group_call_end', onEnd);
    };
  }, [user, cleanup]);

  // ── Ringtone for incoming/outgoing calls ─────────────────────────
  useEffect(() => {
    try {
      if (state === 'incoming') {
        // 30s ringtone, default vibrate pattern, no iOS category override
        getInCallManager().startRingtone('_BUNDLE_', [500, 1000], '', 30);
      } else if (state === 'joining') {
        getInCallManager().startRingback('_BUNDLE_');
      } else {
        getInCallManager().stopRingtone();
        getInCallManager().stopRingback();
      }
    } catch { /* noop */ }
    return () => {
      try {
        getInCallManager().stopRingtone();
        getInCallManager().stopRingback();
      } catch { /* noop */ }
    };
  }, [state]);

  return (
    <GroupCallContext.Provider
      value={{
        state,
        type,
        chatId,
        groupName,
        starter,
        room,
        participants,
        isMuted,
        isCameraOff,
        isSpeakerOn,
        durationSec,
        startGroupCall,
        joinGroupCall,
        declineIncoming,
        leaveGroupCall,
        toggleMute,
        toggleCamera,
        toggleSpeaker,
      }}
    >
      {children}
    </GroupCallContext.Provider>
  );
};

export const useGroupCall = () => {
  const ctx = useContext(GroupCallContext);
  if (!ctx) throw new Error('useGroupCall must be used within GroupCallProvider');
  return ctx;
};

// Helper: return the camera VideoTrack for a participant, or null if none
export const getCameraTrack = (p: Participant) => {
  const cameraSource = getLiveKitClient().Track.Source.Camera;
  for (const pub of p.videoTrackPublications.values()) {
    if (pub.source === cameraSource && pub.track && !pub.isMuted) {
      return pub.track;
    }
  }
  return null;
};
