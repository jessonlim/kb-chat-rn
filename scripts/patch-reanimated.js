// Patch react-native-reanimated to skip the "New Architecture required" assertion.
// Reanimated 4.x forces newArchEnabled=true, but react-native-webrtc and
// react-native-incall-manager don't work with New Arch yet.
// This removes the build-blocking assertion while keeping everything else intact.

const fs = require('fs');
const path = require('path');

const buildGradlePath = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-reanimated',
  'android',
  'build.gradle'
);

if (!fs.existsSync(buildGradlePath)) {
  console.log('[patch-reanimated] build.gradle not found — skipping');
  process.exit(0);
}

let content = fs.readFileSync(buildGradlePath, 'utf-8');

const target = 'preBuild.dependsOn(assertNewArchitectureEnabledTask)';

if (content.includes(target)) {
  content = content.replace(
    target,
    '// ' + target + ' // Patched: allow Old Arch for WebRTC compatibility'
  );
  fs.writeFileSync(buildGradlePath, content, 'utf-8');
  console.log('[patch-reanimated] Disabled New Arch assertion — Old Arch build OK');
} else {
  console.log('[patch-reanimated] Assertion already patched or not found — skipping');
}
