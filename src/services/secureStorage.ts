// Encrypted token storage — audit finding M1.
//
// Why a separate module from `storage` in api.ts:
//   The default MMKV instance holds a lot of non-sensitive data
//   (theme prefs, last-seen chat IDs, signed-URL cache, language
//   choice) — encrypting all of it would slow down every preference
//   read. We only need encryption for credentials: the JWT access +
//   refresh tokens. Everything else stays in plain MMKV.
//
// How the encryption works:
//   1. On first run after install, we generate a fresh 32-byte random
//      key (via expo-crypto's secure RNG).
//   2. We persist that key in expo-secure-store, which on Android
//      uses the Keystore (hardware-backed on most modern devices)
//      and on iOS uses the Keychain. Even a rooted device can't
//      easily exfiltrate it.
//   3. We open a second MMKV instance with `id: 'kbchat.secure'` and
//      `encryptionKey: <the key>`. MMKV uses AES-CBC under the hood.
//   4. Tokens live in this encrypted instance.
//
// Migration:
//   Existing users have tokens in the plain `storage` instance from
//   the old code. On first launch with this build, we migrate them
//   to the encrypted instance and delete the plaintext copies. The
//   user stays signed in.
//
// Failure handling:
//   If expo-secure-store fails to give us a key (unusual: maybe the
//   keychain is locked while screen is off and we're running in a
//   background task), the tokens fall back to plaintext storage for
//   that session. Worst case: a single missed encryption window.
//   The next launch retries.

import { MMKV } from 'react-native-mmkv';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { storage as plainStorage } from './api';

const SECURE_KEY_NAME = 'kbchat.mmkv.key.v1';
const SECURE_MMKV_ID = 'kbchat.secure';
const MIGRATION_FLAG = 'secureStorage.migrated.v1';

// Hold the encrypted MMKV instance once it's been opened. Reading the
// keychain on every storage op would be too slow.
let secureInstance: MMKV | null = null;

// Set to true if expo-secure-store fails in a way that's permanent
// (e.g. keychain access denied). Falls back to plaintext for this
// session so the user doesn't get a hard error.
let fellBackToPlaintext = false;

const generateKey = async (): Promise<string> => {
  // 32 bytes → 64 hex chars. MMKV accepts any string key.
  const bytes = await Crypto.getRandomBytesAsync(32);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const getOrCreateKey = async (): Promise<string> => {
  const existing = await SecureStore.getItemAsync(SECURE_KEY_NAME);
  if (existing) return existing;
  const fresh = await generateKey();
  await SecureStore.setItemAsync(SECURE_KEY_NAME, fresh, {
    // Don't require user authentication every time — that would block
    // background pushes + cold-start flows. We're protecting at-rest
    // from rooted-device exfil, not authenticating individual reads.
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
  return fresh;
};

/**
 * Initialise the encrypted MMKV instance and migrate any plaintext
 * tokens from the old `storage`. Call this once at app startup,
 * BEFORE the auth store reads tokens.
 *
 * Returns true if encryption is active, false if we fell back to
 * plaintext for this session.
 */
export const initSecureStorage = async (): Promise<boolean> => {
  if (secureInstance) return !fellBackToPlaintext;

  try {
    const key = await getOrCreateKey();
    secureInstance = new MMKV({
      id: SECURE_MMKV_ID,
      encryptionKey: key,
    });
  } catch (err) {
    console.warn('[secureStorage] encryption init failed — falling back to plaintext for this session:', err);
    fellBackToPlaintext = true;
    secureInstance = null;
    return false;
  }

  // Migrate plaintext tokens (one-time)
  const migrated = plainStorage.getBoolean(MIGRATION_FLAG);
  if (!migrated) {
    try {
      const at = plainStorage.getString('accessToken');
      const rt = plainStorage.getString('refreshToken');
      if (at) secureInstance.set('accessToken', at);
      if (rt) secureInstance.set('refreshToken', rt);
      plainStorage.delete('accessToken');
      plainStorage.delete('refreshToken');
      plainStorage.set(MIGRATION_FLAG, true);
      console.log('[secureStorage] migrated tokens to encrypted store');
    } catch (err) {
      console.warn('[secureStorage] migration failed:', err);
      // Don't set the flag — we'll retry next launch. The plaintext
      // tokens stay where they are, so the user is still signed in.
    }
  }

  return true;
};

/**
 * Token storage API. If init succeeded, reads/writes go to the
 * encrypted MMKV. If init failed (fellBackToPlaintext), reads/writes
 * go to the regular `storage` so the app still functions.
 *
 * IMPORTANT: callers should NOT cache the result of this object — the
 * underlying instance flips from null → MMKV during initSecureStorage,
 * so each call must go through the getters.
 */
export const secureStorage = {
  getToken(name: 'accessToken' | 'refreshToken'): string | undefined {
    if (secureInstance) return secureInstance.getString(name);
    return plainStorage.getString(name);
  },
  setToken(name: 'accessToken' | 'refreshToken', value: string): void {
    if (secureInstance) secureInstance.set(name, value);
    else plainStorage.set(name, value);
  },
  deleteToken(name: 'accessToken' | 'refreshToken'): void {
    if (secureInstance) secureInstance.delete(name);
    plainStorage.delete(name);
  },
  /** Wipe ALL tokens — both encrypted + any plaintext leftovers. */
  clearAll(): void {
    if (secureInstance) {
      secureInstance.delete('accessToken');
      secureInstance.delete('refreshToken');
    }
    plainStorage.delete('accessToken');
    plainStorage.delete('refreshToken');
  },
  /** True if the secure store is active. False if we fell back. */
  isEncrypted(): boolean {
    return secureInstance !== null && !fellBackToPlaintext;
  },
};
