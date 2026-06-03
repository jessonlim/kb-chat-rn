// QR scanner — thin wrapper (audit M4).
//
// The navigator (MainTabs) eager-imports every screen at module load,
// which for a logged-in user is effectively app launch. If this file
// directly imported expo-camera, that native module would resolve at
// launch — and any future failure/absence of it would white-screen the
// whole app on startup.
//
// Instead, the actual camera UI lives in ScanQRScreenInner.tsx, which we
// `require()` lazily the first time this screen renders (i.e. when the
// user opens the scanner). So expo-camera only resolves on demand. If it
// ever fails to load, the failure is contained to this one screen.

import React, { useMemo } from 'react';

interface Props {
  navigation: any;
  route?: any;
}

const ScanQRScreen = (props: Props) => {
  // Resolve the camera-bearing implementation lazily, once, on first
  // render. `require()` (not `import`) is what keeps expo-camera out of
  // the launch path.
  const Inner = useMemo(
    () => require('./ScanQRScreenInner').default as React.ComponentType<Props>,
    []
  );
  return <Inner {...props} />;
};

export default ScanQRScreen;
