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
import useNotifications from './src/hooks/useNotifications';
import { useEasUpdateInfo } from './src/hooks/useEasUpdateInfo';
import RootNavigator from './src/navigation/RootNavigator';
import CallScreen from './src/components/call/CallScreen';
import IncomingCallOverlay from './src/components/call/IncomingCallOverlay';
import GroupCallScreen from './src/components/call/GroupCallScreen';

export default function App() {
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
              <NavigationContainer ref={navigationRef}>
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
