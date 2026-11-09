import { router, Tabs } from 'expo-router';
import { Platform, Pressable, Text, View, type ColorValue } from 'react-native';

import { colors } from '../../ui/theme';

// Icônes en caractères : pas de dépendance supplémentaire.
const icon = (glyph: string) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ fontSize: 21, color, lineHeight: 25 }}>{glyph}</Text>;
  };

function RecordIcon() {
  return (
    <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: -14, borderWidth: 4, borderColor: colors.surface }}>
      <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: colors.mint }} />
    </View>
  );
}

function SettingsButton() {
  return (
    <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="Réglages" hitSlop={10} style={{ paddingHorizontal: 16 }}>
      <Text style={{ fontSize: 22, color: colors.text }}>⚙</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800', color: colors.text, fontSize: 18 },
        headerRight: SettingsButton,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          ...(Platform.OS === 'web' ? { height: 78, paddingTop: 6, paddingBottom: 22 } : null),
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil', headerTitle: 'MotMinute', tabBarIcon: icon('⌂') }} />
      <Tabs.Screen name="library" options={{ title: 'Bibliothèque', tabBarIcon: icon('▤') }} />
      <Tabs.Screen
        name="enregistrer"
        options={{ title: 'Enregistrer', tabBarIcon: RecordIcon, tabBarActiveTintColor: colors.faint }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push('/record');
          },
        }}
      />
      <Tabs.Screen name="summaries" options={{ title: 'Résumés IA', tabBarIcon: icon('✦') }} />
      <Tabs.Screen name="quotes" options={{ title: 'Citations', tabBarIcon: icon('❝') }} />
    </Tabs>
  );
}
