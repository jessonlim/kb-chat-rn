import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { AuthContext, useAuthProvider } from './src/stores/authStore';
import { CallProvider } from './src/context/CallContext';
import { I18nProvider } from './src/i18n/I18nContext';
import { navigationRef } from './src/navigation/navigationRef';
import useNotifications from './src/hooks/useNotifications';
import RootNavigator from './src/navigation/RootNavigator';
import CallScreen from './src/components/call/CallScreen';
import IncomingCallOverlay from './src/components/call/IncomingCallOverlay';

export default function App() {
  const auth = useAuthProvider();

  // Initialize push notifications when logged in
  useNotifications(!!auth.user);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nProvider>
        <AuthContext.Provider value={auth}>
          <CallProvider>
            <NavigationContainer ref={navigationRef}>
              <RootNavigator />
              <StatusBar style="light" />
            </NavigationContainer>
            {/* Call overlays — rendered above everything */}
            <CallScreen />
            <IncomingCallOverlay />
          </CallProvider>
          <Toast />
        </AuthContext.Provider>
      </I18nProvider>
    </GestureHandlerRootView>
  );
}
