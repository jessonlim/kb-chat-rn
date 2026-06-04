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
import callkeepService from './callkeepService';
import { getNotifications, getDevice } from '../utils/nativeModules';

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

      // If this is an incoming call notification, suppress the regular
      // notification because the native full-screen call UI handles it.
      if (data?.type === 'incoming_call') {
        callkeepService.showIncomingCall({
          callerId: data.callerId as string,
          callerName: (data.callerName as string) || 'Unknown',
          avatar: data.callerAvatar as string | undefined,
          callType: (data.callType as 'voice' | 'video') || 'voice',
          chatId: data.chatId as string,
        });
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
      return token;
    } catch (err) {
      console.warn('[notifications] Failed to get push token:', err);
      return null;
    }
  },

  /** Register FCM token with the backend */
  async registerToken(token: string) {
    try {
      await api.post('/api/notifications/register-token', { token });
      console.log('[notifications] Token registered with backend');
    } catch (err) {
      console.warn('[notifications] Failed to register token:', err);
    }
  },

  /** Unregister FCM token (call on logout) */
  async unregisterToken() {
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
   * Set up notification tap handler — navigates to the right screen.
   * Returns a cleanup function.
   */
  setupTapHandler(): () => void {
    const subscription = getNotifications().addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;

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
   */
  async handleInitialNotification() {
    const response = await getNotifications().getLastNotificationResponseAsync();
    if (!response) return;

    const data = response.notification.request.content.data;
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
