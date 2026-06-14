// Push notification service — FCM via expo-notifications.
// Backend already uses firebase-admin, so we register native FCM tokens directly.
//
// Native modules (expo-notifications, expo-device) are loaded lazily via
// getNotifications()/getDevice() (audit M4) so they don't resolve at app
// launch. The foreground-display handler that used to run as a top-level
// side-effect now lives in configureHandler(), called once from init().

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import api from './api';
import { navigationRef } from '../navigation/navigationRef';
import { getNotifications, getDevice, getNotifee } from '../utils/nativeModules';
import { promptWebLoginApproval } from './webLoginApproval';

// ── Android FCM via @react-native-firebase ──────────────────────────
// On Android, expo-notifications' own Firebase service is stripped (by
// expo-callkit-telecom's config plugin, which sets tools:node="remove" on it),
// and our withRemoveCallKitTelecomAndroidFcm plugin strips callkit-telecom's
// service too — so @react-native-firebase is the SOLE FCM handler. That means:
//   • Backgrounded/killed CHAT notifications (notification-type messages) are
//     still drawn by the OS automatically — no handler needed.
//   • FOREGROUND display must be done by us (RNFirebase doesn't auto-display) →
//     we draw it with Notifee (see setupAndroidForegroundFcm).
//   • TAP navigation moves to messaging().onNotificationOpenedApp /
//     getInitialNotification (see setupTapHandler / handleInitialNotification).
// iOS is UNCHANGED — it never uses RNFirebase (no GoogleService-Info.plist yet);
// it keeps the expo-notifications path. Everything here is Platform-guarded so
// the Firebase native module is never touched on iOS.
let getMessaging: (() => any) | null = null;
const messaging = () => {
  if (!getMessaging) getMessaging = require('@react-native-firebase/messaging').default;
  return getMessaging!();
};

// Call-type pushes are handled by the call UI / socket — never draw them as a
// plain chat banner.
const isCallData = (type?: string) =>
  type === 'call' || type === 'group_call' || type === 'incoming_call' || type === 'missed_call';

let androidFcmUnsub: (() => void) | null = null;

// ── Foreground notification display ─────────────────────────────────
// Registers the handler that decides how a notification renders while the
// app is foregrounded. Previously a top-level side-effect (ran at import,
// i.e. app launch, eagerly pulling in expo-notifications). Now called from
// init() so the native module only resolves when push is set up. Guarded +
// idempotent.
let handlerConfigured = false;
const configureHandler = () => {
  if (handlerConfigured) return;
  handlerConfigured = true;
  getNotifications().setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data;

      // Incoming-call pushes — 1:1 ('call'), group ('group_call'), or legacy
      // ('incoming_call'). This display handler only runs while the app is in
      // the FOREGROUND, where the in-app call UI already shows the ring, so
      // suppress the duplicate push banner entirely. (Backgrounded pushes are
      // shown by the OS and open the app when tapped.) The backend sends type
      // 'call' / 'group_call'; matching only 'incoming_call' here was the bug
      // that let the banner show on top of the in-app call screen.
      if (
        data?.type === 'call' ||
        data?.type === 'group_call' ||
        data?.type === 'incoming_call' ||
        // Web-login approval in the foreground is shown by the socket-driven
        // in-app dialog (authStore) — suppress the duplicate banner here.
        data?.type === 'web_login_approval'
      ) {
        return {
          shouldShowAlert: false,
          shouldShowBanner: false,
          shouldShowList: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
        };
      }

      // For all other notifications, show normally
      return {
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      };
    },
  });
};

// ── Stored token for cleanup on logout ──────────────────────────────
let currentToken: string | null = null;

