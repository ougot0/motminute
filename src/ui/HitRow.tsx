import { Pressable, StyleSheet, Text, View } from 'react-native';

import { matchLabel, type SearchHit } from '../lib/search';
import { Highlighted, TimeChip } from './components';
import { colors, fonts, radius, space } from './theme';

/** Un résultat de recherche : minutage réel, texte exact du bloc, mots surlignés. */
export function HitRow({ hit, onPress, showTitle }: { hit: SearchHit; onPress: () => void; showTitle?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      testID={`hit-${hit.segmentId}`}
      accessibilityRole="button"
      accessibilityHint="Ouvre l’audio au début du passage"
      style={({ pressed }) => [styles.hit, pressed && { backgroundColor: colors.surfaceAlt }]}
    >
      <View style={styles.hitTop}>
        <TimeChip seconds={hit.start} large />
        {showTitle ? (
          <Text style={styles.hitTitle} numberOfLines={1}>
            {hit.interviewTitle}
          </Text>
        ) : null}
      </View>
      <Highlighted text={`« ${hit.text} »`} ranges={hit.highlights.map(([a, b]) => [a + 2, b + 2] as [number, number])} style={styles.hitText} />
      <Text style={styles.hitMeta}>{matchLabel(hit.matchType)}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.sm,
  },
  hitTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  hitTitle: { flex: 1, fontSize: 14, color: colors.muted, fontWeight: '600' },
  hitText: { fontFamily: fonts.serif, fontSize: 18, lineHeight: 26, color: colors.text },
  hitMeta: { fontSize: 12, color: colors.faint },
});
