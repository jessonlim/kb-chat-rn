// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Disable strict package exports resolution.
// Expo SDK 54 enables this by default, but reanimated 3.x (needed for
// Old Architecture compat) uses internal directory imports (./logger,
// ./sharedTransitions, etc.) that the strict resolver can't follow.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
