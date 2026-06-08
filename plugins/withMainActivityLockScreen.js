// Expo config plugin: let MainActivity appear OVER the lock screen.
//
// The incoming-call notification (Notifee fullScreenAction) launches the app's
// default activity (MainActivity) via a full-screen-intent PendingIntent. For it
// to surface over the keyguard on a locked phone, MainActivity must declare
// android:showWhenLocked="true" and android:turnScreenOn="true". (The old
// full-screen-call library set these on ITS OWN IncomingCallActivity — but we no
// longer use that activity, so MainActivity needs them now.) Without these, on a
// locked phone the full-screen intent fires but the RN UI sits behind the keyguard.

const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withMainActivityLockScreen(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    if (!application || !application.activity) return cfg;

    const main = application.activity.find((a) => {
      const name = a.$ && a.$['android:name'];
      return name === '.MainActivity' || (typeof name === 'string' && name.endsWith('.MainActivity'));
    });
    if (main) {
      main.$['android:showWhenLocked'] = 'true';
      main.$['android:turnScreenOn'] = 'true';
    }
    return cfg;
  });
};
