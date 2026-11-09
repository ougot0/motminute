import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useApp } from '../state/AppState';
import { colors } from './theme';

export function RootStack() {
  const { repo, fatalError } = useApp();
  if (fatalError) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Impossible d’ouvrir la bibliothèque</Text>
        <Text style={styles.body}>{fatalError}</Text>
      </View>
    );
  }
  if (!repo) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700', color: colors.text },
        headerBackTitle: 'Retour',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'MotMinute', headerLargeTitle: true }} />
      <Stack.Screen name="interview/[id]" options={{ title: '' }} />
      <Stack.Screen name="quotes" options={{ title: 'Citations' }} />
      <Stack.Screen name="settings" options={{ title: 'Réglages' }} />
      <Stack.Screen name="paywall" options={{ title: 'MotMinute Pro', presentation: 'modal' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24, gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.muted, textAlign: 'center' },
});
