// Android ongoing-call foreground-service notification (Notifee).
//
// Shows a persistent "Ongoing call" notification while a 1:1 or group call is
// connected — like WhatsApp. The foreground service keeps the call alive when
// the app is backgrounded AND surfaces Android's green microphone indicator
// (the service declares the microphone foreground-service type). ANDROID ONLY;
// every export is a no-op on iOS (which uses its own call UI).

import { Platform, PermissionsAndroid } from 'react-native';
import { getNotifee } from '../utils/nativeModules';

const CHANNEL_ID = 'ongoing_call';
const NOTIF_ID = 'ongoing_call';

// ROOT CAUSE of the 2026-06-08 Samsung/Android-14 crash (FIXED): the foreground
// service was started with the `microphone`/`camera` types, but the app's
// manifest was missing the FOREGROUND_SERVICE_MICROPHONE / FOREGROUND_SERVICE_CAMERA
// permissions those types require on Android 14+. startForeground() then threw a
// SecurityException in Notifee's native code (uncatchable) → hard crash. We also
// dropped the `phoneCall` type (its Telecom prerequisites aren't met by this app).
// Fix: permissions added to app.json + runtime types reduced to microphone(+camera).

let setupDone = false;
let endCallHandler: (() => void) | null = null;

/** The active call registers its hang-up fn so the notification's "End call"
 *  action can terminate the call. */
export const setEndCallHandler = (fn: (() => void) | null) => {
  endCallHandler = fn;
};

const handleEvent = (type: number, actionId: string | undefined, ACTION_PRESS: number) => {
  if (type === ACTION_PRESS && actionId === 'end_call') {
    try { endCallHandler?.(); } catch { /* noop */ }
  }
};

/** Call ONCE at app start (from index.ts). Registers the foreground-service
 *  runner + the action-press handlers. */
export const registerOngoingCallService = () => {
  if (Platform.OS !== 'android' || setupDone) return;
  try {
    const mod = getNotifee();
    const notifee = mod.default;
    const ACTION_PRESS = mod.EventType.ACTION_PRESS;
    // The runner promise never resolves → the service stays alive while the
    // notification is displayed.
    notifee.registerForegroundService(() => new Promise(() => { /* keep alive */ }));
    notifee.onBackgroundEvent(async ({ type, detail }) =>
      handleEvent(type, detail?.pressAction?.id, ACTION_PRESS)
    );
    notifee.onForegroundEvent(({ type, detail }) =>
      handleEvent(type, detail?.pressAction?.id, ACTION_PRESS)
    );
    setupDone = true;
  } catch (err) {
    console.warn('[ongoingCall] register failed:', err);
  }
};

/** Show the persistent ongoing-call notification (call connected). */
export const showOngoingCall = async (opts: { name: string; isVideo: boolean }) => {
  if (Platform.OS !== 'android') return;
  try {
    // Android 14+ throws SecurityException at startForeground() unless the
    // DANGEROUS runtime grant behind each FGS type is actually granted at that
    // moment (RECORD_AUDIO for `microphone`, CAMERA for `camera`) — not just the
    // normal FOREGROUND_SERVICE_* permission. Any connected call already holds
    // the mic grant; if it somehow doesn't, bail rather than crash. Only add the
    // `camera` type when the camera grant is truly present (a "video" call whose
    // camera was denied/disabled would otherwise crash here).
    const micGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
    ).catch(() => false);
    if (!micGranted) return;

    const mod = getNotifee();
    const notifee = mod.default;
    const { AndroidImportance, AndroidForegroundServiceType } = mod;
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Ongoing calls',
      importance: AndroidImportance.LOW, // persistent, no sound / heads-up
    });
    // Only the `microphone` (+ `camera` for video) types — each backed by its
    // FOREGROUND_SERVICE_* permission in app.json. We deliberately omit the
    // `phoneCall` type: its Telecom prerequisites aren't satisfied by this app,
    // and these two already trigger Android's green privacy indicators.
    const types = [
      AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_MICROPHONE,
    ];
    if (opts.isVideo) {
      const camGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.CAMERA
      ).catch(() => false);
      if (camGranted) {
        types.push(AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_CAMERA);
      }
    }
    await notifee.displayNotification({
      id: NOTIF_ID,
      title: opts.isVideo ? 'Ongoing video call' : 'Ongoing voice call',
      body: opts.name ? `${opts.name} · tap to return` : 'Tap to return',
      android: {
        channelId: CHANNEL_ID,
        asForegroundService: true,
        foregroundServiceTypes: types,
        ongoing: true,
        autoCancel: false,
        colorized: true,
        color: '#dc2626',
        smallIcon: 'ic_launcher',
        pressAction: { id: 'default', launchActivity: 'default' },
        actions: [{ title: 'End call', pressAction: { id: 'end_call' } }],
      },
    });
  } catch (err) {
    console.warn('[ongoingCall] show failed:', err);
  }
};

/** Hide the notification + stop the foreground service (call ended). */
export const hideOngoingCall = async () => {
  if (Platform.OS !== 'android') return;
  try {
    await getNotifee().default.stopForegroundService();
  } catch (err) {
    console.warn('[ongoingCall] hide failed:', err);
  }
};
