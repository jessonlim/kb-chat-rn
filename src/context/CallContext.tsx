// CallContext — manages 1:1 voice/video calls via WebRTC + Socket.IO signaling.
// Ported from the Capacitor app's HybridCallContext, WebRTC-only (no Agora).

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import type {
  RTCPeerConnection,
  RTCIceCandidate,
  MediaStream,
} from '@livekit/react-native-webrtc';
import { AppState, Platform } from 'react-native';
import socketService from '../services/socketService';
import callService from '../services/callService';
import userService from '../services/userService';
import callkeepService from '../services/callkeepService';
import { tStatic } from '../i18n/I18nContext';
import {
  showIncomingCallNotification,
  hideIncomingCallNotification,
  consumePendingCallAction,
} from '../services/incomingCallNotification';
import callkitService from '../services/callkitService';
import {
  showOngoingCall,
  hideOngoingCall,
  setEndCallHandler,
} from '../services/ongoingCallService';
import { useAuth } from '../stores/authStore';
import { getWebRTC, getInCallManager, getLockScreen } from '../utils/nativeModules';

// Native modules (WebRTC + InCallManager) are accessed lazily via the
// getters above (audit M4). Types are `import type` so they're erased at
// compile time and never trigger native resolution at app launch — only
// the actual call actions (getMedia, createPeer, ringtone) pull them in.

// ── Types ──────────────────────────────────────────────────────────
export type CallState = 'idle' | 'calling' | 'ringing' | 'connecting' | 'in_call';

export interface RemoteUser {
  id: string;
  displayName: string;
  username: string;
  avatar?: string;
}

interface CallContextType {
  callState: CallState;
  callType: 'voice' | 'video' | null;
  remoteUser: RemoteUser | null;
  chatId: string | null;
  isMuted: boolean;
  isSpeaker: boolean;
  isCameraOn: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  duration: number;

  startCall: (target: RemoteUser, chatId: string, type: 'voice' | 'video') => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: (reason?: string) => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleCamera: () => void;
}

const CallContext = createContext<CallContextType>({
  callState: 'idle',
  callType: null,
  remoteUser: null,
  chatId: null,
  isMuted: false,
  isSpeaker: false,
  isCameraOn: true,
  localStream: null,
  remoteStream: null,
  duration: 0,
  startCall: async () => {},
  acceptCall: async () => {},
  rejectCall: () => {},
  endCall: () => {},
  toggleMute: () => {},
  toggleSpeaker: () => {},
  toggleCamera: () => {},
});

export const useCall = () => useContext(CallContext);

// ── VP8 codec preference (Galaxy phone compatibility) ──────────────
const preferVP8 = (sdp: string): string => {
  const lines = sdp.split('\r\n');
  const videoMLineIdx = lines.findIndex((l) => l.startsWith('m=video'));
  if (videoMLineIdx === -1) return sdp;

  // Find VP8 payload type
  const vp8Line = lines.find(
    (l) => l.toLowerCase().includes('rtpmap') && l.toLowerCase().includes('vp8')
  );
  if (!vp8Line) return sdp;

  const vp8PT = vp8Line.split(':')[1]?.split(' ')[0];
  if (!vp8PT) return sdp;

  // Reorder m=video line to put VP8 first
  const mLine = lines[videoMLineIdx];
  const parts = mLine.split(' ');
  // m=video PORT PROTO PT1 PT2 PT3...
  const header = parts.slice(0, 3);
  const payloads = parts.slice(3);
  const reordered = [vp8PT, ...payloads.filter((p) => p !== vp8PT)];
  lines[videoMLineIdx] = [...header, ...reordered].join(' ');

  return lines.join('\r\n');
};

