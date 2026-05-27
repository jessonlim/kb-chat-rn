import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { AuthContext, useAuthProvider } from './src/stores/authStore';
import { CallProvider } from './src/context/CallContext';
import { GroupCallProvider } from './src/context/GroupCallContext';
import { I18nProvider } from './src/i18n/I18nContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { navigationRef } from './src/navigation/navigationRef';
import { linking } from './src/navigation/linking';
import useNotifications from './src/hooks/useNotifications';
import { useEasUpdateInfo } from './src/hooks/useEasUpdateInfo';
import RootNavigator from './src/navigation/RootNavigator';
import CallScreen from './src/components/call/CallScreen';
import IncomingCallOverlay from './src/components/call/IncomingCallOverlay';
import GroupCallScreen from './src/components/call/GroupCallScreen';
import { Sentry, initSentry } from './src/services/sentry';

// Initialise Sentry as early as possible — before any React code runs —
// so we catch crashes during initial render too. The init is a no-op if
// no DSN is configured (e.g. in development without env vars).
initSentry();

function App() {
  const auth = useAuthProvider();

  // Initialize push notifications when logged in
  useNotifications(!!auth.user);

  // EAS Update visibility — toasts current build state on launch and
  // when a new OTA update finishes downloading. Plain hook with no UI.
  useEasUpdateInfo();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <I18nProvider>
        <AuthContext.Provider value={auth}>
          <CallProvider>
            <GroupCallProvider>
              <NavigationContainer ref={navigationRef} linking={linking}>
                <RootNavigator />
                <StatusBar style="light" />
              </NavigationContainer>
              {/* Call overlays — rendered above everything */}
              <CallScreen />
              <IncomingCallOverlay />
              <GroupCallScreen />
            </GroupCallProvider>
          </CallProvider>
          <Toast />
        </AuthContext.Provider>
      </I18nProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

// Sentry.wrap(App) auto-installs an ErrorBoundary that captures and
// reports any uncaught render errors to Sentry, then shows a fallback
// UI. Without this wrap, render-time crashes would still report (via
// the unhandled exception integration) but the user would see a blank
// white screen instead of a "Something went wrong" message.
export default Sentry.wrap(App);
