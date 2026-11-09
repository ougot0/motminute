import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { SearchHit } from '../../lib/search';
import { useApp } from '../../state/AppState';
import { HitRow } from '../../ui/HitRow';
import { colors, HIT, radius, space } from '../../ui/theme';
import { useSearch } from '../../ui/useSearch';
import { SUGGESTIONS } from '../../ui/suggestions';

const TIPS = [
  'Décrivez l’idée avec vos mots : « pourquoi il a démissionné » retrouve « j’ai quitté mon poste parce que… ».',
  'Mettez une expression entre guillemets pour la retrouver mot pour mot.',
  'Accents et majuscules sont ignorés.',
];

export default function SearchScreen() {
  const { semanticEnabled } = useApp();
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const results = useSearch(query);

  const open = (h: SearchHit) => {
    const q = query.trim();
    if (q) setRecent((r) => [q, ...r.filter((x) => x !== q)].slice(0, 5));
    router.push({ pathname: '/interview/[id]', params: { id: h.interviewId, t: String(h.start), seg: String(h.segmentId) } });
  };

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.sm }}>
      <View style={styles.box}>
        <Text style={styles.icon}>⌕</Text>
        <TextInput
          testID="search-input"
          value={query}
          onChangeText={setQuery}
          placeholder="Une idée, une phrase, un mot…"
          placeholderTextColor={colors.faint}
          style={styles.input}
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>
      <Text style={styles.mode}>
        {semanticEnabled ? 'Textuelle + synonymes + sens (expérimental)' : 'Recherche textuelle avec synonymes français'} · {results.searchedCount} blocs
      </Text>
      {results.active && results.hits.length ? (
        <Text style={styles.count}>
          {results.hits.length} passage{results.hits.length > 1 ? 's' : ''}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={results.active ? results.hits : []}
        keyExtractor={(h) => `${h.interviewId}:${h.segmentId}`}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        renderItem={({ item }) => <HitRow hit={item} onPress={() => open(item)} showTitle />}
        ListEmptyComponent={
          results.active ? (
            results.busy ? undefined : (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Aucun passage pertinent</Text>
                <Text style={styles.emptyText}>Essayez une autre formulation ou une expression entre guillemets.</Text>
              </View>
            )
          ) : (
            <View style={{ gap: space.lg }}>
              {recent.length ? <Group title="Récentes" items={recent} onPick={setQuery} /> : null}
              <Group title="Essayez" items={SUGGESTIONS} onPick={setQuery} />
              <View style={{ gap: space.sm }}>
                <Text style={styles.section}>Astuces</Text>
                {TIPS.map((t) => (
                  <Text key={t} style={styles.tip}>
                    {t}
                  </Text>
                ))}
              </View>
            </View>
          )
        }
      />
    </View>
  );
}

function Group({ title, items, onPick }: { title: string; items: string[]; onPick: (q: string) => void }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text style={styles.section}>{title}</Text>
      {items.map((q) => (
        <Pressable key={q} onPress={() => onPick(q)} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}>
          <Text style={styles.rowText}>« {q} »</Text>
          <Text style={styles.arrow}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.lg, gap: space.sm, paddingBottom: space.xxl },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.accent,
    paddingHorizontal: space.md,
    minHeight: HIT + 6,
  },
  icon: { fontSize: 20, color: colors.accent, marginRight: space.sm },
  input: { flex: 1, fontSize: 17, color: colors.text, paddingVertical: space.md, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : null) },
  mode: { fontSize: 13, color: colors.muted },
  count: { fontSize: 13, fontWeight: '700', color: colors.text },
  section: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: HIT,
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  rowText: { flex: 1, fontSize: 15, color: colors.accent, fontWeight: '600' },
  arrow: { fontSize: 20, color: colors.faint },
  tip: { fontSize: 14, color: colors.text, lineHeight: 20 },
  empty: { paddingVertical: space.xxl, alignItems: 'center', gap: space.sm },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 15, color: colors.muted, textAlign: 'center' },
});