// ── Provider ───────────────────────────────────────────────────────
export const CallProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();

  // State
  const [callState, setCallState] = useState<CallState>('idle');
  const [callType, setCallType] = useState<'voice' | 'video' | null>(null);
  const [remoteUser, setRemoteUser] = useState<RemoteUser | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [duration, setDuration] = useState(0);

  // Refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const remoteDescSetRef = useRef(false);
  const iceCandidateQueue = useRef<RTCIceCandidate[]>([]);
  const pendingOfferRef = useRef<{ type: string; sdp: string } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartTimeRef = useRef<number>(0);
  const callStateRef = useRef<CallState>('idle');
  const remoteUserRef = useRef<RemoteUser | null>(null);
  const chatIdRef = useRef<string | null>(null);
  const callTypeRef = useRef<'voice' | 'video' | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  // Set when the user answers from the iOS CallKit system UI BEFORE the
  // WebRTC offer has arrived (cold launch from a notification). The backend
  // replays `incoming_call` on socket reconnect; the auto-accept effect then
  // connects the call once callState becomes 'ringing'.
  const pendingCallKitAnswerRef = useRef(false);
  const pendingAnswerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // iOS CallKit: the {id, requestId} from the system-UI answer action — needed to
  // fulfillIncomingCallConnected once media connects (else CallKit kills the call
  // ~30s later and audio never activates). And the outgoing CallKit call id.
  const pendingAnswerRef = useRef<{ id: string; requestId: string } | null>(null);
  const outgoingCallKitIdRef = useRef<string | null>(null);
  // Lock-screen drop (Android): true once the user is actively in the call
  // (callee answered / caller connected). Gates the end-of-call keyguard
  // drop so missed/declined/busy/timed-out/cancelled calls never background
  // the app. prevCallStateRef lets the edge effect see the previous state.
  const wasEngagedRef = useRef(false);
  const prevCallStateRef = useRef<CallState>('idle');

  // Keep refs in sync with state
  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { remoteUserRef.current = remoteUser; }, [remoteUser]);
  useEffect(() => { chatIdRef.current = chatId; }, [chatId]);
  useEffect(() => { callTypeRef.current = callType; }, [callType]);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  // ── Drop behind the lock screen when a call ends while LOCKED (Android) ──
  // Every end path (endCall, rejectCall, onCallEnded, onCallRejected, connection
  // failed/closed, cleanup, decline, timeout) funnels through setCallState('idle'),
  // so the non-idle -> 'idle' edge catches them all. We drop on ANY locked
  // call-end — answered, DECLINED, or missed — because any call that rang over
  // the lock screen launched the app over the keyguard (full-screen intent), so
  // it must drop back (a declined call was leaving the app open over the lock
  // screen). The native dropBehindKeyguardIfLocked() RE-CHECKS the keyguard and
  // no-ops when unlocked — that's the real gate (answered-while-unlocked,
  // outgoing calls, unlock-mid-call all stay put).
  useEffect(() => {
    const prev = prevCallStateRef.current;
    prevCallStateRef.current = callState;
    if (Platform.OS !== 'android') return;
    if (prev !== 'idle' && callState === 'idle') {
      // Defer one tick so cleanup's state resets + notification teardown
      // commit before the activity goes to the back.
      setTimeout(() => {
        try { getLockScreen().dropBehindKeyguardIfLocked(); } catch {}
      }, 0);
    }
  }, [callState]);

  // ── Cleanup helper ─────────────────────────────────────────────
  const cleanup = useCallback(() => {
    // Clear timers
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (durationRef.current) {
      clearInterval(durationRef.current);
      durationRef.current = null;
    }
    if (pendingAnswerTimerRef.current) {
      clearTimeout(pendingAnswerTimerRef.current);
      pendingAnswerTimerRef.current = null;
    }
    pendingCallKitAnswerRef.current = false;

    // Close peer connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    // Stop local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }

    // Stop InCallManager (Android only — on iOS CallKit owns the audio session
    // and tears it down itself in provider:didDeactivate; calling stop() here
    // fights it). Clear the iOS CallKit refs either way.
    if (Platform.OS === 'android') {
      try { getInCallManager().stop(); } catch {}
    }
    outgoingCallKitIdRef.current = null;
    pendingAnswerRef.current = null;

    // Hide the incoming-call notification (Notifee full-screen) if showing.
    void hideIncomingCallNotification();

    // Dismiss the iOS CallKit system UI if a call session is lingering
    // (fire-and-forget; no-op on Android / when no session exists).
    callkitService.endActiveCallKitCall();

    // Reset refs
    remoteDescSetRef.current = false;
    iceCandidateQueue.current = [];
    pendingOfferRef.current = null;
    callStartTimeRef.current = 0;

    // Reset state
    setCallState('idle');
    setCallType(null);
    setRemoteUser(null);
    setChatId(null);
    setIsMuted(false);
    setIsSpeaker(false);
    setIsCameraOn(true);
    setLocalStream(null);
    setRemoteStream(null);
    setDuration(0);
  }, []);

  // ── Get user media ─────────────────────────────────────────────
  const getMedia = useCallback(async (type: 'voice' | 'video'): Promise<MediaStream> => {
    const constraints: any = {
      audio: true,
      video: type === 'video' ? { facingMode: 'user', width: 640, height: 480 } : false,
    };
    const stream = await getWebRTC().mediaDevices.getUserMedia(constraints);
    return stream as MediaStream;
  }, []);

  // ── Create peer connection ────────────────────────────────────
  const createPeer = useCallback(async (): Promise<RTCPeerConnection> => {
    const iceServers = await callService.getIceServers();
    const config: any = { iceServers };

    const pc = new (getWebRTC().RTCPeerConnection)(config);

    // When we get a remote track, save the remote stream
    (pc as any).ontrack = (event: any) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    // Send ICE candidates to the other peer
    (pc as any).onicecandidate = (event: any) => {
      if (event.candidate && remoteUserRef.current) {
        socketService.emit('ice_candidate', {
          otherUserId: remoteUserRef.current.id,
          candidate: event.candidate.toJSON
            ? event.candidate.toJSON()
            : event.candidate,
        });
      }
    };

    // Monitor connection state
    (pc as any).onconnectionstatechange = () => {
      const state = (pc as any).connectionState;
      console.log('[call] connection state:', state);

      if (state === 'connected') {
        wasEngagedRef.current = true; // call is live — eligible for keyguard drop on end
        setCallState('in_call');
        // iOS outgoing: tell CallKit the outgoing call connected (stops the
        // dialing state). Audio activates via CallKit didActivate regardless.
        if (Platform.OS === 'ios' && outgoingCallKitIdRef.current) {
          callkitService.reportOutgoingConnected(outgoingCallKitIdRef.current);
        }
        callStartTimeRef.current = Date.now();
        durationRef.current = setInterval(() => {
          setDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
        }, 1000);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        if (callStateRef.current !== 'idle') {
          cleanup();
        }
      }
    };

    (pc as any).oniceconnectionstatechange = () => {
      console.log('[call] ICE state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        if (callStateRef.current === 'connecting') {
          wasEngagedRef.current = true; // call is live — eligible for keyguard drop on end
          setCallState('in_call');
          callStartTimeRef.current = Date.now();
          durationRef.current = setInterval(() => {
            setDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
          }, 1000);
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
        }
      }
    };

    pcRef.current = pc;
    return pc;
  }, [cleanup]);

  // ── Flush queued ICE candidates ───────────────────────────────
  const flushCandidates = useCallback(() => {
    if (!pcRef.current) return;
    const queue = iceCandidateQueue.current;
    iceCandidateQueue.current = [];
    queue.forEach((candidate) => {
      pcRef.current?.addIceCandidate(candidate).catch((e) =>
        console.warn('[call] Failed to add queued ICE candidate:', e)
      );
    });
  }, []);

  // ── Post call record (system message) ─────────────────────────
  const postCallRecord = useCallback((durationSecs: number, type: 'voice' | 'video') => {
    const cid = chatIdRef.current;
    if (!cid) return;

    const mins = Math.floor(durationSecs / 60);
    const secs = durationSecs % 60;
    const durationStr = durationSecs > 0
      ? `${mins}:${secs.toString().padStart(2, '0')}`
      : '';
    // `content` is a localized fallback (caller's language) used for chat-list
    // previews + push notifications. The bubble itself re-localizes from
    // `callData` at render time, so switching language updates the label.
    const content = durationStr
      ? tStatic(type === 'video' ? 'call.recordVideo' : 'call.recordVoice', { duration: durationStr })
      : tStatic(type === 'video' ? 'call.recordVideoMissed' : 'call.recordVoiceMissed');

    socketService.emit('send_message', {
      chatId: cid,
      content,
      type: 'system',
      callData: {
        callType: type,
        missed: durationSecs <= 0,
        duration: durationSecs,
      },
    });
  }, []);

  // ── Start call (caller) ───────────────────────────────────────
  const startCall = useCallback(async (
    target: RemoteUser,
    targetChatId: string,
    type: 'voice' | 'video',
  ) => {
    if (callStateRef.current !== 'idle') return;

    setCallState('calling');
    setCallType(type);
    setRemoteUser(target);
    setChatId(targetChatId);
    setIsCameraOn(type === 'video');
    setIsSpeaker(type === 'video');

    try {
      if (Platform.OS === 'android') {
        getInCallManager().start({ media: type === 'video' ? 'video' : 'audio' });
        getInCallManager().setKeepScreenOn(true);
        if (type === 'video') getInCallManager().setSpeakerphoneOn(true);
      } else {
        // iOS: open an OUTGOING CallKit session so the WebRTC audio unit
        // (process-wide manual-audio mode) activates on CallKit didActivate.
        // Without a CallKit session there is NO audio on iOS.
        outgoingCallKitIdRef.current = await callkitService.startOutgoing({
          recipientId: target.id,
          recipientName: target.displayName,
          avatar: target.avatar,
          hasVideo: type === 'video',
        });
        if (type === 'video') callkitService.setSpeaker(true);
      }

      // Get media
      const stream = await getMedia(type);
      setLocalStream(stream);

      // Create peer connection
      const pc = await createPeer();

      // Add local tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Create and send offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: type === 'video',
      } as any);

      // Prefer VP8 for video calls
      if (type === 'video' && offer.sdp) {
        offer.sdp = preferVP8(offer.sdp);
      }

      await pc.setLocalDescription(offer);

      socketService.emit('call_user', {
        calleeId: target.id,
        chatId: targetChatId,
        type,
        offer: { type: offer.type, sdp: offer.sdp },
      });

      // 50s timeout — if no answer, end call
      timeoutRef.current = setTimeout(() => {
        if (callStateRef.current === 'calling') {
          console.log('[call] Timeout — no answer');
          endCall();
        }
      }, 50000);
    } catch (err) {
      console.error('[call] Failed to start call:', err);
      cleanup();
    }
  }, [getMedia, createPeer, cleanup]);

  // ── Accept call (callee) ──────────────────────────────────────
  const acceptCall = useCallback(async () => {
    if (callStateRef.current !== 'ringing') return;

    wasEngagedRef.current = true; // callee answered — eligible for keyguard drop on end
    setCallState('connecting');

    try {
      const type = callTypeRef.current || 'voice';

      if (Platform.OS === 'android') {
        getInCallManager().start({ media: type === 'video' ? 'video' : 'audio' });
        getInCallManager().setKeepScreenOn(true);
        getInCallManager().stopRingtone();
        if (type === 'video') getInCallManager().setSpeakerphoneOn(true);
      } else if (type === 'video') {
        // iOS: CallKit owns the audio session; just route video to speaker.
        callkitService.setSpeaker(true);
      }

      // Get media
      const stream = await getMedia(type);
      setLocalStream(stream);

      // Create peer connection
      const pc = await createPeer();

      // Set remote description from stored offer
      const offer = pendingOfferRef.current;
      if (offer) {
        await pc.setRemoteDescription(offer as any);
        remoteDescSetRef.current = true;
        flushCandidates();
      }

      // Add local tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Create and send answer
      const answer = await pc.createAnswer();

      if (type === 'video' && answer.sdp) {
        answer.sdp = preferVP8(answer.sdp);
      }

      await pc.setLocalDescription(answer);

      socketService.emit('accept_call', {
        callerId: remoteUserRef.current?.id,
        answer: { type: answer.type, sdp: answer.sdp },
      });

      // iOS: ack the CallKit answer now that media is negotiated → CallKit
      // activates the audio session → two-way audio. Done HERE (not on
      // ICE-connected) to avoid CallKit's ~30s answer-action timeout.
      if (Platform.OS === 'ios' && pendingAnswerRef.current) {
        const ans = pendingAnswerRef.current;
        pendingAnswerRef.current = null;
        callkitService.fulfillAnswer(ans.requestId);
      }
    } catch (err) {
      console.error('[call] Failed to accept call:', err);
      // iOS: fail the CallKit answer so the system UI clears instead of hanging.
      if (Platform.OS === 'ios' && pendingAnswerRef.current) {
        const ans = pendingAnswerRef.current;
        pendingAnswerRef.current = null;
        callkitService.failAnswer(ans.id, ans.requestId);
      }
      cleanup();
    }
  }, [getMedia, createPeer, flushCandidates, cleanup]);

  // ── Reject call (callee) ──────────────────────────────────────
  const rejectCall = useCallback((reason?: string) => {
    const callerId = remoteUserRef.current?.id;
    if (callerId) {
      socketService.emit('reject_call', { callerId, reason });
    }
    if (Platform.OS === 'android') {
      try { getInCallManager().stopRingtone(); } catch {}
    }
    cleanup();
  }, [cleanup]);

  // ── End call ──────────────────────────────────────────────────
  const endCall = useCallback(() => {
    const otherUserId = remoteUserRef.current?.id;
    const type = callTypeRef.current || 'voice';

    // Calculate duration
    const durationSecs = callStartTimeRef.current > 0
      ? Math.floor((Date.now() - callStartTimeRef.current) / 1000)
      : 0;

    if (otherUserId) {
      socketService.emit('end_call', { otherUserId });
    }

    // Post call record as system message
    postCallRecord(durationSecs, type);

    cleanup();
  }, [cleanup, postCallRecord]);

  // ── Toggle controls ───────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  }, []);

  const toggleSpeaker = useCallback(() => {
    setIsSpeaker((prev) => {
      const next = !prev;
      try {
        if (Platform.OS === 'android') getInCallManager().setSpeakerphoneOn(next);
        else callkitService.setSpeaker(next); // iOS: route via CallKit's audio session
      } catch {}
      return next;
    });
  }, []);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsCameraOn(videoTrack.enabled);
    }
  }, []);

  // ── CallKeep listeners (native notification Answer/Decline) ────
  useEffect(() => {
    if (!user) return;

    const cleanup_ck = callkeepService.setupListeners(
      // User tapped Answer on native notification
      (_info) => {
        console.log('[callkeep] Answer triggered, callState:', callStateRef.current);
        if (callStateRef.current === 'ringing') {
          acceptCall();
        } else {
          // Cold launch from a KILLED state (the FCM full-screen ring): the
          // WebRTC offer hasn't arrived yet. Queue the answer — the backend
          // replays incoming_call when our socket reconnects (callState ->
          // 'ringing') and the shared auto-accept effect connects the call.
          // Mirrors the iOS CallKit cold-launch path.
          pendingCallKitAnswerRef.current = true;
          if (pendingAnswerTimerRef.current) clearTimeout(pendingAnswerTimerRef.current);
          pendingAnswerTimerRef.current = setTimeout(() => {
            pendingCallKitAnswerRef.current = false;
            pendingAnswerTimerRef.current = null;
          }, 40000);
        }
      },
      // User tapped Decline on native notification (or it timed out)
      (info, timedOut) => {
        console.log('[callkeep] Decline triggered, timedOut:', timedOut);
        if (callStateRef.current === 'ringing') {
          rejectCall(timedOut ? 'timeout' : undefined);
        } else if (!timedOut && info?.callerId) {
          // Cold-launch decline before the offer arrived: best-effort tell the
          // caller (if the socket is up by now); otherwise the caller's ring
          // window expires on its own.
          try {
            socketService.emit('reject_call', { callerId: info.callerId, reason: 'declined' });
          } catch { /* socket not ready — caller will time out */ }
        }
      },
    );

    return cleanup_ck;
  }, [user, acceptCall, rejectCall]);

  // ── CallKit listeners (iOS system call UI: Answer / End) ───────
  // Bridges the native iOS call UI (lock-screen slide-to-answer, the
  // in-call End button, decline-via-side-button) back into our call state.
  useEffect(() => {
    if (!user || Platform.OS !== 'ios') return;

    const cleanup_ckit = callkitService.setupCallListeners(
      // User answered from the iOS system call UI
      (event) => {
        console.log('[callkit] Answer triggered, callState:', callStateRef.current);
        // Stash {id, requestId} so acceptCall can fulfillIncomingCallConnected
        // once media is negotiated (survives the cold-launch queue detour too).
        pendingAnswerRef.current = event;
        if (callStateRef.current === 'ringing') {
          acceptCall();
        } else {
          // Cold launch: answered from the notification before the WebRTC
          // offer arrived. Queue it — the auto-accept effect connects the call
          // once the backend replays incoming_call (callState -> 'ringing').
          pendingCallKitAnswerRef.current = true;
          if (pendingAnswerTimerRef.current) clearTimeout(pendingAnswerTimerRef.current);
          pendingAnswerTimerRef.current = setTimeout(() => {
            pendingCallKitAnswerRef.current = false;
            pendingAnswerTimerRef.current = null;
          }, 40000); // 40s: a slow Samsung cold-start can exceed 20s before the offer replays
        }
      },
      // User ended / declined from the iOS system call UI
      () => {
        console.log('[callkit] End triggered, callState:', callStateRef.current);
        const st = callStateRef.current;
        if (st === 'ringing') {
          rejectCall(); // notify caller their call was declined + cleanup
        } else if (st !== 'idle') {
          endCall(); // hang up an active/connecting call + cleanup
        }
      },
    );

    return cleanup_ckit;
  }, [user, acceptCall, rejectCall, endCall]);

  // ── Foreground reconcile (iOS): clear a stale incoming-call overlay ──
  // If the phone was locked during a call, the JS may have missed the
  // `call_ended` socket event, leaving callState stuck on 'ringing' so the
  // incoming-call overlay lingers when the user reopens the app. On return
  // to the foreground, ask CallKit whether a call is still live; if not,
  // clean up. Only 'ringing' (incoming) is reconciled — outgoing 'calling'
  // and connected calls have no incoming CallKit session and must be left
  // alone.
  useEffect(() => {
    if (!user || Platform.OS !== 'ios') return;

    const sub = AppState.addEventListener('change', async (next) => {
      if (next !== 'active') return;
      if (callStateRef.current !== 'ringing') return;
      const alive = await callkitService.hasActiveCallSession();
      if (!alive && callStateRef.current === 'ringing') {
        console.log('[callkit] foreground reconcile — no live call session, clearing stale ring');
        cleanup();
      }
    });

    return () => sub.remove();
  }, [user, cleanup]);

  // ── Auto-accept a queued CallKit answer once the offer arrives ──
  // If the user answered from the iOS system UI on a cold launch (before the
  // WebRTC offer), pendingCallKitAnswerRef is set. The backend replays
  // incoming_call on socket reconnect → callState becomes 'ringing' → connect
  // here. The ref-sync effect runs before this one, so acceptCall()'s
  // `callStateRef.current === 'ringing'` guard passes.
  useEffect(() => {
    if (callState === 'ringing' && pendingCallKitAnswerRef.current) {
      pendingCallKitAnswerRef.current = false;
      if (pendingAnswerTimerRef.current) {
        clearTimeout(pendingAnswerTimerRef.current);
        pendingAnswerTimerRef.current = null;
      }
      acceptCall();
    }
  }, [callState, acceptCall]);

  // ── Consume a pending Answer/Decline from the Android lock-screen call
  // notification (Notifee). The choice is persisted to MMKV by the headless FCM
  // event handler (a SEPARATE JS context), so we read it when THIS context
  // becomes active: on mount (cold launch) and on every return to foreground
  // (backgrounded-but-alive). Feeds the SAME pendingCallKitAnswerRef machinery
  // the iOS CallKit cold-launch already uses.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const consume = () => {
      const pending = consumePendingCallAction();
      if (!pending) return;
      if (pending.action === 'answer') {
        if (callStateRef.current === 'ringing') {
          acceptCall(); // offer already here (backgrounded-alive) → connect now
        } else {
          // Cold launch: offer not here yet. Arm the auto-accept that fires once
          // the backend replays incoming_call and callState -> 'ringing'.
          pendingCallKitAnswerRef.current = true;
          if (pendingAnswerTimerRef.current) clearTimeout(pendingAnswerTimerRef.current);
          pendingAnswerTimerRef.current = setTimeout(() => {
            pendingCallKitAnswerRef.current = false;
            pendingAnswerTimerRef.current = null;
          }, 40000);
        }
      } else if (pending.action === 'decline') {
        try { socketService.emit('reject_call', { callerId: pending.callerId, reason: 'declined' }); } catch { /* socket not up — caller times out */ }
        void hideIncomingCallNotification();
      }
    };
    consume(); // cold launch
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') consume(); });
    return () => sub.remove();
  }, [acceptCall]);

  // ── Android ongoing-call notification (keep-alive + mic indicator) ──
  // While a call is connected, show a persistent foreground-service
  // notification (WhatsApp-style). It keeps the call running when the app is
  // backgrounded and surfaces Android's green mic indicator. No-op on iOS.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (callState === 'in_call' || callState === 'connecting') {
      showOngoingCall({
        name: remoteUser?.displayName || remoteUser?.username || '',
        isVideo: callType === 'video',
        source: 'direct',
      });
      setEndCallHandler(() => endCall());
    } else if (callState === 'idle') {
      // Pass 'direct' so this can't tear down a group call's notification.
      // hideOngoingCall clears the end handler too when we own it.
      hideOngoingCall('direct');
    }
  }, [callState, remoteUser, callType, endCall]);

  // ── Socket event handlers ─────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    // ── Incoming call ───────────────────────────────────────────
    const onIncomingCall = async (data: {
      callerId: string;
      chatId: string;
      type: 'voice' | 'video';
      offer?: { type: string; sdp: string };
    }) => {
      // Already in a call? Auto-reject with 'busy'
      if (callStateRef.current !== 'idle') {
        socketService.emit('reject_call', { callerId: data.callerId, reason: 'busy' });
        return;
      }

      // Store the offer
      if (data.offer) {
        pendingOfferRef.current = data.offer;
      }

      // Fetch caller info
      let callerInfo: RemoteUser = {
        id: data.callerId,
        displayName: 'Unknown',
        username: 'unknown',
      };
      try {
        const { user: callerUser } = await userService.getUserById(data.callerId);
        callerInfo = {
          id: callerUser.id,
          displayName: callerUser.displayName || callerUser.username,
          username: callerUser.username,
          avatar: callerUser.avatar,
        };
      } catch {
        console.warn('[call] Failed to fetch caller info');
      }

      setRemoteUser(callerInfo);
      setChatId(data.chatId);
      setCallType(data.type);
      setIsCameraOn(data.type === 'video');
      setIsSpeaker(data.type === 'video');
      setCallState('ringing');

      // Show the full-screen incoming-call notification (Notifee) ONLY when the
      // app isn't currently in the foreground. In foreground the JS
      // IncomingCallOverlay handles the ringing UI; layering the notification on
      // top is redundant. (Notifee's fullScreenAction — unlike the old lib — does
      // NOT start a foreground service, so it doesn't crash from a cold start.)
      const isForeground = AppState.currentState === 'active';
      if (!isForeground) {
        void showIncomingCallNotification({
          callerId: data.callerId,
          callerName: callerInfo.displayName,
          avatar: callerInfo.avatar,
          callType: data.type,
          chatId: data.chatId,
        });
      }

      // Ringtone — Android only. On iOS, CallKit plays the system ringtone and
      // (critically) provides the audio session: WebRTC is in process-wide
      // manual-audio mode, so audio only works inside a CallKit session.
      if (Platform.OS === 'android') {
        try { getInCallManager().startRingtone('_DEFAULT_', 1000, 'default', 30); } catch {}
      } else {
        // Ensure a CallKit session exists. If the VoIP push already reported the
        // call (app was killed/backgrounded), a session is live → skip the
        // duplicate. When foreground (no push), this is what rings + enables audio.
        try {
          const alive = await callkitService.hasActiveCallSession();
          if (!alive) {
            await callkitService.reportIncoming({
              chatId: data.chatId,
              callerId: data.callerId,
              callerName: callerInfo.displayName,
              avatar: callerInfo.avatar,
              hasVideo: data.type === 'video',
            });
          }
        } catch (e) { console.warn('[callkit] reportIncoming gate failed:', e); }
      }

      // 50s timeout for ringing
      timeoutRef.current = setTimeout(() => {
        if (callStateRef.current === 'ringing') {
          rejectCall('timeout');
        }
      }, 50000);
    };

    // ── Call accepted (caller receives this) ────────────────────
    const onCallAccepted = async (data: {
      calleeId: string;
      answer?: { type: string; sdp: string };
    }) => {
      if (callStateRef.current !== 'calling') return;
      setCallState('connecting');

      if (data.answer && pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(data.answer as any);
          remoteDescSetRef.current = true;
          flushCandidates();
        } catch (err) {
          console.error('[call] Failed to set remote description:', err);
        }
      }
    };

    // ── Call rejected ───────────────────────────────────────────
    const onCallRejected = (data: { calleeId: string; reason?: string }) => {
      if (callStateRef.current === 'calling') {
        console.log('[call] Call rejected:', data.reason);
        postCallRecord(0, callTypeRef.current || 'voice');
        cleanup();
      }
    };

    // ── Call ended ──────────────────────────────────────────────
    // We DON'T post a call-record system message here. The peer who
    // initiated the hangup already posted one via their endCall()
    // codepath, and the backend broadcasts that as a normal Message
    // (received by both of us via receive_message). If we ALSO posted
    // one here we'd get two identical "Voice call 0:28" entries — see
    // bug report from 2026-05-26.
    const onCallEnded = (data: { byUserId: string }) => {
      if (callStateRef.current === 'idle') return;
      console.log('[call] Call ended by:', data.byUserId);
      cleanup();
    };

    // ── ICE candidate ───────────────────────────────────────────
    const onIceCandidate = (data: {
      otherUserId: string;
      candidate: any;
    }) => {
      if (!data.candidate) return;

      const candidate = new (getWebRTC().RTCIceCandidate)(data.candidate);

      if (!remoteDescSetRef.current) {
        // Queue until remote description is set
        iceCandidateQueue.current.push(candidate);
      } else if (pcRef.current) {
        pcRef.current.addIceCandidate(candidate).catch((e) =>
          console.warn('[call] Failed to add ICE candidate:', e)
        );
      }
    };

    // Register socket listeners
    socket.on('incoming_call', onIncomingCall);
    socket.on('call_accepted', onCallAccepted);
    socket.on('call_rejected', onCallRejected);
    socket.on('call_ended', onCallEnded);
    socket.on('ice_candidate', onIceCandidate);

    return () => {
      socket.off('incoming_call', onIncomingCall);
      socket.off('call_accepted', onCallAccepted);
      socket.off('call_rejected', onCallRejected);
      socket.off('call_ended', onCallEnded);
      socket.off('ice_candidate', onIceCandidate);
    };
  }, [user, cleanup, flushCandidates, rejectCall, postCallRecord]);

  return (
    <CallContext.Provider
      value={{
        callState,
        callType,
        remoteUser,
        chatId,
        isMuted,
        isSpeaker,
        isCameraOn,
        localStream,
        remoteStream,
        duration,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleSpeaker,
        toggleCamera,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};
