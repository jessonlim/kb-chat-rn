// Image compression utility — resizes and compresses images before upload.
// Uses expo-image-manipulator to keep uploads fast and storage lean.

import * as ImageManipulator from 'expo-image-manipulator';

const MAX_DIMENSION = 1920;
const QUALITY = 0.85;

export interface CompressedImage {
  uri: string;
  width: number;
  height: number;
}

/**
 * Compress an image picked from gallery or camera.
 * Downscales so the longest side is at most 1920px and applies JPEG compression.
 */
export const compressImage = async (uri: string): Promise<CompressedImage> => {
  // First get the original dimensions by doing a no-op manipulation
  const probe = await ImageManipulator.manipulateAsync(uri, [], {
    compress: 1,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  const { width: origW, height: origH } = probe;

  // Figure out if we need to resize
  const actions: ImageManipulator.Action[] = [];
  if (origW > MAX_DIMENSION || origH > MAX_DIMENSION) {
    if (origW >= origH) {
      actions.push({ resize: { width: MAX_DIMENSION } });
    } else {
      actions.push({ resize: { height: MAX_DIMENSION } });
    }
  }

  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
  };
};
