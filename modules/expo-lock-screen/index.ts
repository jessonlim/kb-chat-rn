import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

interface ExpoLockScreenNativeModule {
  isLocked(): boolean;
  setShowWhenLocked(value: boolean): void;
  dropBehindKeyguardIfLocked(): void;
}

// Only Android implements this module. Guard the native require so importing
// this file on iOS (or web) never throws — the methods become safe no-ops.
const nativeModule: ExpoLockScreenNativeModule | null =
  Platform.OS === 'android'
    ? requireNativeModule<ExpoLockScreenNativeModule>('ExpoLockScreen')
    : null;

/**
 * Returns true when the device is currently locked (keyguard showing).
 * Always returns false on iOS/web. Diagnostic helper only — for the
 * call-end behaviour use dropBehindKeyguardIfLocked(), which evaluates the
 * keyguard atomically with the action on the UI thread.
 */
export function isLocked(): boolean {
  if (!nativeModule) return false;
  return nativeModule.isLocked();
}

/**
 * If the device is currently locked, drop the app behind the keyguard
 * (reveals the lock screen, keeps the Activity/process alive). No-op when
 * the device is unlocked, and on iOS/web. The keyguard check + the action
 * run together natively on the UI thread, so there is no JS-side race and a
 * user who answered-while-locked then unlocked mid-call is NOT demoted.
 */
export function dropBehindKeyguardIfLocked(): void {
  if (!nativeModule) return;
  nativeModule.dropBehindKeyguardIfLocked();
}

/**
 * Re-enable (true) or clear (false) the current Activity's show-over-lock-screen
 * flags. Call with `true` when an incoming call is shown so a back-to-back
 * BACKGROUNDED call can still ring full-screen over the keyguard (the prior
 * call's dropBehindKeyguardIfLocked clears the flags on the live Activity).
 * No-op on iOS/web and when there's no current Activity (cold/killed start).
 */
export function setShowWhenLocked(value: boolean): void {
  if (!nativeModule) return;
  nativeModule.setShowWhenLocked(value);
}

export default { isLocked, setShowWhenLocked, dropBehindKeyguardIfLocked };
