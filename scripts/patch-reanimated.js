// Postinstall patches for native modules that have compatibility issues.
//
// 1. react-native-reanimated + react-native-worklets:
//    Both force newArchEnabled=true, but WebRTC/InCallManager need Old Arch.
//    We comment out the build-blocking assertion.
//
// 2. react-native-full-screen-notification-incoming-call:
//    IncomingCallActivity.java uses method chaining on ReactFragment.Builder,
//    but RN 0.81 changed setComponentName() to return void.
//    We rewrite the builder to not chain calls.

const fs = require('fs');
const path = require('path');

// ── Patch 1: Disable New Arch assertions ──────────────────────────
const TARGET = 'preBuild.dependsOn(assertNewArchitectureEnabledTask)';
const COMMENT = '// Patched: allow Old Arch for WebRTC compatibility';

const newArchLibs = [
  'react-native-reanimated',
  'react-native-worklets',
];

for (const lib of newArchLibs) {
  const gradlePath = path.join(
    __dirname, '..', 'node_modules', lib, 'android', 'build.gradle'
  );

  if (!fs.existsSync(gradlePath)) {
    console.log(`[patch] ${lib} build.gradle not found — skipping`);
    continue;
  }

  let content = fs.readFileSync(gradlePath, 'utf-8');

  if (content.includes(TARGET)) {
    content = content.replace(TARGET, '// ' + TARGET + ' ' + COMMENT);
    fs.writeFileSync(gradlePath, content, 'utf-8');
    console.log(`[patch] ${lib} — disabled New Arch assertion`);
  } else {
    console.log(`[patch] ${lib} — already patched or no assertion found`);
  }
}

// ── Patch 2: Fix ReactFragment.Builder chaining in incoming call lib ──
const callActivityPath = path.join(
  __dirname, '..', 'node_modules',
  'react-native-full-screen-notification-incoming-call',
  'android', 'src', 'main', 'java',
  'com', 'reactnativefullscreennotificationincomingcall',
  'IncomingCallActivity.java'
);

if (fs.existsSync(callActivityPath)) {
  let java = fs.readFileSync(callActivityPath, 'utf-8');

  // The broken pattern (RN 0.81 changed setComponentName to return void):
  //   Fragment reactNativeFragment = new ReactFragment.Builder()
  //     .setComponentName(mainComponent)
  //     .setLaunchOptions(bundle)
  //     .build();
  const brokenPattern =
    'Fragment reactNativeFragment = new ReactFragment.Builder()\n' +
    '        .setComponentName(mainComponent)\n' +
    '        .setLaunchOptions(bundle)\n' +
    '        .build();';

  // Fixed version — no method chaining:
  const fixedCode =
    'ReactFragment.Builder fragmentBuilder = new ReactFragment.Builder();\n' +
    '      fragmentBuilder.setComponentName(mainComponent);\n' +
    '      fragmentBuilder.setLaunchOptions(bundle);\n' +
    '      Fragment reactNativeFragment = fragmentBuilder.build();';

  if (java.includes(brokenPattern)) {
    java = java.replace(brokenPattern, fixedCode);
    fs.writeFileSync(callActivityPath, java, 'utf-8');
    console.log('[patch] full-screen-notification — fixed ReactFragment.Builder chaining');
  } else {
    console.log('[patch] full-screen-notification — already patched or pattern not found');
  }
} else {
  console.log('[patch] full-screen-notification — IncomingCallActivity.java not found');
}
