import { Tabs } from 'expo-router';
import { Platform, Text, type ColorValue } from 'react-native';

import { colors } from '../../ui/theme';

// Icônes en caractères : pas de dépendance supplémentaire.
const icon = (glyph: string) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ fontSize: 22, color, lineHeight: 26 }}>{glyph}</Text>;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800', color: colors.text, fontSize: 18 },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          ...(Platform.OS === 'web' ? { height: 64, paddingTop: 6, paddingBottom: 8 } : null),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Accueil', headerTitle: 'MotMinute', tabBarIcon: icon('⌂') }} />
      <Tabs.Screen name="library" options={{ title: 'Bibliothèque', tabBarIcon: icon('▤') }} />
      <Tabs.Screen name="search" options={{ title: 'Recherche', tabBarIcon: icon('⌕') }} />
      <Tabs.Screen name="quotes" options={{ title: 'Citations', tabBarIcon: icon('❝') }} />
      <Tabs.Screen name="settings" options={{ title: 'Réglages', tabBarIcon: icon('⚙') }} />
    </Tabs>
  );
}
