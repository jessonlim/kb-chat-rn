// Stable per-install device identity for the Batch 3 account-security rules.
// The id is generated once and persisted in plain MMKV — it is NOT a secret;
// it only lets the backend tell a re-login on THIS phone apart from a login on
// a different phone (so "one phone per account" doesn't kick yourself).
import { Platform } from 'react-native';
import { storage } from './api';

const DEVICE_ID_KEY = 'device.id.v1';

export const getDeviceId = (): string => {
  let id = storage.getString(DEVICE_ID_KEY);
  if (!id) {
    id = `ph_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    storage.set(DEVICE_ID_KEY, id);
  }
  return id;
};

// Sent on login/register/refresh so the backend can tag this session as a phone.
export const deviceMeta = () => ({
  deviceId: getDeviceId(),
  deviceType: 'phone' as const,
  deviceName: Platform.OS === 'ios' ? 'iPhone' : 'Android',
});
