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
import {
  RTCPeerConnection,
  RTCIceCandidate,
  mediaDevices,
  MediaStream,
} from '@livekit/react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import { AppState } from 'react-native';
import socketService from '../services/socketService';
import callService from '../services/callService';
import userService from '../services/userService';
import callkeepService from '../services/callkeepService';
import { useAuth } from '../stores/authStore';

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

  // Keep refs in sync with state
  useEffect(() => { callStateRef.current = callState; }, [callState]);
  useEffect(() => { remoteUserRef.current = remoteUser; }, [remoteUser]);
  useEffect(() => { chatIdRef.current = chatId; }, [chatId]);
  useEffect(() => { callTypeRef.current = callType; }, [callType]);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

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

    // Close peer connection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    // Stop local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }

    // Stop InCallManager
    try {
      InCallManager.stop();
    } catch {}

    // Hide native call notification (if showing)
    callkeepService.hideIncomingCall();

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
    const stream = await mediaDevices.getUserMedia(constraints);
    return stream as MediaStream;
  }, []);

  // ── Create peer connection ────────────────────────────────────
  const createPeer = useCallback(async (): Promise<RTCPeerConnection> => {
    const iceServers = await callService.getIceServers();
    const config: any = { iceServers };

    const pc = new RTCPeerConnection(config);

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
        setCallState('in_call');
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
    const label = type === 'video' ? 'Video call' : 'Voice call';
    const content = durationStr ? `${label} ${durationStr}` : `${label} — missed`;

    socketService.emit('send_message', {
      chatId: cid,
      content,
      type: 'system',
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
      // Start InCallManager
      InCallManager.start({ media: type === 'video' ? 'video' : 'audio' });
      InCallManager.setKeepScreenOn(true);
      if (type === 'video') {
        InCallManager.setSpeakerphoneOn(true);
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

    setCallState('connecting');

    try {
      const type = callTypeRef.current || 'voice';

      // Start InCallManager
      InCallManager.start({ media: type === 'video' ? 'video' : 'audio' });
      InCallManager.setKeepScreenOn(true);
      InCallManager.stopRingtone();
      if (type === 'video') {
        InCallManager.setSpeakerphoneOn(true);
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
    } catch (err) {
      console.error('[call] Failed to accept call:', err);
      cleanup();
    }
  }, [getMedia, createPeer, flushCandidates, cleanup]);

  // ── Reject call (callee) ──────────────────────────────────────
  const rejectCall = useCallback((reason?: string) => {
    const callerId = remoteUserRef.current?.id;
    if (callerId) {
      socketService.emit('reject_call', { callerId, reason });
    }
    try {
      InCallManager.stopRingtone();
    } catch {}
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
        InCallManager.setSpeakerphoneOn(next);
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
        }
      },
      // User tapped Decline on native notification (or it timed out)
      (_info, timedOut) => {
        console.log('[callkeep] Decline triggered, timedOut:', timedOut);
        if (callStateRef.current === 'ringing') {
          rejectCall(timedOut ? 'timeout' : undefined);
        }
      },
    );

    return cleanup_ck;
  }, [user, acceptCall, rejectCall]);

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

      // Show native full-screen incoming call notification ONLY when the
      // app isn't currently in the foreground. In foreground the JS
      // IncomingCallOverlay handles the ringing UI; layering the native
      // full-screen-notification on top of it crashes on some Samsung
      // devices (including the Fold Z 6) and is redundant anyway.
      const isForeground = AppState.currentState === 'active';
      if (!isForeground) {
        callkeepService.showIncomingCall({
          callerId: data.callerId,
          callerName: callerInfo.displayName,
          avatar: callerInfo.avatar,
          callType: data.type,
          chatId: data.chatId,
        });
      }

      // Play ringtone
      try {
        InCallManager.startRingtone('_DEFAULT_', 1000, 'default', 30);
      } catch {}

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
    const onCallEnded = (data: { byUserId: string }) => {
      if (callStateRef.current === 'idle') return;
      console.log('[call] Call ended by:', data.byUserId);

      const durationSecs = callStartTimeRef.current > 0
        ? Math.floor((Date.now() - callStartTimeRef.current) / 1000)
        : 0;
      postCallRecord(durationSecs, callTypeRef.current || 'voice');
      cleanup();
    };

    // ── ICE candidate ───────────────────────────────────────────
    const onIceCandidate = (data: {
      otherUserId: string;
      candidate: any;
    }) => {
      if (!data.candidate) return;

      const candidate = new RTCIceCandidate(data.candidate);

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
