import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

interface ExpoLockScreenNativeModule {
  isLocked(): boolean;
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

export default { isLocked, dropBehindKeyguardIfLocked };
