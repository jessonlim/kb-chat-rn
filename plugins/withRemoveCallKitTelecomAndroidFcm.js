// Expo config plugin: REMOVE expo-callkit-telecom's Android FirebaseMessagingService.
//
// Adding @react-native-firebase/messaging registers
//   io.invertase.firebase.messaging.ReactNativeFirebaseMessagingService
// for com.google.firebase.MESSAGING_EVENT. But expo-callkit-telecom ALSO registers
//   expo.modules.callkittelecom.services.ExpoCallKitTelecomMessagingService
// for the same event, both at default (priority 0). FCM delivers a message to
// exactly ONE FirebaseMessagingService, resolved non-deterministically — if
// callkit-telecom's wins, @react-native-firebase's setBackgroundMessageHandler
// NEVER fires and the killed/locked full-screen-call feature silently dies.
//
// expo-callkit-telecom is iOS-ONLY in this app (callkitService.ts no-ops on
// Android; Android rings via react-native-full-screen-notification-incoming-call
// driven by the rn-firebase background handler). So its Android FCM service is
// unused dead weight — strip it so rn-firebase is the SOLE MESSAGING_EVENT
// handler. (callkit-telecom's iOS CallKit/VoIP path is untouched — that's PushKit,
// not FCM.) Verify after prebuild: exactly ONE MESSAGING_EVENT <service> remains.

const { withAndroidManifest } = require('@expo/config-plugins');

const SERVICE_NAME =
  'expo.modules.callkittelecom.services.ExpoCallKitTelecomMessagingService';

module.exports = function withRemoveCallKitTelecomAndroidFcm(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] =
      manifest.$['xmlns:tools'] || 'http://schemas.android.com/tools';

    const application = manifest.application && manifest.application[0];
    if (!application) return cfg;
    application.service = application.service || [];

    let service = application.service.find(
      (s) => s.$ && s.$['android:name'] === SERVICE_NAME
    );
    if (!service) {
      service = { $: { 'android:name': SERVICE_NAME } };
      application.service.push(service);
    }
    // tools:node="remove" deletes the library-contributed service during merge.
    service.$['tools:node'] = 'remove';
    // The release "lintVitalRelease" task runs the Instantiatable check against
    // this declaration and (false-positive) demands the to-be-removed service
    // class extend android.app.Service, failing the build. Suppress that one
    // check on this node — it's a removal directive, not a real registration.
    service.$['tools:ignore'] = 'Instantiatable';

    return cfg;
  });
};
