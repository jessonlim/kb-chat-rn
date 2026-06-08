// Android ongoing-call foreground-service notification (Notifee).
//
// Shows a persistent "Ongoing call" notification while a 1:1 or group call is
// connected — like WhatsApp. The foreground service keeps the call alive when
// the app is backgrounded AND surfaces Android's green microphone indicator
// (the service declares the microphone foreground-service type). ANDROID ONLY;
// every export is a no-op on iOS (which uses its own call UI).
//
// OWNERSHIP: there is ONE notification + ONE end-call handler, but BOTH the 1:1
// call context and the group call context drive it. To stop one context from
// tearing down the other's call, every show/hide is tagged with a `source`
// ('direct' | 'group'). A hide from a context that doesn't currently own the
// notification is ignored — this is what previously nulled the group call's
// "End call" handler (the 1:1 context's idle effect re-firing mid-group-call).

import { Platform, PermissionsAndroid } from 'react-native';
import { getNotifee } from '../utils/nativeModules';

const CHANNEL_ID = 'ongoing_call';
const NOTIF_ID = 'ongoing_call';

export type CallSource = 'direct' | 'group';

// ROOT CAUSE of the 2026-06-08 Samsung/Android-14 crash (FIXED): the foreground
// service was started with the `microphone`/`camera` types, but the app's
// manifest was missing the FOREGROUND_SERVICE_MICROPHONE / FOREGROUND_SERVICE_CAMERA
// permissions those types require on Android 14+. startForeground() then threw a
// SecurityException in Notifee's native code (uncatchable) → hard crash. We also
// dropped the `phoneCall` type (its Telecom prerequisites aren't met by this app).
// Fix: permissions added to app.json + runtime types reduced to microphone(+camera).

let setupDone = false;
let endCallHandler: (() => void) | null = null;
// Which call context currently owns the notification (null = nothing shown).
let activeSource: CallSource | null = null;
// Monotonic token bumped on every show-start AND every hide. showOngoingCall is
// async (awaits permission checks + channel + displayNotification); if a hide (or
// a newer show) lands while a show is parked on an await, the token diverges and
// the stale show aborts before painting an orphaned notification. This closes the
// show-after-hide race that otherwise strands the notification on a failed call.
let showToken = 0;

/** The active call registers its hang-up fn so the notification's "End call"
 *  action can terminate the call. */
export const setEndCallHandler = (fn: (() => void) | null) => {
  endCallHandler = fn;
};

// THE app's single Notifee event handler. Notifee keeps only the LAST
// onBackgroundEvent/onForegroundEvent registration, so BOTH the ongoing-call
// "End call" action AND the incoming-call answer/decline route through here,
// dispatched by data.type / pressAction.id. (Registering a second handler
// anywhere would silently break whichever registered first.)
const handleEvent = async (type: number, detail: any, EventType: any) => {
  const actionId: string | undefined = detail?.pressAction?.id;
  const dataType: string | undefined = detail?.notification?.data?.type;

  // Ongoing-call "End call" action.
  if (type === EventType.ACTION_PRESS && actionId === 'end_call') {
    // End the live call (if a handler is registered)…
    try { endCallHandler?.(); } catch { /* noop */ }
    // …and ALWAYS force the notification down as a fallback, so a stale/orphaned
    // notification (call already ended, handler gone) is still dismissable.
    try { await hideOngoingCall(); } catch { /* noop */ }
    return;
  }

  // Incoming-call notification (answer / decline / tap-to-open) — delegate to
  // the incoming-call service (it persists the choice for CallContext to act on
  // once the app launches + the socket reconnects).
  if (dataType === 'incoming_call') {
    try {
      const { handleIncomingCallNotifeeEvent } = require('./incomingCallNotification');
      await handleIncomingCallNotifeeEvent(
        type,
        actionId,
        detail?.notification?.data,
        EventType.ACTION_PRESS,
        EventType.PRESS
      );
    } catch (err) {
      console.warn('[notifee] incoming-call event failed:', err);
    }
    return;
  }

  // Foreground chat / channel notification (drawn by notificationService) pressed
  // → navigate. Routed here because notifee allows only one onForegroundEvent.
  const data = detail?.notification?.data;
  if (type === EventType.PRESS && (data?.chatId || data?.channelId)) {
    try {
      require('./notificationService').default.handleNotifeePress(data);
    } catch (err) {
      console.warn('[notifee] chat press nav failed:', err);
    }
  }
};

/** Call ONCE at app start (from index.ts). Registers the foreground-service
 *  runner + the action-press handlers. */
export const registerOngoingCallService = () => {
  if (Platform.OS !== 'android' || setupDone) return;
  try {
    const mod = getNotifee();
    const notifee = mod.default;
    const EventType = mod.EventType;
    // The runner promise never resolves → the service stays alive while the
    // notification is displayed.
    notifee.registerForegroundService(() => new Promise(() => { /* keep alive */ }));
    notifee.onBackgroundEvent(async ({ type, detail }) => handleEvent(type, detail, EventType));
    notifee.onForegroundEvent(({ type, detail }) => {
      void handleEvent(type, detail, EventType);
    });
    setupDone = true;
  } catch (err) {
    console.warn('[ongoingCall] register failed:', err);
  }
};

/** Show the persistent ongoing-call notification (call connected). */
export const showOngoingCall = async (opts: {
  name: string;
  isVideo: boolean;
  source: CallSource;
}) => {
  if (Platform.OS !== 'android') return;
  // Claim ownership SYNCHRONOUSLY (before any await) so a concurrent hide can see
  // + invalidate this in-flight show. `myToken` lets us detect being superseded.
  const myToken = ++showToken;
  activeSource = opts.source;
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
    if (!micGranted) {
      if (myToken === showToken) activeSource = null; // release the claim we took
      return;
    }
    if (myToken !== showToken) return; // a hide / newer show superseded us

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
    if (myToken !== showToken) return; // superseded while resolving permissions

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

    // Self-heal: if a hide landed DURING displayNotification's await (activeSource
    // nulled, token bumped), the call is already gone → tear down the orphan now.
    if (myToken !== showToken && activeSource === null) {
      try { await notifee.stopForegroundService(); } catch { /* noop */ }
      try { await notifee.cancelNotification(NOTIF_ID); } catch { /* noop */ }
    }
  } catch (err) {
    console.warn('[ongoingCall] show failed:', err);
  }
};

/**
 * Hide the notification + stop the foreground service (call ended).
 *
 * @param source If given, the hide is IGNORED unless this source currently owns
 *   the notification — so the 1:1 context's idle effect can't kill a group call
 *   (and vice-versa). Omit `source` to force the hide (used by the "End call"
 *   action fallback and any hard teardown).
 */
export const hideOngoingCall = async (source?: CallSource) => {
  if (Platform.OS !== 'android') return;
  // Stale cross-context hide: a different call owns the notification → ignore.
  if (source && activeSource !== null && activeSource !== source) return;
  showToken++; // invalidate any in-flight showOngoingCall parked on an await
  activeSource = null;
  endCallHandler = null;
  const notifee = getNotifee().default;
  // stopForegroundService() detaches the service; cancelNotification() then
  // removes the (ongoing) notification, which stopForegroundService alone does
  // NOT reliably do — that lingering notification was the "still there after the
  // call ended" bug.
  try { await notifee.stopForegroundService(); } catch { /* noop */ }
  try { await notifee.cancelNotification(NOTIF_ID); } catch { /* noop */ }
};
