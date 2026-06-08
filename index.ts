// LiveKit must register its WebRTC globals BEFORE any other RN-WebRTC code
// is imported. This patches `RTCPeerConnection`, `mediaDevices`, etc. onto
// the global scope so livekit-client (designed for the web) works in RN.
import { registerGlobals } from '@livekit/react-native';
registerGlobals();

import { registerRootComponent } from 'expo';

// Register the Android ongoing-call foreground service + its notification-action
// handlers. Must run at the top level (before the app renders) so background
// "End call" presses are caught. No-op on iOS / if Notifee is unavailable.
import { registerOngoingCallService } from './src/services/ongoingCallService';
registerOngoingCallService();

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
