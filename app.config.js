// Dynamic Expo config layered on top of app.json.
//
// Sole purpose: keep the Firebase config files (google-services.json,
// GoogleService-Info.plist) OUT of git. They contain a Firebase *client* API key
// which — while safe to ship (it lives in the app binary anyway and is guarded by
// API-key restrictions + Firebase Security Rules) — should not sit in the repo.
//
// At BUILD time on EAS, the file-type env vars GOOGLE_SERVICES_JSON /
// GOOGLE_SERVICE_INFO_PLIST resolve to the on-disk path of the secured file EAS
// writes for us, so the native build still gets a real Firebase config.
//
// LOCALLY (prebuild / expo config) the env vars are unset, so we fall back to the
// gitignored copies in the repo root — present on disk, just not committed.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile,
  },
  ios: {
    ...config.ios,
    googleServicesFile:
      process.env.GOOGLE_SERVICE_INFO_PLIST ?? config.ios?.googleServicesFile,
  },
});
