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
    if (Platform.OS !== 'ios' || registered) return;
    registered = true;
    try {
      const CallKit = getCallKit();
      CallKit.registerVoIPPush();

      // A token may already be available from a previous registration.
      const existing = CallKit.getVoIPPushToken();
      if (existing?.token) {
        sendVoipToken(existing.token);
        // Temporary on-device confirmation while we verify the integration.
        Toast.show({
          type: 'success',
          text1: 'VoIP ready',
          text2: existing.token.slice(0, 14) + '…',
          visibilityTime: 2500,
        });
      }

      // Subscribe to token updates (fires on first registration + rotation).
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
