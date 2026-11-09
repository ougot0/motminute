import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SAMPLES } from '../data/samples';
import { formatDuration } from '../lib/time';
import { colors, fonts, radius, space } from '../ui/theme';
import { useAddInterview } from '../ui/useImport';

/** Aperçu web : remplace l'app Fichiers par un choix de fichiers d'exemple. */
export default function SamplesScreen() {
  const { importSample } = useAddInterview();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.note}>
        Aperçu web : sur iPhone, ce bouton ouvre l’app Fichiers. Ici, choisissez un fichier d’exemple (interview fictive, voix de synthèse).
      </Text>
      <Text style={styles.section}>Fichiers d’exemple</Text>
      {SAMPLES.map((s) => (
        <Pressable
          key={s.id}
          testID={`sample-${s.id}`}
          accessibilityRole="button"
          onPress={async () => {
            router.back();
            await importSample(s);
          }}
          style={({ pressed }) => [styles.file, pressed && { backgroundColor: colors.accentSoft }]}
        >
          <View style={styles.icon}>
            <Text style={styles.iconText}>m4a</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.name}>{s.fileName}</Text>
            <Text style={styles.meta}>
              {formatDuration(s.durationSec)} · {s.title}
            </Text>
            <Text style={styles.hint}>{s.hint}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md },
  note: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  section: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: space.sm },
  file: { flexDirection: 'row', gap: space.md, alignItems: 'center', padding: space.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg },
  icon: { width: 48, height: 56, borderRadius: radius.sm, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontFamily: fonts.mono, fontSize: 12, fontWeight: '700', color: colors.accent },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.muted },
  hint: { fontSize: 13, color: colors.accent },
});
