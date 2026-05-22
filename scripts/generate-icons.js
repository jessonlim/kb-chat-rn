// Generate KB Chat brand icons in all sizes Expo needs.
// Source: assets/KB Chat Icon.png — 500x500, white logo on transparent background.
//
// Output:
//   - icon.png         (1024x1024, white logo on red bg, full color — iOS + legacy Android)
//   - adaptive-icon.png (1024x1024, white logo on transparent — Android adaptive foreground)
//   - splash-icon.png  (1024x1024, white logo centered, full color)
//   - favicon.png      (48x48, white on red)
//   - notification-icon.png (96x96, white silhouette, transparent — Android status bar)

const sharp = require('sharp');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets');
const SRC = path.join(ASSETS, 'KB Chat Icon.png'); // white logo, transparent bg
const RED = { r: 220, g: 38, b: 38, alpha: 1 };   // #dc2626 — KB Chat brand red

async function run() {
  // The source logo is 500x500. For each output, we resize to fit a "safe area"
  // inside the target canvas, then composite onto the appropriate background.

  // 1. icon.png — 1024x1024, white logo on red background, edge-to-edge.
  //    Used for iOS and as the Android legacy (round/square) icon.
  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: RED }
  })
    .composite([{ input: await sharp(SRC).resize(768, 768, { fit: 'contain' }).toBuffer() }])
    .png()
    .toFile(path.join(ASSETS, 'icon.png'));
  console.log('✓ icon.png (1024x1024, white logo on red)');

  // 2. adaptive-icon.png — 1024x1024 white logo on transparent background.
  //    Android composites this over the backgroundColor in app.json (#dc2626).
  //    Logo sized to fit inside the safe zone (inner ~66% of canvas).
  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([{ input: await sharp(SRC).resize(620, 620, { fit: 'contain' }).toBuffer() }])
    .png()
    .toFile(path.join(ASSETS, 'adaptive-icon.png'));
  console.log('✓ adaptive-icon.png (1024x1024, white logo, transparent bg)');

  // 3. splash-icon.png — 1024x1024 white logo centered, red background.
  await sharp({
    create: { width: 1024, height: 1024, channels: 4, background: RED }
  })
    .composite([{ input: await sharp(SRC).resize(512, 512, { fit: 'contain' }).toBuffer() }])
    .png()
    .toFile(path.join(ASSETS, 'splash-icon.png'));
  console.log('✓ splash-icon.png (1024x1024, white logo centered on red)');

  // 4. favicon.png — 48x48 for web (full color)
  await sharp({
    create: { width: 48, height: 48, channels: 4, background: RED }
  })
    .composite([{ input: await sharp(SRC).resize(36, 36, { fit: 'contain' }).toBuffer() }])
    .png()
    .toFile(path.join(ASSETS, 'favicon.png'));
  console.log('✓ favicon.png (48x48, white on red)');

  // 5. notification-icon.png — 96x96 white silhouette on transparent.
  //    Android requires status-bar notification icons to be white-only.
  await sharp(SRC).resize(96, 96, { fit: 'contain' }).png().toFile(path.join(ASSETS, 'notification-icon.png'));
  console.log('✓ notification-icon.png (96x96, white silhouette, transparent)');
}

run().catch(err => { console.error(err); process.exit(1); });
