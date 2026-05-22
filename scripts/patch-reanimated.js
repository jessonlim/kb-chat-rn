// Postinstall patch for react-native-full-screen-notification-incoming-call.
//
// IncomingCallActivity.java has an optional "mainComponent" feature that uses
// ReactFragment.Builder. In RN 0.81, the Builder API changed and
// setComponentName/setLaunchOptions are ambiguous. We don't use this feature
// (we use the library's built-in call notification UI), so we comment it out.

const fs = require('fs');
const path = require('path');

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

// Check if already patched
if (java.includes('// PATCHED: removed mainComponent block')) {
  console.log('[patch] full-screen-notification — already patched');
  process.exit(0);
}

// Replace the mainComponent if-block with just the else branch.
// The broken code tries to use ReactFragment.Builder which is incompatible with RN 0.81.
// Since we never pass mainComponent, we just always use the default layout.

// Find and replace the if/else block
const oldBlock = `    if (bundle.containsKey("mainComponent") && bundle.getString("mainComponent") != null) {
      String mainComponent = bundle.getString("mainComponent");
      setContentView(R.layout.custom_ingcoming_call_rn);
      Fragment reactNativeFragment = new ReactFragment.Builder()
        .setComponentName(mainComponent)
        .setLaunchOptions(bundle)
        .build();

      getSupportFragmentManager()
        .beginTransaction()
        .add(R.id.reactNativeFragment, reactNativeFragment)
        .commit();
      return;
    } else {
      setContentView(R.layout.activity_call_incoming);
    }`;

const newBlock = `    // PATCHED: removed mainComponent block (ReactFragment.Builder incompatible with RN 0.81)
    setContentView(R.layout.activity_call_incoming);`;

if (java.includes(oldBlock)) {
  java = java.replace(oldBlock, newBlock);
  fs.writeFileSync(callActivityPath, java, 'utf-8');
  console.log('[patch] full-screen-notification — removed broken ReactFragment code');
} else {
  // Try alternate pattern (our previous patch may have changed the chaining)
  const altBlock = `    if (bundle.containsKey("mainComponent") && bundle.getString("mainComponent") != null) {
      String mainComponent = bundle.getString("mainComponent");
      setContentView(R.layout.custom_ingcoming_call_rn);
      ReactFragment.Builder fragmentBuilder = new ReactFragment.Builder();
      fragmentBuilder.setComponentName(mainComponent);
      fragmentBuilder.setLaunchOptions(bundle);
      Fragment reactNativeFragment = fragmentBuilder.build();

      getSupportFragmentManager()
        .beginTransaction()
        .add(R.id.reactNativeFragment, reactNativeFragment)
        .commit();
      return;
    } else {
      setContentView(R.layout.activity_call_incoming);
    }`;

  if (java.includes(altBlock)) {
    java = java.replace(altBlock, newBlock);
    fs.writeFileSync(callActivityPath, java, 'utf-8');
    console.log('[patch] full-screen-notification — removed broken ReactFragment code (alt pattern)');
  } else {
    console.log('[patch] full-screen-notification — could not find pattern to patch');
    console.log('[patch] Attempting line-based removal...');

    // Fallback: remove lines between the markers
    const lines = java.split('\n');
    const newLines = [];
    let skipping = false;
    let patched = false;

    for (const line of lines) {
      if (line.includes('bundle.containsKey("mainComponent")')) {
        skipping = true;
        newLines.push('    // PATCHED: removed mainComponent block (ReactFragment.Builder incompatible with RN 0.81)');
        newLines.push('    setContentView(R.layout.activity_call_incoming);');
        patched = true;
        continue;
      }
      if (skipping) {
        // Skip until we find the closing else + setContentView line, or the closing brace
        if (line.includes('setContentView(R.layout.activity_call_incoming)')) {
          // Found the else branch content — we already added it
          continue;
        }
        if (line.trim() === '}' && !line.includes('getSupportFragmentManager')) {
          skipping = false;
          continue;
        }
        continue;
      }
      newLines.push(line);
    }

    if (patched) {
      fs.writeFileSync(callActivityPath, newLines.join('\n'), 'utf-8');
      console.log('[patch] full-screen-notification — removed via line-based fallback');
    } else {
      console.log('[patch] WARNING: Could not patch IncomingCallActivity.java');
    }
  }
}

// Also remove the unused ReactFragment import if present
let java2 = fs.readFileSync(callActivityPath, 'utf-8');
if (java2.includes('import com.facebook.react.ReactFragment;') && java2.includes('// PATCHED')) {
  java2 = java2.replace(
    'import com.facebook.react.ReactFragment;',
    '// import com.facebook.react.ReactFragment; // PATCHED: not needed'
  );
  fs.writeFileSync(callActivityPath, java2, 'utf-8');
  console.log('[patch] full-screen-notification — removed unused ReactFragment import');
}
