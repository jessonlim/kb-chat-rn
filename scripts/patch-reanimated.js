// Patch react-native-reanimated and react-native-worklets to skip the
// "New Architecture required" assertion.
// Both libraries force newArchEnabled=true, but react-native-webrtc and
// react-native-incall-manager don't work with New Arch yet.
// This removes the build-blocking assertions while keeping everything else intact.

const fs = require('fs');
const path = require('path');

const TARGET = 'preBuild.dependsOn(assertNewArchitectureEnabledTask)';
const COMMENT = '// Patched: allow Old Arch for WebRTC compatibility';

const libraries = [
  'react-native-reanimated',
  'react-native-worklets',
];

for (const lib of libraries) {
  const gradlePath = path.join(
    __dirname,
    '..',
    'node_modules',
    lib,
    'android',
    'build.gradle'
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