const notificationService = {
  /**
   * Initialize push notifications:
   * 1. Create Android notification channels
   * 2. Request permission
   * 3. Get native FCM token
   * 4. Register token with backend
   */
  async init(): Promise<string | null> {
    // Register the foreground-display handler now that push is being set
    // up (was previously a top-level side-effect — see configureHandler).
    configureHandler();

    const Notifications = getNotifications();
    const Device = getDevice();

    if (!Device.isDevice) {
      console.log('[notifications] Must use a physical device');
      return null;
    }

    // Create Android notification channels (matches backend channelId values)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        description: 'Chat message notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
        enableLights: true,
        lightColor: '#dc2626',
      });

      await Notifications.setNotificationChannelAsync('calls_v2', {
        name: 'Calls',
        description: 'Incoming call notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 500, 500, 500, 500],
        sound: 'default',
        enableLights: true,
        lightColor: '#dc2626',
      });
    }

    // Request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[notifications] Permission not granted');
      return null;
    }

    // Acquire a push token, platform-split:
    //   • Android → native FCM device token. Backend sends via firebase-admin.
    //   • iOS     → Expo push token. The native iOS device token is a raw
    //     APNs token our FCM backend can't address, so on iOS we register an
    //     Expo push token instead; the backend delivers those through Expo's
    //     push service (which talks to APNs using the key EAS manages).
    // The backend tells the two apart by token format, so they coexist.
    try {
      let token: string;
      if (Platform.OS === 'ios') {
        const projectId =
          (Constants.expoConfig?.extra as any)?.eas?.projectId ||
          (Constants as any)?.easConfig?.projectId;
        const tokenData = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        token = tokenData.data;
        console.log('[notifications] Expo push token obtained (iOS)');
      } else {
        const tokenData = await Notifications.getDevicePushTokenAsync();
        token = tokenData.data as string;
        console.log('[notifications] FCM device token obtained (Android)');
      }

      // Register with backend
      await this.registerToken(token);
      currentToken = token;
      // Android: RNFirebase owns the FCM pipeline now, so draw foreground
      // notifications + handle their taps ourselves (iOS keeps the expo path).
      if (Platform.OS === 'android' && !androidFcmUnsub) {
        androidFcmUnsub = this.setupAndroidForegroundFcm();
      }
      return token;
    } catch (err) {
      console.warn('[notifications] Failed to get push token:', err);
      return null;
    }
  },

  /** Register FCM token with the backend */
  async registerToken(token: string) {
    try {
      await api.post('/api/notifications/register-token', {
        token,
        // Android builds ship the @react-native-firebase background handler, so
        // they can receive the DATA-ONLY call push that draws the full-screen
        // lock-screen ring. The backend gates on this flag: call-capable tokens
        // get data-only, everyone else gets the legacy notification-block push.
        // (This Android FCM device token is the same one Firebase messaging
        // listens on, so the background handler will receive these pushes.)
        callCapable: Platform.OS === 'android',
      });
      console.log('[notifications] Token registered with backend');
    } catch (err) {
      console.warn('[notifications] Failed to register token:', err);
    }
  },

  /** Unregister FCM token (call on logout) */
  async unregisterToken() {
    // Tear down the Android foreground-FCM subscriptions so a re-login re-arms
    // them cleanly (and we don't double-draw).
    if (androidFcmUnsub) {
      try { androidFcmUnsub(); } catch { /* noop */ }
      androidFcmUnsub = null;
    }
    if (!currentToken) return;
    try {
      await api.post('/api/notifications/unregister-token', { token: currentToken });
      console.log('[notifications] Token unregistered');
      currentToken = null;
    } catch (err) {
      console.warn('[notifications] Failed to unregister token:', err);
    }
  },

  /**
   * Navigate from a notification tap. Defensive about chat existence —
   * if the user got kicked from a group / blocked / chat was deleted
   * between the push fanning out and the tap landing, we'd otherwise
   * deep-link into a chat that fails to load. ChatScreen's load handler
   * already toasts + goBacks on 403/404, so the fallback path here is
   * to land on the chat LIST first so goBack has somewhere sane to go.
   *
   * Wrapped in try/catch because navigationRef.navigate can throw if
   * the route name doesn't match the current navigator (rare, but
   * happens during a navigator swap mid-cold-start).
   */
  _navigateToChat(chatId: string) {
    try {
      // Navigate into the tab first so the back stack is ChatList →
      // ChatScreen. If ChatScreen's M7 goBack fires (chat unavailable),
      // user lands on the chat list which is the safe fallback.
      (navigationRef as any).navigate('ChatsTab', {
        screen: 'ChatScreen',
        params: { chatId },
      });
    } catch (err) {
      console.warn('[notifications] navigate to chat failed:', err);
      // Last-resort fallback: jump to the chat list root
      try {
        (navigationRef as any).navigate('ChatsTab');
      } catch (err2) {
        console.warn('[notifications] navigate to ChatsTab failed:', err2);
      }
    }
  },

  /**
   * Android only: draw FOREGROUND chat notifications (RNFirebase doesn't
   * auto-display foreground messages) and navigate when one is tapped.
   * Backgrounded/killed chat notifications are drawn by the OS and their taps
   * are handled by setupTapHandler's onNotificationOpenedApp. Returns a cleanup.
   */
  setupAndroidForegroundFcm(): () => void {
    if (Platform.OS !== 'android') return () => {};
    const unsubMessage = messaging().onMessage(async (msg: any) => {
      const data = msg?.data || {};
      // A missed/cancelled call MUST dismiss the full-screen ring even in the
      // foreground. The full-screen intent launches the app to the foreground, and
      // the `call_ended` socket event can be lost if it fires before the socket
      // reconnects — so the data-only missed_call push is the reliable backstop
      // that stops a ring left hanging after the caller hung up.
      if (data.type === 'missed_call') {
        try {
          const { hideIncomingCallNotification } = require('./incomingCallNotification');
          await hideIncomingCallNotification();
        } catch { /* noop */ }
        return;
      }
      if (isCallData(data.type)) return; // other call types handled by socket / full-screen UI
      // Web-login approval in the FOREGROUND is handled by the socket event
      // (authStore) which shows the in-app dialog — don't also draw a banner.
      if (data.type === 'web_login_approval') return;
      try {
        const notifeeMod = getNotifee();
        await notifeeMod.default.displayNotification({
          title: msg.notification?.title || data.title || 'KB Chat',
          body: msg.notification?.body || data.body || '',
          data,
          android: {
            channelId: 'messages',
            smallIcon: 'notification_icon',
            pressAction: { id: 'open_chat', launchActivity: 'default' },
          },
        });
      } catch (err) {
        console.warn('[fcm] foreground display failed:', err);
      }
    });
    // NOTE: the tap on the foreground banner is NOT handled with our own
    // notifee.onForegroundEvent here — Notifee keeps only ONE foreground-event
    // registration, and ongoingCallService already owns it. That single handler
    // calls handleNotifeePress() (below) for chat/channel presses.
    return () => {
      try { unsubMessage(); } catch { /* noop */ }
    };
  },

  /** Navigate when a Notifee-drawn chat/channel notification is pressed. Invoked
   *  by the app's single notifee event handler (in ongoingCallService). */
  handleNotifeePress(data: any) {
    if (!data) return;
    if (data.type === 'web_login_approval') { promptWebLoginApproval(data.token); return; }
    if (!navigationRef.isReady()) return;
    if (data.chatId) {
      this._navigateToChat(String(data.chatId));
    } else if (data.channelId) {
      try {
        (navigationRef as any).navigate('DiscoverTab', {
          screen: 'ChannelDetail',
          params: { channelId: data.channelId },
        });
      } catch (err) {
        console.warn('[notifications] navigate to channel failed:', err);
      }
    }
  },

  /**
   * Set up notification tap handler — navigates to the right screen.
   * Returns a cleanup function. Android taps come through RNFirebase
   * (onNotificationOpenedApp); iOS keeps the expo-notifications listener.
   */
  setupTapHandler(): () => void {
    if (Platform.OS === 'android') {
      const unsub = messaging().onNotificationOpenedApp((msg: any) => {
        const data = msg?.data;
        if (data?.type === 'web_login_approval') { promptWebLoginApproval(data.token); return; }
        if (!data || !navigationRef.isReady()) return;
        if (data.chatId) {
          this._navigateToChat(String(data.chatId));
        } else if (data.channelId) {
          try {
            (navigationRef as any).navigate('DiscoverTab', {
              screen: 'ChannelDetail',
              params: { channelId: data.channelId },
            });
          } catch (err) {
            console.warn('[notifications] navigate to channel failed:', err);
          }
        }
      });
      return () => { try { unsub(); } catch { /* noop */ } };
    }

    const subscription = getNotifications().addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;

        if (data?.type === 'web_login_approval') { promptWebLoginApproval(data.token as string); return; }
        if (!navigationRef.isReady()) return;

        if (data?.chatId) {
          this._navigateToChat(data.chatId as string);
        } else if (data?.channelId) {
          try {
            (navigationRef as any).navigate('DiscoverTab', {
              screen: 'ChannelDetail',
              params: { channelId: data.channelId },
            });
          } catch (err) {
            console.warn('[notifications] navigate to channel failed:', err);
          }
        }
      }
    );

    return () => subscription.remove();
  },

  /**
   * Handle the notification that launched the app (cold start from tap).
   * Android: RNFirebase getInitialNotification; iOS: expo getLastNotificationResponse.
   */
  async handleInitialNotification() {
    if (Platform.OS === 'android') {
      const msg = await messaging().getInitialNotification();
      const data = msg?.data;
      if (data?.type === 'web_login_approval') {
        setTimeout(() => promptWebLoginApproval(data.token), 1200);
        return;
      }
      if (data?.chatId) {
        setTimeout(() => {
          if (navigationRef.isReady()) this._navigateToChat(String(data.chatId));
        }, 1000);
      }
      return;
    }

    const response = await getNotifications().getLastNotificationResponseAsync();
    if (!response) return;

    const data = response.notification.request.content.data;
    if (data?.type === 'web_login_approval') {
      setTimeout(() => promptWebLoginApproval(data.token as string), 1200);
      return;
    }
    if (data?.chatId) {
      // Small delay to let navigation mount
      setTimeout(() => {
        if (navigationRef.isReady()) {
          this._navigateToChat(data.chatId as string);
        }
      }, 1000);
    }
  },
};

export default notificationService;
