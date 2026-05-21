import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { AuthContext, useAuthProvider } from './src/stores/authStore';
import { CallProvider } from './src/context/CallContext';
import RootNavigator from './src/navigation/RootNavigator';
import CallScreen from './src/components/call/CallScreen';
import IncomingCallOverlay from './src/components/call/IncomingCallOverlay';

export default function App() {
  const auth = useAuthProvider();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthContext.Provider value={auth}>
        <CallProvider>
          <NavigationContainer>
            <RootNavigator />
            <StatusBar style="light" />
          </NavigationContainer>
          {/* Call overlays — rendered above everything */}
          <CallScreen />
          <IncomingCallOverlay />
        </CallProvider>
        <Toast />
      </AuthContext.Provider>
    </GestureHandlerRootView>
  );
}
