// Push notification service — FCM via expo-notifications.
// Backend already uses firebase-admin, so we register native FCM tokens directly.

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from './api';
import { navigationRef } from '../navigation/navigationRef';
import callkeepService from './callkeepService';

// ── Foreground notification display ─────────────────────────────────
// Show notifications even when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;

    // If this is an incoming call notification, suppress the regular notification
    // because the native full-screen call UI handles it via callkeepService
    if (data?.type === 'incoming_call') {
      // Show native call screen instead
      callkeepService.showIncomingCall({
        callerId: data.callerId as string,
        callerName: (data.callerName as string) || 'Unknown',
        avatar: data.callerAvatar as string | undefined,
        callType: (data.callType as 'voice' | 'video') || 'voice',
        chatId: data.chatId as string,
      });

      // Don't show the regular notification — the native call UI is enough
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

    // Get native FCM token (not Expo push token — backend uses firebase-admin)
    try {
      const tokenData = await Notifications.getDevicePushTokenAsync();
      const token = tokenData.data as string;
      console.log('[notifications] FCM token obtained');

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
   * Set up notification tap handler — navigates to the right screen.
   * Returns a cleanup function.
   */
  setupTapHandler(): () => void {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;

        if (!navigationRef.isReady()) return;

        // Navigate based on notification data
        if (data?.chatId) {
          (navigationRef as any).navigate('ChatsTab', {
            screen: 'ChatScreen',
            params: { chatId: data.chatId },
          });
        } else if (data?.channelId) {
          (navigationRef as any).navigate('DiscoverTab', {
            screen: 'ChannelDetail',
            params: { channelId: data.channelId },
          });
        }
      }
    );

    return () => subscription.remove();
  },

  /**
   * Handle the notification that launched the app (cold start from tap).
   */
  async handleInitialNotification() {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (!response) return;

    const data = response.notification.request.content.data;
    if (data?.chatId) {
      // Small delay to let navigation mount
      setTimeout(() => {
        if (navigationRef.isReady()) {
          (navigationRef as any).navigate('ChatsTab', {
            screen: 'ChatScreen',
            params: { chatId: data.chatId },
          });
        }
      }, 1000);
    }
  },
};

export default notificationService;
