import { Stack } from 'expo-router';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import { useApp } from '../state/AppState';
import { colors } from './theme';
import { WebDialogHost } from './WebDialogHost';

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
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {Platform.OS === 'web' ? (
        <View style={styles.webBanner} accessibilityRole="text">
          <Text style={styles.webBannerText}>Aperçu web · interview démo fictive · transcription et achats uniquement sur iPhone</Text>
        </View>
      ) : null}
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800', color: colors.text },
        headerTintColor: colors.accent,
        headerBackTitle: 'Retour',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="interview/[id]" options={{ title: '' }} />
      <Stack.Screen name="paywall" options={{ title: 'MotMinute Pro', presentation: 'modal' }} />
    </Stack>
      {Platform.OS === 'web' ? <WebDialogHost /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24, gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.muted, textAlign: 'center' },
  webBanner: { backgroundColor: colors.accent, paddingVertical: 5, paddingHorizontal: 12 },
  webBannerText: { fontSize: 11, color: colors.onInk, textAlign: 'center', fontWeight: '600' },
});
