// CallKeep service — shows native full-screen incoming call notification on Android.
// Uses react-native-full-screen-notification-incoming-call to display
// Accept/Decline buttons on the lock screen when someone calls.

import { Platform } from 'react-native';
import type { AnswerPayload, DeclinePayload } from 'react-native-full-screen-notification-incoming-call';
import { getCallNotification } from '../utils/nativeModules';

// Lazy accessor (audit M4) — resolves the native module only when a
// call notification is actually shown, not at app launch. `import type`
// above keeps the payload types without triggering native resolution.

// ── Types ──────────────────────────────────────────────────────────
interface IncomingCallInfo {
  callerId: string;
  callerName: string;
  avatar?: string;
  callType: 'voice' | 'video';
  chatId: string;
}

// ── State ──────────────────────────────────────────────────────────
let currentCallUUID: string | null = null;
let pendingCallInfo: IncomingCallInfo | null = null;

const callkeepService = {
  /**
   * Show native full-screen incoming call notification.
   * This wakes the screen and shows Answer/Decline buttons over the lock screen.
   */
  showIncomingCall(info: IncomingCallInfo) {
    if (Platform.OS !== 'android') return;

    // Create a unique ID for this call
    const uuid = `${info.callerId}_${Date.now()}`;
    currentCallUUID = uuid;
    pendingCallInfo = info;

    const isVideo = info.callType === 'video';
    const callLabel = isVideo ? 'Video Call' : 'Voice Call';

    getCallNotification().displayNotification(
      uuid,
      info.avatar || null,
      50000, // 50s timeout (matches our call timeout)
      {
        channelId: 'calls_v2',
        channelName: 'Calls',
        notificationIcon: 'ic_launcher',
        notificationTitle: info.callerName,
        notificationBody: `Incoming ${callLabel}`,
        answerText: 'Answer',
        declineText: 'Decline',
        notificationColor: '#dc2626',
        isVideo,
        // Store call info in payload so we can retrieve it on answer/decline
        payload: JSON.stringify({
          callerId: info.callerId,
          chatId: info.chatId,
          callType: info.callType,
        }),
      },
    );

    console.log('[callkeep] Showing incoming call notification:', info.callerName);
  },

  /**
   * Hide the incoming call notification (call was answered, rejected, or ended).
   */
  hideIncomingCall() {
    if (Platform.OS !== 'android') return;

    getCallNotification().hideNotification();
    currentCallUUID = null;
    pendingCallInfo = null;
    console.log('[callkeep] Hiding notification');
  },

  /**
   * Set up listeners for when user taps Answer or Decline on the native notification.
   * Returns a cleanup function to remove the listeners.
   *
   * @param onAnswer - Called when user taps Accept
   * @param onDecline - Called when user taps Decline (or notification times out)
   */
  setupListeners(
    onAnswer: (info: IncomingCallInfo | null) => void,
    onDecline: (info: IncomingCallInfo | null, timedOut: boolean) => void,
  ): () => void {
    if (Platform.OS !== 'android') return () => {};

    const RNNotificationCall = getCallNotification();

    // User tapped Answer
    RNNotificationCall.addEventListener('answer', (payload: AnswerPayload) => {
      console.log('[callkeep] User answered via notification');

      let info = pendingCallInfo;

      // Try to get info from payload if pendingCallInfo is gone (app was backgrounded)
      if (!info && payload.payload) {
        try {
          const parsed = JSON.parse(payload.payload);
          info = {
            callerId: parsed.callerId,
            callerName: 'Unknown',
            callType: parsed.callType || 'voice',
            chatId: parsed.chatId,
          };
        } catch {}
      }

      // Bring app to foreground
      RNNotificationCall.backToApp();

      onAnswer(info);

      // Clean up state
      currentCallUUID = null;
      pendingCallInfo = null;
    });

    // User tapped Decline (or notification timed out)
    RNNotificationCall.addEventListener('endCall', (payload: AnswerPayload | DeclinePayload) => {
      const declinePayload = payload as DeclinePayload;
      const timedOut = declinePayload.endAction === 'ACTION_HIDE_CALL';
      console.log('[callkeep] User declined via notification, timedOut:', timedOut);

      let info = pendingCallInfo;

      if (!info && payload.payload) {
        try {
          const parsed = JSON.parse(payload.payload);
          info = {
            callerId: parsed.callerId,
            callerName: 'Unknown',
            callType: parsed.callType || 'voice',
            chatId: parsed.chatId,
          };
        } catch {}
      }

      onDecline(info, timedOut);

      // Clean up state
      currentCallUUID = null;
      pendingCallInfo = null;
    });

    // Return cleanup function
    return () => {
      RNNotificationCall.removeEventListener('answer');
      RNNotificationCall.removeEventListener('endCall');
    };
  },

  /** Check if a call notification is currently showing */
  isShowing(): boolean {
    return currentCallUUID !== null;
  },

  /** Get the pending call info (for when app wakes from background) */
  getPendingCallInfo(): IncomingCallInfo | null {
    return pendingCallInfo;
  },
};

export default callkeepService;
