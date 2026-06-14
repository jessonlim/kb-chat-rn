// Shows the "Approve this web login?" dialog and calls the approve/deny API.
//
// A web login that needs main-device approval reaches the phone TWO ways:
//   • a Socket.IO `web_login_request` event (when the app is open), and
//   • a push notification (so it still works when the app is backgrounded/closed).
// Both funnel through here so the dialog + API call live in one place, and a
// short de-dupe window stops a double prompt when both arrive together.

import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';
import { tStatic } from '../i18n/I18nContext';
import * as authService from './authService';

let lastToken: string | null = null;
let lastAt = 0;

export const promptWebLoginApproval = (token?: string): void => {
  if (!token) return;
  const now = Date.now();
  // Same login arriving via both socket + push within a few seconds → prompt once.
  if (token === lastToken && now - lastAt < 8000) return;
  lastToken = token;
  lastAt = now;

  Alert.alert(
    tStatic('qr.webReqTitle'),
    tStatic('qr.webReqMessage'),
    [
      {
        text: tStatic('qr.webReqDeny'),
        style: 'cancel',
        onPress: () => { authService.denyWebLogin(token).catch(() => {}); },
      },
      {
        text: tStatic('qr.webReqApprove'),
        onPress: () => {
          authService.approveWebLogin(token)
            .then(() => Toast.show({ type: 'success', text1: tStatic('qr.webLoginSuccess') }))
            .catch((e: any) =>
              Toast.show({ type: 'error', text1: e?.response?.data?.message || tStatic('qr.webLoginFailed') })
            );
        },
      },
    ],
  );
};
