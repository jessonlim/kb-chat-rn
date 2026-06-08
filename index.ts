// LiveKit must register its WebRTC globals BEFORE any other RN-WebRTC code
// is imported. This patches `RTCPeerConnection`, `mediaDevices`, etc. onto
// the global scope so livekit-client (designed for the web) works in RN.
import { registerGlobals } from '@livekit/react-native';
// Wrapped: this also runs in the headless FCM background task (a no-UI context).
// It's just global assignment (the standard LiveKit pattern) so it should never
// throw, but guard it so a hypothetical headless failure can't crash the whole
// background task before the call notification is drawn.
try { registerGlobals(); } catch (err) { console.warn('[livekit] registerGlobals failed:', err); }

import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

// Register the Android ongoing-call foreground service + its notification-action
// handlers. Must run at the top level (before the app renders) so background
// "End call" presses are caught. No-op on iOS / if Notifee is unavailable.
import { registerOngoingCallService } from './src/services/ongoingCallService';
registerOngoingCallService();

// ── Android: wake a KILLED/locked app on a data-only FCM call push and draw
// the native full-screen incoming-call UI over the lock screen (WhatsApp-style).
// MUST be registered at the top level so Firebase's headless task can invoke it
// when the app isn't running. iOS rings via CallKit/VoIP and does NOT use
// Firebase messaging (importing here is a harmless JS no-op on iOS; the call is
// Platform-guarded so the native module is never touched on iOS).
if (Platform.OS === 'android') {
  // Required here (not a static import) so Metro never pulls the Firebase
  // messaging module into the iOS bundle's eval path.
  const messaging = require('@react-native-firebase/messaging').default;
  messaging().setBackgroundMessageHandler(async (remoteMessage: { data?: Record<string, string> }) => {
    try {
      const data = remoteMessage?.data || {};
      // Draw via Notifee's fullScreenAction (OS posts a full-screen intent; the
      // app starts NO foreground service). The old full-screen-call lib's
      // startForeground(phoneCall) from this headless context NATIVE-crashed
      // ("KB Chat keeps stopping") on a cold/killed start — Notifee avoids it.
      const {
        showIncomingCallNotification,
        hideIncomingCallNotification,
      } = require('./src/services/incomingCallNotification');
      if (data.type === 'call') {
        // The push carries the caller's info so we render without a network call
        // (we're in a few-second headless budget, possibly offline-ish).
        await showIncomingCallNotification({
          callerId: String(data.callerId || ''),
          callerName: String(data.callerName || 'Unknown'),
          avatar: data.callerAvatar ? String(data.callerAvatar) : undefined,
          callType: data.callType === 'video' ? 'video' : 'voice',
          chatId: String(data.chatId || ''),
        });
      } else if (data.type === 'missed_call') {
        // Caller gave up / ring window expired → take the full-screen UI down.
        await hideIncomingCallNotification();
      }
    } catch (err) {
      console.warn('[fcm-bg] call handler error:', err);
    }
  });
}

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
