// iOS CallKit + VoIP push integration (expo-callkit-telecom).
//
// iOS ONLY. Android keeps using react-native-full-screen-notification-
// incoming-call for its lock-screen call UI — this service no-ops there.
//
// This first increment only handles VoIP PUSH TOKEN REGISTRATION: register
// for VoIP push, get the device's VoIP token, and send it to the backend so
// the server can deliver incoming-call pushes via APNs. The native side of
// expo-callkit-telecom reports the incoming call to CallKit automatically
// from the push payload (so it rings even when the app is killed); the
// answer/decline → WebRTC wiring is added in a later step.
//
// The native module is loaded lazily via getCallKit() (M4 convention) so it
// never resolves at app launch / on Android.

import { Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import api from './api';
import { getCallKit } from '../utils/nativeModules';

// Re-enabled 2026-06-05 with the real fix. The earlier crash was NOT our
// registerVoIPPush() call — it was a NATIVE BUILD mismatch: expo-callkit-telecom's
// pod requires iOS 16 (its CallManager uses iOS-16-only Duration APIs), but our
// app never raised the iOS deployment target (SDK 54 defaults to 15.1), so the
// native module crashed the instant it loaded. Fixed by adding expo-build-
// properties with ios.deploymentTarget "16.0" (app.json) + a fresh native build.
// NOTE: this requires a NEW BUILD — do NOT ship as an OTA to builds that lack
// the iOS-16 deployment target (e.g. build #6), or they crash again.
const CALLKIT_ENABLED = true;

let registered = false;
let tokenSub: { remove: () => void } | null = null;

const sendVoipToken = async (token: string) => {
  try {
    await api.post('/api/notifications/register-voip-token', { token });
    console.log('[callkit] VoIP token registered with backend');
  } catch (err) {
    console.warn('[callkit] failed to register VoIP token with backend:', err);
  }
};

const callkitService = {
  /** Register for VoIP push (iOS only). Idempotent. */
  init() {
    if (!CALLKIT_ENABLED) return;
    if (Platform.OS !== 'ios' || registered) return;
    registered = true;
    try {
      const CallKit = getCallKit();

      // 1) SUBSCRIBE FIRST. The APNs VoIP token is delivered ASYNCHRONOUSLY by
      //    PushKit's delegate — it is never ready synchronously right after
      //    registering. Listen before reading so we never miss the first token.
      tokenSub = CallKit.addVoIPPushTokenUpdatedListener(
        (event: { token?: string }) => {
          if (event.token) {
            sendVoipToken(event.token);
            Toast.show({
              type: 'success',
              text1: 'VoIP registered',
              text2: event.token.slice(0, 14) + '…',
              visibilityTime: 2500,
            });
          }
        }
      );

      // 2) One-shot read in case the native subscriber already got the token at
      //    launch. May be null on a cold first run — that's expected; the
      //    listener above will deliver it.
      const existing = CallKit.getVoIPPushToken();
      if (existing?.token) {
        sendVoipToken(existing.token);
        Toast.show({
          type: 'success',
          text1: 'VoIP ready',
          text2: existing.token.slice(0, 14) + '…',
          visibilityTime: 2500,
        });
      }

      // 3) registerVoIPPush() is idempotent (the native side guards against a
      //    double PKPushRegistry) and the AppDelegate subscriber already
      //    registered at launch — this is just belt-and-suspenders.
      CallKit.registerVoIPPush();
    } catch (err) {
      console.warn('[callkit] init failed:', err);
      registered = false;
    }
  },

  /** Tear down listeners (on logout). */
  cleanup() {
    if (tokenSub) {
      try { tokenSub.remove(); } catch { /* noop */ }
      tokenSub = null;
    }
    registered = false;
  },
};

export default callkitService;
