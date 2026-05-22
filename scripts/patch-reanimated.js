// Postinstall patch for react-native-full-screen-notification-incoming-call.
//
// IncomingCallActivity.java has an optional "mainComponent" feature that uses
// ReactFragment.Builder. In RN 0.81, the Builder API changed and methods are
// ambiguous. We don't use this feature, so we remove the broken code block.

const fs = require('fs');
const path = require('path');

// ─── Patch 1: Full-screen notification incoming call ───

const callActivityPath = path.join(
  __dirname, '..', 'node_modules',
  'react-native-full-screen-notification-incoming-call',
  'android', 'src', 'main', 'java',
  'com', 'reactnativefullscreennotificationincomingcall',
  'IncomingCallActivity.java'
);

if (!fs.existsSync(callActivityPath)) {
  console.log('[patch] IncomingCallActivity.java not found — skipping');
  process.exit(0);
}

let java = fs.readFileSync(callActivityPath, 'utf-8');

// Already patched?
if (java.includes('// PATCHED: removed mainComponent block')) {
  console.log('[patch] full-screen-notification — already patched');
  process.exit(0);
}

// Remove the mainComponent if-block that uses broken ReactFragment.Builder API.
// Replace the entire if/else with just the default layout.
const lines = java.split('\n');
const newLines = [];
let skipping = false;
let patched = false;
let braceDepth = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (!skipping && line.includes('bundle.containsKey("mainComponent")')) {
    skipping = true;
    braceDepth = 0;
    // Count opening brace on this line
    for (const ch of line) {
      if (ch === '{') braceDepth++;
      if (ch === '}') braceDepth--;
    }
    newLines.push('    // PATCHED: removed mainComponent block (ReactFragment.Builder incompatible with RN 0.81)');
    newLines.push('    setContentView(R.layout.activity_call_incoming);');
    patched = true;
    continue;
  }

  if (skipping) {
    for (const ch of line) {
      if (ch === '{') braceDepth++;
      if (ch === '}') braceDepth--;
    }
    if (braceDepth <= 0) {
      skipping = false;
    }
    continue;
  }

  newLines.push(line);
}

if (patched) {
  let result = newLines.join('\n');
  // Remove unused ReactFragment import
  result = result.replace(
    'import com.facebook.react.ReactFragment;',
    '// import com.facebook.react.ReactFragment; // PATCHED: not needed'
  );
  fs.writeFileSync(callActivityPath, result, 'utf-8');
  console.log('[patch] full-screen-notification — removed broken ReactFragment code');
} else {
  console.log('[patch] full-screen-notification — pattern not found, skipping');
}
