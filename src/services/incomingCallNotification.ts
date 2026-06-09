// Notifee-based incoming-call notification (ANDROID only).
//
// Replaces react-native-full-screen-notification-incoming-call for the
// background/killed incoming-call path. That library's native code does
// startForeground(..., FOREGROUND_SERVICE_TYPE_PHONE_CALL) from the headless
// FCM handler, which on Android 12+ throws an UNCATCHABLE native
// ForegroundServiceStartNotAllowedException from a cold/killed start →
// "KB Chat keeps stopping". Notifee's `fullScreenAction` instead posts a
// full-screen-intent via a PendingIntent — the OS launches the activity and the
// app starts NO foreground service, sidestepping the crashing rule (notifee #470).
//
// State that must survive the headless-task → foreground-app handoff (two
// SEPARATE JS runtimes) lives in MMKV, never in module-level vars.

import { Platform } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import { getNotifee, getLockScreen } from '../utils/nativeModules';

// Default MMKV instance — same underlying store as `storage` in api.ts. Using a
// fresh handle here avoids importing api.ts (axios etc.) into the headless path.
const storage = new MMKV();

const CHANNEL_ID = 'calls_v2';
const NOTIF_ID = 'incoming_call';
const PENDING_KEY = 'call.pendingAction.v1';
const SHOWN_KEY = 'call.shown.v1';
const DEDUP_MS = 8000;
const PENDING_TTL_MS = 60000;

export interface IncomingCallData {
  callerId: string;
  callerName: string;
  avatar?: string;
  callType: 'voice' | 'video';
  chatId: string;
}

/** Show the full-screen incoming-call notification (no foreground service). */
export async function showIncomingCallNotification(info: IncomingCallData) {
  if (Platform.OS !== 'android') return;
  // Re-enable lock-screen visibility on the live Activity (if any). A prior
  // call's end cleared it; without this, a back-to-back BACKGROUNDED call would
  // ring as a heads-up, not full-screen, because the same Activity instance is
  // reused with the flag off. No-op on a cold/killed start (static manifest flag).
  try { getLockScreen().setShowWhenLocked(true); } catch { /* noop */ }
  // Cross-context de-dupe: the FCM bg handler (headless ctx) AND the live-socket
  // onIncomingCall (foreground ctx) can both fire for the same call. They're
  // separate JS runtimes, so an in-memory guard can't see across them — use MMKV.
  try {
    const prev = storage.getString(SHOWN_KEY);
    if (prev) {
      const p = JSON.parse(prev);
      if (p.callerId === info.callerId && Date.now() - p.ts < DEDUP_MS) return;
    }
    storage.set(SHOWN_KEY, JSON.stringify({ callerId: info.callerId, ts: Date.now() }));
  } catch { /* noop */ }

  try {
    const mod = getNotifee();
    const notifee = mod.default;
    const { AndroidImportance, AndroidCategory, AndroidVisibility } = mod;
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: 'Calls',
      importance: AndroidImportance.HIGH, // required for the full-screen intent to fire
      vibration: true,
    });
    const label = info.callType === 'video' ? 'Video Call' : 'Voice Call';
    await notifee.displayNotification({
      id: NOTIF_ID,
      title: info.callerName || 'Incoming call',
      body: `Incoming ${label}`,
      data: {
        type: 'incoming_call',
        callerId: String(info.callerId || ''),
        callerName: String(info.callerName || ''),
        chatId: String(info.chatId || ''),
        callType: info.callType,
      },
      android: {
        channelId: CHANNEL_ID,
        category: AndroidCategory.CALL,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        smallIcon: 'ic_launcher',
        color: '#dc2626',
        timeoutAfter: 50000, // auto-dismiss to match the 50s ring window
        ongoing: true,
        autoCancel: false,
        // OS launches the DEFAULT activity via PendingIntent — app starts NO
        // service. This is the crash-avoidance pivot (no asForegroundService).
        fullScreenAction: { id: 'default', launchActivity: 'default' },
        pressAction: { id: 'default', launchActivity: 'default' },
        actions: [
          { title: 'Answer', pressAction: { id: 'answer', launchActivity: 'default' } },
          { title: 'Decline', pressAction: { id: 'decline' } },
        ],
      },
    });
  } catch (err) {
    // Degrade, never crash. Report so we can see if the full-screen intent is
    // being denied in the wild (Android 14 special-access permission).
    try { require('./sentry').reportError(err, { where: 'showIncomingCallNotification' }); } catch { /* noop */ }
    console.warn('[incomingCall] notifee display failed:', err);
  }
}

/** Cancel the incoming-call notification (answered / declined / ended / missed). */
export async function hideIncomingCallNotification() {
  if (Platform.OS !== 'android') return;
  try { storage.delete(SHOWN_KEY); } catch { /* noop */ }
  try { await getNotifee().default.cancelNotification(NOTIF_ID); } catch { /* noop */ }
}

// ── Pending answer/decline action (survives headless → foreground handoff) ──
function setPendingCallAction(action: 'answer' | 'decline', data: { callerId?: string; chatId?: string }) {
  try {
    storage.set(
      PENDING_KEY,
      JSON.stringify({ action, callerId: data?.callerId || '', chatId: data?.chatId || '', ts: Date.now() })
    );
  } catch { /* noop */ }
}

/** Read + CLEAR the pending call action (only if fresh). Returns null if none. */
export function consumePendingCallAction(): { action: 'answer' | 'decline'; callerId: string } | null {
  try {
    const raw = storage.getString(PENDING_KEY);
    if (!raw) return null;
    storage.delete(PENDING_KEY);
    const p = JSON.parse(raw);
    if (Date.now() - p.ts > PENDING_TTL_MS) return null;
    if (p.action !== 'answer' && p.action !== 'decline') return null;
    return { action: p.action, callerId: p.callerId };
  } catch {
    return null;
  }
}

/**
 * Handle a Notifee event for the INCOMING-CALL notification. Called from the
 * single shared Notifee event handler in ongoingCallService (Notifee keeps only
 * ONE onBackgroundEvent/onForegroundEvent registration — we must not add a 2nd).
 * Persists the user's choice so CallContext acts once the app launches + the
 * socket reconnects (the launchActivity on Answer/press brings the app up).
 */
export async function handleIncomingCallNotifeeEvent(
  type: number,
  actionId: string | undefined,
  data: { callerId?: string; chatId?: string } | undefined,
  ACTION_PRESS: number,
  PRESS: number
) {
  const info = data || {};
  if (type === ACTION_PRESS && actionId === 'answer') {
    // ONLY the "Answer" button auto-accepts.
    setPendingCallAction('answer', info);
    await hideIncomingCallNotification();
  } else if (type === ACTION_PRESS && actionId === 'decline') {
    setPendingCallAction('decline', info);
    await hideIncomingCallNotification();
  } else if (type === PRESS) {
    // Tapping the notification BODY just opens the app (launchActivity does
    // that) → the in-app ringing screen shows and the user answers there.
    // Do NOT auto-answer on a body tap.
    await hideIncomingCallNotification();
  }
}
