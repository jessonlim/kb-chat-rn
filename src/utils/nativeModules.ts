// Lazy, fault-tolerant native-module loading (audit M4).
//
// THE PROBLEM
//   A top-level `import x from 'some-native-module'` resolves that
//   native module at MODULE-EVALUATION time. For any file in the app's
//   launch path — the call contexts wrap the whole app, the call
//   overlays render at the root, and MainTabs eager-imports every
//   screen — "module-evaluation time" is effectively app startup.
//
//   If a native module is ever missing (a future OTA update references
//   a native dependency that isn't in the installed APK yet) or throws
//   during its own init, that eager import crashes the ENTIRE app at
//   launch with an unrecoverable white screen. We already lost an APK
//   to exactly this once (expo-contacts).
//
// THE FIX
//   Load native modules lazily — `require()` inside a getter, the first
//   time the feature is actually used. Benefits:
//     1. Fault isolation: a broken/missing native module breaks only
//        its own feature (calls, QR, location…), not the whole app.
//     2. Future-proofing: the JS bundle boots even on an APK that
//        predates a newly-added native module — the crash, if any, is
//        deferred to when the user opens that specific feature.
//     3. Convention: new native modules added later should be accessed
//        through getters like these, never top-level-imported into a
//        launch-path file.
//
//   Types are imported with `import type` (erased at compile time — no
//   runtime resolution), so call sites keep full type-safety while the
//   actual `require()` is deferred.
//
// SINGLE-PROCESS NOTE
//   The cached refs below live in module memory — fine for a mobile app
//   (one JS runtime). N/A concern for the backend.

import type * as WebRTCType from '@livekit/react-native-webrtc';
import type InCallManagerType from 'react-native-incall-manager';
import type * as LiveKitClientType from 'livekit-client';
import type * as LiveKitRNType from '@livekit/react-native';
import type * as CallNotificationType from 'react-native-full-screen-notification-incoming-call';
import type * as NotificationsType from 'expo-notifications';
import type * as DeviceType from 'expo-device';
import type * as LocationType from 'expo-location';
import type * as CallKitType from 'expo-callkit-telecom';

// ── @livekit/react-native-webrtc (1:1 calls — RTCPeerConnection etc.) ──
let _webrtc: typeof WebRTCType | undefined;
export const getWebRTC = (): typeof WebRTCType => {
  if (!_webrtc) _webrtc = require('@livekit/react-native-webrtc');
  return _webrtc!;
};

// ── react-native-incall-manager (audio routing, ringtone) ─────────────
// The default export is a singleton VALUE (not a class), so its type is
// `typeof InCallManagerType`.
let _incall: typeof InCallManagerType | undefined;
export const getInCallManager = (): typeof InCallManagerType => {
  if (!_incall) _incall = require('react-native-incall-manager').default;
  return _incall!;
};

// ── livekit-client (group calls — Room, RoomEvent, Track) ─────────────
let _lkClient: typeof LiveKitClientType | undefined;
export const getLiveKitClient = (): typeof LiveKitClientType => {
  if (!_lkClient) _lkClient = require('livekit-client');
  return _lkClient!;
};

// ── @livekit/react-native (group call VideoTrack component) ───────────
let _lkRN: typeof LiveKitRNType | undefined;
export const getLiveKitRN = (): typeof LiveKitRNType => {
  if (!_lkRN) _lkRN = require('@livekit/react-native');
  return _lkRN!;
};

// ── react-native-full-screen-notification-incoming-call (CallKeep) ────
let _callNotif: typeof CallNotificationType.default | undefined;
export const getCallNotification = (): typeof CallNotificationType.default => {
  if (!_callNotif) _callNotif = require('react-native-full-screen-notification-incoming-call').default;
  return _callNotif!;
};

// ── expo-notifications (push display + tap handling) ──────────────────
let _notifications: typeof NotificationsType | undefined;
export const getNotifications = (): typeof NotificationsType => {
  if (!_notifications) _notifications = require('expo-notifications');
  return _notifications!;
};

// ── expo-device (physical-device check for push registration) ─────────
let _device: typeof DeviceType | undefined;
export const getDevice = (): typeof DeviceType => {
  if (!_device) _device = require('expo-device');
  return _device!;
};

// ── expo-location (location sharing) ──────────────────────────────────
let _location: typeof LocationType | undefined;
export const getLocation = (): typeof LocationType => {
  if (!_location) _location = require('expo-location');
  return _location!;
};

// ── expo-callkit-telecom (iOS CallKit + VoIP push) ────────────────────
// iOS-only in practice — callers must guard with Platform.OS === 'ios'.
let _callkit: typeof CallKitType | undefined;
export const getCallKit = (): typeof CallKitType => {
  if (!_callkit) _callkit = require('expo-callkit-telecom');
  return _callkit!;
};
