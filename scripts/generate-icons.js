// One-shot script: convert KB Chat webp logo into the PNG icons Expo needs.
// Run once, then delete (or keep in case we want to regenerate from a new logo).

const sharp = require('sharp');
const path = require('path');

const SRC = 'C:/Users/Jesson/OneDrive/Desktop/JAM/MekaMessage/client/public/icons/icon-512.webp';
const ASSETS = path.join(__dirname, '..', 'assets');

async function run() {
  // 1. icon.png — 1024x1024 main app icon
  await sharp(SRC).resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toFile(path.join(ASSETS, 'icon.png'));
  console.log('✓ icon.png (1024x1024)');

  // 2. adaptive-icon.png — 1024x1024 Android adaptive foreground.
  // Safe zone is the inner ~66% — keep the logo centered with whitespace around.
  await sharp(SRC).resize(680, 680, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 172, bottom: 172, left: 172, right: 172, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toFile(path.join(ASSETS, 'adaptive-icon.png'));
  console.log('✓ adaptive-icon.png (1024x1024 with safe zone)');

  // 3. splash-icon.png — 1024x1024 centered for splash screen
  await sharp(SRC).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 256, bottom: 256, left: 256, right: 256, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toFile(path.join(ASSETS, 'splash-icon.png'));
  console.log('✓ splash-icon.png (1024x1024 centered)');

  // 4. favicon.png — 48x48 for web
  await sharp(SRC).resize(48, 48).png().toFile(path.join(ASSETS, 'favicon.png'));
  console.log('✓ favicon.png (48x48)');

  // 5. notification-icon.png — white silhouette for Android status bar (24x24 base, exported at 96x96)
  // For now we'll use the same logo; can replace with a white-only version later if needed.
  await sharp(SRC).resize(96, 96).png().toFile(path.join(ASSETS, 'notification-icon.png'));
  console.log('✓ notification-icon.png (96x96)');
}

run().catch(err => { console.error(err); process.exit(1); });
