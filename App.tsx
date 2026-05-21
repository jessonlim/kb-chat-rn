import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { AuthContext, useAuthProvider } from './src/stores/authStore';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  const auth = useAuthProvider();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthContext.Provider value={auth}>
        <NavigationContainer>
          <RootNavigator />
          <StatusBar style="light" />
        </NavigationContainer>
        <Toast />
      </AuthContext.Provider>
    </GestureHandlerRootView>
  );
}
