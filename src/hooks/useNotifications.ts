// useNotifications hook — initializes push notifications when user is logged in.
// Call this once in the main app component.

import { useEffect, useRef } from 'react';
import notificationService from '../services/notificationService';
import callkitService from '../services/callkitService';
import { maybePromptCallPermissions } from '../services/callPermissions';

const useNotifications = (isLoggedIn: boolean) => {
  const initialized = useRef(false);

  useEffect(() => {
    if (!isLoggedIn) {
      // User logged out — unregister token
      if (initialized.current) {
        notificationService.unregisterToken();
        callkitService.cleanup();
        initialized.current = false;
      }
      return;
    }

    // User logged in — initialize notifications
    if (!initialized.current) {
      initialized.current = true;
      notificationService.init();
      notificationService.handleInitialNotification();
      // iOS VoIP push registration for CallKit (no-op on Android).
      callkitService.init();
      // One-time Android prompt for the full-screen-intent + battery permissions
      // (so locked-screen calls ring full-screen). Delayed so it doesn't collide
      // with the post-login screen transition. Shows once, then never again.
      setTimeout(() => maybePromptCallPermissions(), 2500);
    }

    // Set up tap handler
    const cleanup = notificationService.setupTapHandler();
    return cleanup;
  }, [isLoggedIn]);
};

export default useNotifications;
