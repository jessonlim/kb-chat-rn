// Expo config plugin: resolve the Firebase notification meta-data manifest-merge
// conflict introduced by adding @react-native-firebase/messaging.
//
// expo-notifications declares (from app.json `notification`):
//   <meta-data com.google.firebase.messaging.default_notification_color = @color/notification_icon_color>
//   <meta-data com.google.firebase.messaging.default_notification_icon  = @drawable/notification_icon>
// @react-native-firebase/messaging's library manifest declares the SAME keys with
// different values (@color/white + its own icon). The Android manifest merger then
// fails ':app:processReleaseMainManifest' with "Attribute ... is also present at
// [:react-native-firebase_messaging] ... add tools:replace".
//
// Fix: mark the app's meta-data with tools:replace="android:resource" so the app's
// branded values win over rn-firebase's defaults. (Keeps the red #dc2626 status-bar
// color + the proper monochrome notification icon.)

const { withAndroidManifest } = require('@expo/config-plugins');

const META = [
  {
    name: 'com.google.firebase.messaging.default_notification_color',
    resource: '@color/notification_icon_color',
  },
  {
    name: 'com.google.firebase.messaging.default_notification_icon',
    resource: '@drawable/notification_icon',
  },
];

module.exports = function withFirebaseNotificationMetaFix(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] =
      manifest.$['xmlns:tools'] || 'http://schemas.android.com/tools';

    const application = manifest.application && manifest.application[0];
    if (!application) return cfg;
    application['meta-data'] = application['meta-data'] || [];

    for (const m of META) {
      let el = application['meta-data'].find(
        (e) => e.$ && e.$['android:name'] === m.name
      );
      if (!el) {
        el = { $: { 'android:name': m.name } };
        application['meta-data'].push(el);
      }
      // Keep the app's value (create it if expo's plugin hasn't yet) and force it
      // to win the merge.
      if (!el.$['android:resource']) el.$['android:resource'] = m.resource;
      el.$['tools:replace'] = 'android:resource';
    }

    return cfg;
  });
};
