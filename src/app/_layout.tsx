import { setAudioModeAsync } from 'expo-audio';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AppStateProvider } from '../state/AppState';
import { RootStack } from '../ui/RootStack';

export default function RootLayout() {
  useEffect(() => {
    // Lecture même quand l'iPhone est en mode silencieux.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }, []);
  return (
    <AppStateProvider>
      <StatusBar style="dark" />
      <RootStack />
    </AppStateProvider>
  );
}
