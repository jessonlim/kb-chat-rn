// Expo config plugin: declare the Android-14 foregroundServiceType on Notifee's
// foreground service (app.notifee.core.ForegroundService).
//
// On Android 14+ (targetSdk 34) a foreground service started WITH a type must
// have that type declared on the <service> in the merged manifest, or the OS
// throws and the call notification crashes. Notifee's bundled service doesn't
// declare one, so we override it here. The ongoing-call notification uses
// phoneCall + microphone (+ camera for video calls), so the service must allow
// that superset. The matching FOREGROUND_SERVICE_* permissions are already in
// app.json.

const { withAndroidManifest } = require('@expo/config-plugins');

const SERVICE_NAME = 'app.notifee.core.ForegroundService';
const FGS_TYPES = 'phoneCall|microphone|camera';

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
