// useNotifications hook — initializes push notifications when user is logged in.
// Call this once in the main app component.

import { useEffect, useRef } from 'react';
import notificationService from '../services/notificationService';

const useNotifications = (isLoggedIn: boolean) => {
  const initialized = useRef(false);

  useEffect(() => {
    if (!isLoggedIn) {
      // User logged out — unregister token
      if (initialized.current) {
        notificationService.unregisterToken();
        initialized.current = false;
      }
      return;
    }

    // User logged in — initialize notifications
    if (!initialized.current) {
      initialized.current = true;
      notificationService.init();
      notificationService.handleInitialNotification();
    }

    // Set up tap handler
    const cleanup = notificationService.setupTapHandler();
    return cleanup;
  }, [isLoggedIn]);
};

export default useNotifications;
