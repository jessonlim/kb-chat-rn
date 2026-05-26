// One-off: regenerate assets/adaptive-icon.png with proper Android safe-zone padding.
//
// Android adaptive icons get masked into various shapes (circle, squircle,
// rounded-square, teardrop) by the launcher. The OS crops the outer ~33% of
// the canvas. So the foreground image needs ALL meaningful content inside
// the inner ~66% (≈ 672px on a 1024 canvas).
//
// Our previous adaptive-icon.png had the white speech bubble at ~75% of the
// canvas width, which was getting its corners clipped on Samsung One UI's
// aggressive rounded-square mask (reported on Fold Z 6).
//
// This script takes the source icon (assets/icon.png, which is the full red
// + white combined icon) and rebuilds:
//   - adaptive-icon.png: extract just the white bubble, place at ~52% canvas
//   - icon.png stays unchanged (it's the iOS / generic icon)
//
// Run with: node scripts/resize-adaptive-icon.js

const sharp = require('sharp');
const path = require('path');

const ROOT = path.join(__dirname, '..');
// SOURCE is the original full-bleed bubble preserved under assets/source/.
// Don't read from assets/adaptive-icon.png — each re-run would compound
// the resize (smaller and smaller bubble in growing transparency).
const SRC = path.join(ROOT, 'assets', 'source', 'adaptive-icon-original.png');
const OUT = path.join(ROOT, 'assets', 'adaptive-icon.png');

const CANVAS_SIZE = 1024;
// 700 / 1024 = ~68% — just inside the Android safe zone for the common
// mask shapes (circle, squircle, rounded square). 52% was too small (the
// bubble looked tiny vs neighbouring icons like WeChat / GitHub which
// fill ~75% of their card). 68% matches typical visual weight without
// clipping on Samsung One UI's rounded-square mask.
const FOREGROUND_SIZE = 700;

(async () => {
  // Read source, resize foreground to FOREGROUND_SIZE
  const resized = await sharp(SRC)
    .resize(FOREGROUND_SIZE, FOREGROUND_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Composite onto a 1024x1024 transparent canvas, centered
  await sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, gravity: 'center' }])
    .png()
    .toFile(OUT);

  console.log(`✓ adaptive-icon.png: bubble resized to ${FOREGROUND_SIZE}px on ${CANVAS_SIZE}px canvas`);
})();
