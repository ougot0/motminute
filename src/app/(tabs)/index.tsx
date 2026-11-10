import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Interview } from '../../data/repository';
import type { SearchHit } from '../../lib/search';
import { useApp } from '../../state/AppState';
import { Card, ProgressBar } from '../../ui/components';
import { HitRow } from '../../ui/HitRow';
import { InterviewRow } from '../../ui/InterviewRow';
import { SUGGESTIONS } from '../../ui/suggestions';
import { colors, HIT, radius, space } from '../../ui/theme';
import { useAddInterview } from '../../ui/useImport';
import { useSearch } from '../../ui/useSearch';

/** Accueil : enregistrer, chercher, reprendre les dernières interviews. */
export default function HomeScreen() {
  const { repo, version, quota, job } = useApp();
  const { importFile, importing } = useAddInterview();
  const [recent, setRecent] = useState<Interview[]>([]);
  const [counts, setCounts] = useState({ interviews: 0, quotes: 0 });
  const [query, setQuery] = useState('');
  const results = useSearch(query);

  useFocusEffect(
    useCallback(() => {
      if (!repo) return;
      let alive = true;
      Promise.all([repo.listInterviews(), repo.listQuotes()]).then(([list, q]) => {
        if (!alive) return;
        setRecent(list.slice(0, 3));
        setCounts({ interviews: list.length, quotes: q.length });
      });
      return () => {
        alive = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repo, version]),
  );

  const openHit = (h: SearchHit) =>
    router.push({ pathname: '/interview/[id]', params: { id: h.interviewId, t: String(h.start), seg: String(h.segmentId) } });

  const searchBox = (
    <View style={styles.searchBox}>
      <Text style={styles.searchIcon}>⌕</Text>
      <TextInput
        testID="library-search"
        value={query}
        onChangeText={setQuery}
        placeholder="Retrouver une citation…"
        placeholderTextColor={colors.faint}
        style={styles.searchInput}
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoCorrect={false}
      />
    </View>
  );

  if (results.active) {
    return (
      <View style={styles.screen}>
        <FlatList
          data={results.hits}
          keyExtractor={(h) => `${h.interviewId}:${h.segmentId}`}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={<View style={{ paddingBottom: space.sm }}>{searchBox}</View>}
          ListEmptyComponent={
            results.busy ? undefined : (
              <View style={styles.empty} testID="search-empty">
                <Text style={styles.emptyTitle}>Aucun passage pertinent</Text>
                <Text style={styles.emptyText}>Essayez d’autres mots ou une expression entre guillemets.</Text>
              </View>
            )
          }
          renderItem={({ item }) => <HitRow hit={item} onPress={() => openHit(item)} showTitle />}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable
        testID="home-record"
        onPress={() => router.push('/record')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.hero, pressed && { opacity: 0.9 }]}
      >
        <View style={styles.heroDot}>
          <View style={styles.heroDotInner} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.heroTitle}>Enregistrer une interview</Text>
          <Text style={styles.heroText}>Tout ce qui est dit est enregistré, transcrit, puis cherchable.</Text>
        </View>
      </Pressable>
      <Pressable onPress={importFile} disabled={importing} accessibilityRole="button" style={styles.importLink}>
        <Text style={styles.link}>{importing ? 'Import…' : 'ou importer un fichier audio'}</Text>
      </Pressable>

      {searchBox}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {SUGGESTIONS.map((q) => (
          <Pressable key={q} onPress={() => setQuery(q)} accessibilityRole="button" style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}>
            <Text style={styles.chipText}>« {q} »</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.stats}>
        <Stat value={counts.interviews} label="interviews" />
        <Stat value={counts.quotes} label="citations" />
        <Stat value={Math.round(quota.usedSeconds / 60)} label="min transcrites" />
      </View>

      {!quota.isPro ? (
        <Card style={styles.pro}>
          <View style={styles.proHead}>
            <Text style={styles.proTitle}>Version gratuite</Text>
            <Text style={styles.link} onPress={() => router.push('/paywall')} accessibilityRole="link">
              Passer à Pro
            </Text>
          </View>
          <Text style={styles.proText}>
            {Math.floor((quota.remainingSeconds ?? 0) / 60)} min de transcription restantes sur 60. Pro : transcriptions illimitées et export de toutes les citations.
          </Text>
          <ProgressBar value={quota.usedSeconds / (quota.limitSeconds ?? 1)} />
        </Card>
      ) : null}

      <View style={styles.sectionHead}>
        <Text style={styles.section}>Récentes</Text>
        <Text style={styles.link} onPress={() => router.push('/library')} accessibilityRole="link">
          Tout voir
        </Text>
      </View>
      {recent.map((it) => (
        <InterviewRow
          key={it.id}
          it={it}
          progress={job?.interviewId === it.id ? job.progress : undefined}
          onPress={() => router.push({ pathname: '/interview/[id]', params: { id: it.id } })}
        />
      ))}
      {!recent.length ? <Text style={styles.emptyText}>Votre première interview apparaîtra ici.</Text> : null}
    </ScrollView>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.lg, backgroundColor: colors.accent, borderRadius: radius.lg, padding: space.lg },
  heroDot: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroDotInner: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.mint },
  heroTitle: { fontSize: 18, fontWeight: '800', color: colors.onInk },
  heroText: { fontSize: 14, color: colors.onInk, opacity: 0.85, lineHeight: 19 },
  importLink: { alignSelf: 'center', paddingVertical: 4 },
  link: { fontSize: 14, fontWeight: '700', color: colors.accent },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    minHeight: HIT + 4,
  },
  searchIcon: { fontSize: 20, color: colors.accent, marginRight: space.sm },
  searchInput: { flex: 1, fontSize: 17, color: colors.text, paddingVertical: space.md, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : null) },
  chips: { flexDirection: 'row', gap: space.sm },
  chip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: space.md, minHeight: 36, justifyContent: 'center' },
  chipText: { fontSize: 14, color: colors.accent, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: space.md, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, color: colors.muted },
  pro: { gap: 6, padding: space.md, borderColor: colors.accentSoft, backgroundColor: colors.surface },
  proHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  proTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  proText: { fontSize: 14, color: colors.muted, lineHeight: 19 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm },
  section: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  empty: { paddingVertical: space.xxl, alignItems: 'center', gap: space.sm },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 15, color: colors.muted, textAlign: 'center' },
});
