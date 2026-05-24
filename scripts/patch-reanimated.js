// Postinstall patches for third-party modules with build/resolution quirks.
// Runs once after `npm install` (and on EAS Build servers).

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ─── Patch 1: Full-screen notification incoming call ─────────────────
// IncomingCallActivity.java has an optional "mainComponent" feature that
// uses ReactFragment.Builder. In RN 0.81, the Builder API changed and
// methods are ambiguous. We don't use this feature, so we strip the
// broken code block.
(function patchFullScreenNotification() {
  const file = path.join(
    ROOT, 'node_modules',
    'react-native-full-screen-notification-incoming-call',
    'android', 'src', 'main', 'java',
    'com', 'reactnativefullscreennotificationincomingcall',
    'IncomingCallActivity.java',
  );
  if (!fs.existsSync(file)) {
    console.log('[patch] full-screen-notification: file not found, skipping');
    return;
  }
  const original = fs.readFileSync(file, 'utf-8');
  if (original.includes('// PATCHED: removed mainComponent block')) {
    console.log('[patch] full-screen-notification: already patched');
    return;
  }
  const lines = original.split('\n');
  const out = [];
  let skipping = false;
  let depth = 0;
  let patched = false;
  for (const line of lines) {
    if (!skipping && line.includes('bundle.containsKey("mainComponent")')) {
      skipping = true;
      depth = 0;
      for (const ch of line) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
      }
      out.push('    // PATCHED: removed mainComponent block (ReactFragment.Builder incompatible with RN 0.81)');
      out.push('    setContentView(R.layout.activity_call_incoming);');
      patched = true;
      continue;
    }
    if (skipping) {
      for (const ch of line) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
      }
      if (depth <= 0) skipping = false;
      continue;
    }
    out.push(line);
  }
  if (!patched) {
    console.log('[patch] full-screen-notification: pattern not found, skipping');
    return;
  }
  let result = out.join('\n');
  result = result.replace(
    'import com.facebook.react.ReactFragment;',
    '// import com.facebook.react.ReactFragment; // PATCHED',
  );
  fs.writeFileSync(file, result, 'utf-8');
  console.log('[patch] full-screen-notification: removed broken ReactFragment code');
})();

// ─── Patch 2: rn-emoji-keyboard package.json ─────────────────────────
// Its `react-native` field points at `src/index` (raw TS), but our Metro
// (Expo SDK 54 with strict resolver) can't follow some of the directory
// imports inside that source tree (e.g. `../assets/funnel` → which is a
// directory containing an `index.tsx` + a PNG). The compiled `lib/module`
// output has the same shape but resolves cleanly. Point Metro there.
(function patchEmojiKeyboard() {
  const pkgFile = path.join(ROOT, 'node_modules', 'rn-emoji-keyboard', 'package.json');
  if (!fs.existsSync(pkgFile)) {
    console.log('[patch] rn-emoji-keyboard: not installed, skipping');
    return;
  }
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf-8'));
  if (pkg['react-native'] === 'lib/module/index') {
    console.log('[patch] rn-emoji-keyboard: already patched');
    return;
  }
  pkg['react-native'] = 'lib/module/index';
  delete pkg.source;
  fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  console.log('[patch] rn-emoji-keyboard: react-native field → lib/module/index');
})();
