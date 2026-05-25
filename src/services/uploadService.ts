// Upload service — sends files to the backend via multipart/form-data.
// Uses XMLHttpRequest (not axios) so we get real upload progress in React Native.

import Toast from 'react-native-toast-message';
import { API_URL, storage } from './api';

// DEBUG: surface upload progress + failure reasons. Once we confirm uploads
// work in production, gate behind a flag like SHOW_SOCKET_DEBUG.
const SHOW_UPLOAD_DEBUG = true;
const dt = (text1: string, text2?: string, type: 'info' | 'success' | 'error' = 'info') => {
  if (!SHOW_UPLOAD_DEBUG) return;
  Toast.show({ type, text1, text2, position: 'top', visibilityTime: 3000 });
};

export interface UploadResult {
  url: string;
  type: string;
  name: string;
  size: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number; // 0–100
}

/**
 * Upload a file to POST /api/uploads.
 *
 * @param fileUri   - local file URI from image picker / document picker
 * @param fileName  - original file name (e.g. "photo.jpg")
 * @param mimeType  - MIME type (e.g. "image/jpeg")
 * @param onProgress - optional progress callback
 * @returns the server response: { url, type, name, size }
 */
export const uploadFile = (
  fileUri: string,
  fileName: string,
  mimeType: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  return new Promise((resolve, reject) => {
    const token = storage.getString('accessToken');
    if (!token) {
      dt('Upload: no token', 'Not authenticated', 'error');
      reject(new Error('Not authenticated'));
      return;
    }

    dt('Upload: starting', `${mimeType} ${fileName}`);

    const formData = new FormData();
    // React Native's FormData accepts { uri, type, name } objects
    formData.append('file', {
      uri: fileUri,
      type: mimeType,
      name: fileName,
    } as any);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/api/uploads`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    // Don't set Content-Type — XMLHttpRequest will set the correct multipart boundary

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percent: Math.round((event.loaded / event.total) * 100),
        });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          // Backend may return { url, type } or { file: { url, type, name, size } }
          // Normalise to a consistent shape
          const result: UploadResult = {
            url: data.url || data.file?.url || '',
            type: data.type || data.file?.type || mimeType,
            name: data.name || data.file?.name || fileName,
            size: data.size || data.file?.size || 0,
          };
          dt('✅ Upload OK', `${result.url.slice(0, 40)}…`, 'success');
          resolve(result);
        } catch {
          dt('❌ Upload bad JSON', xhr.responseText.slice(0, 60), 'error');
          reject(new Error('Invalid upload response'));
        }
      } else {
        dt('❌ Upload HTTP error', `${xhr.status}: ${xhr.responseText.slice(0, 80)}`, 'error');
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => {
      dt('❌ Upload network error', `to ${API_URL}/api/uploads`, 'error');
      reject(new Error('Upload network error'));
    };

    xhr.ontimeout = () => {
      dt('❌ Upload timeout', '120s', 'error');
      reject(new Error('Upload timed out'));
    };

    xhr.timeout = 120_000; // 2 minutes
    xhr.send(formData);
  });
};
