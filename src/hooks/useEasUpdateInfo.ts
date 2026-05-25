// Visibility for EAS Updates — surface which update is currently
// running so testers can confirm a hot-patch actually applied.
//
// Behaviour:
//   • On app launch: read currently-active update metadata + toast it
//   • On launch: trigger a background check for new updates
//   • When a new update is downloaded: toast "Update ready — restart to apply"
//   • Caller can also tap an "Apply now" action to reloadAsync immediately
//
// This file is pure JS so it ships via EAS Update itself.

import { useEffect, useState } from 'react';
import * as Updates from 'expo-updates';
import Toast from 'react-native-toast-message';

interface UpdateInfo {
  channel: string | null;
  updateId: string | null;
  createdAt: Date | null;
  isEmbedded: boolean;
}

const formatTime = (d: Date | null) => {
  if (!d) return '—';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
};

export const useEasUpdateInfo = () => {
  const [info, setInfo] = useState<UpdateInfo>({
    channel: null,
    updateId: null,
    createdAt: null,
    isEmbedded: true,
  });
  const [hasPendingUpdate, setHasPendingUpdate] = useState(false);

  // On mount: read current state + toast it
  useEffect(() => {
    const current: UpdateInfo = {
      channel: Updates.channel ?? null,
      // Updates.updateId is `null` when running the bundle embedded in the
      // APK (no OTA applied yet), and a UUID once a hot-patch is active.
      updateId: Updates.updateId ?? null,
      createdAt: Updates.createdAt ?? null,
      isEmbedded: Updates.updateId == null,
    };
    setInfo(current);

    // Toast the current build state once on launch — helpful for testers
    // to confirm whether they're on the embedded APK code or a hot-patch.
    if (current.isEmbedded) {
      Toast.show({
        type: 'info',
        text1: '📦 Running embedded build',
        text2: `${current.channel || 'default'} channel · no OTA applied`,
        position: 'top',
        visibilityTime: 3000,
      });
    } else {
      Toast.show({
        type: 'success',
        text1: '🚀 Running EAS Update',
        text2: `${current.channel || 'default'} · ${formatTime(current.createdAt)} · ${(current.updateId || '').slice(0, 8)}`,
        position: 'top',
        visibilityTime: 3000,
      });
    }
  }, []);

  // On mount: kick off a check for new updates. If one is found, download
  // it in the background. The user has to restart the app to activate it,
  // but we toast them so they know it's available.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!Updates.isEnabled) return;
        const check = await Updates.checkForUpdateAsync();
        if (cancelled) return;
        if (check.isAvailable) {
          await Updates.fetchUpdateAsync();
          if (cancelled) return;
          setHasPendingUpdate(true);
          Toast.show({
            type: 'success',
            text1: '🆕 Update downloaded',
            text2: 'Close + reopen the app to apply',
            position: 'top',
            visibilityTime: 5000,
          });
        }
      } catch (err) {
        // Silent — most failures are "no update available" or no network.
        // We only surface success cases.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Imperative API for a "Reload now" button
  const reloadToApply = async () => {
    try {
      await Updates.reloadAsync();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Reload failed',
        text2: (err as Error)?.message,
      });
    }
  };

  return {
    ...info,
    formattedAge: formatTime(info.createdAt),
    hasPendingUpdate,
    reloadToApply,
  };
};
