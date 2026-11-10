import { setAudioModeAsync } from 'expo-audio';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import { AppStateProvider, useApp } from '../state/AppState';
import { LaunchOverlay } from '../ui/LaunchOverlay';
import { RootStack } from '../ui/RootStack';

/** L'accueil est affichable dès que la bibliothèque locale est ouverte. */
function Launch() {
  const { repo, fatalError } = useApp();
  return <LaunchOverlay ready={Boolean(repo || fatalError)} />;
}

export default function RootLayout() {
  useEffect(() => {
    // Lecture même quand l'iPhone est en mode silencieux.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }, []);
  return (
    <AppStateProvider>
      <View style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <RootStack />
        <Launch />
      </View>
    </AppStateProvider>
  );
}
