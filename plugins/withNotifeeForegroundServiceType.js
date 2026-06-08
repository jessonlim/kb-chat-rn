// Expo config plugin: declare the Android-14 foregroundServiceType on Notifee's
// foreground service (app.notifee.core.ForegroundService).
//
// On Android 14+ (targetSdk 34) a foreground service started WITH a type must
// (1) declare that type on the <service> in the merged manifest AND (2) the app
// must hold the matching FOREGROUND_SERVICE_* runtime permission — otherwise the
// OS throws a SecurityException at startForeground() and the call notification
// HARD-CRASHES the app (native, uncatchable). Notifee's bundled service doesn't
// declare a type, so we override it here.
//
// The ongoing-call notification uses microphone (+ camera for video calls). We
// intentionally do NOT use the `phoneCall` type here — that type has strict
// Telecom prerequisites (self-managed ConnectionService / default-dialer) that
// this app doesn't satisfy, and microphone+camera already surface Android's
// green mic/camera privacy indicators (the WhatsApp-style behaviour we want).
// The matching FOREGROUND_SERVICE_MICROPHONE / FOREGROUND_SERVICE_CAMERA
// permissions are declared in app.json. (The separate incoming-call library
// keeps its own service with the phoneCall type — untouched by this plugin.)

const { withAndroidManifest } = require('@expo/config-plugins');

const SERVICE_NAME = 'app.notifee.core.ForegroundService';
const FGS_TYPES = 'microphone|camera';

module.exports = function withNotifeeForegroundServiceType(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // Ensure the tools namespace exists (needed for tools:replace).
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
    service.$['android:foregroundServiceType'] = FGS_TYPES;
    // Override Notifee's bundled declaration during manifest merge.
    service.$['tools:replace'] = 'android:foregroundServiceType';

    return cfg;
  });
};
