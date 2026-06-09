// One-time prompt for the two Android permissions needed to ring the user with a
// FULL-SCREEN call when the phone is locked / the app is closed:
//   1. "Full screen notifications" (Android 14+): without it the call shows as a
//      heads-up banner instead of a full-screen ring. Sideloaded apps (and many
//      Play installs) do NOT get it auto-granted.
//   2. Battery optimization exemption: aggressive OEMs (Samsung/Xiaomi/Oppo/...)
//      won't wake a fully-killed app for a call unless it's exempted.
//
// There's no reliable way to READ these grant states from JS, so we prompt ONCE
// (tracked in MMKV) and send the user straight to the right settings screens.
// ANDROID ONLY — no-op on iOS (which rings via CallKit).

import { Alert, Platform } from 'react-native';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();
const PROMPTED_KEY = 'callPerms.prompted.v1';
const PKG = 'com.kbchat.app';

// Lazy require — keeps the native module off the iOS eval path.
let _il: typeof import('expo-intent-launcher') | null = null;
const il = () => {
  if (!_il) _il = require('expo-intent-launcher');
  return _il!;
};

async function openFullScreenIntentSettings() {
  try {
    // Android 14+ per-app "Use full screen intent" toggle. On older versions the
    // action doesn't exist (full-screen intents are auto-granted) → catch skips it.
    await il().startActivityAsync('android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT', {
      data: `package:${PKG}`,
    });
  } catch { /* noop — pre-Android-14 / unavailable */ }
}

async function openBatterySettings() {
  try {
    // The battery-optimization list (unrestricted intent — no special permission,
    // unlike the restricted REQUEST_IGNORE_BATTERY_OPTIMIZATIONS dialog).
    await il().startActivityAsync('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
  } catch { /* noop */ }
}

async function runSetupFlow() {
  // 1) Full-screen notifications (startActivityAsync resolves when the user
  //    returns from the Settings screen).
  await openFullScreenIntentSettings();
  // 2) Then nudge battery optimization (so killed-app calls ring reliably).
  Alert.alert(
    'One more thing',
    'To ring you even when KB Chat is fully closed, find KB Chat and set it to "Unrestricted" (or "Don\'t optimize") on the next screen.',
    [
      { text: 'Skip', style: 'cancel' },
      { text: 'Open settings', onPress: () => { void openBatterySettings(); } },
    ],
  );
}

/**
 * Show the one-time "ring me for calls" setup prompt (Android only). Safe to call
 * on every login — it only shows once (MMKV-tracked).
 */
export function maybePromptCallPermissions() {
  if (Platform.OS !== 'android') return;
  if (storage.getBoolean(PROMPTED_KEY)) return;
  storage.set(PROMPTED_KEY, true);

  Alert.alert(
    'Ring me for calls',
    'So KB Chat can show a full-screen call when your phone is locked, please turn ON "full screen notifications" on the next screen.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Set up', onPress: () => { void runSetupFlow(); } },
    ],
  );
}
