// Shared navigation ref — allows navigating from outside React components
// (e.g. notification tap handlers, background services).

import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef<any>();
