import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Interview } from '../../data/repository';
import { formatDuration } from '../../lib/time';
import { loadSummary, summaryStatus, summaryStatusMessage, type Summary, type SummaryStatus } from '../../services/summary';
import { useApp } from '../../state/AppState';
import { colors, radius, space } from '../../ui/theme';

type Row = { it: Interview; summary: Summary | null };

/** Tous les résumés IA, interview par interview. */
export default function SummariesScreen() {
  const { repo, version } = useApp();
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<SummaryStatus | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!repo) return;
      let alive = true;
      (async () => {
        const list = (await repo.listInterviews()).filter((i) => i.status === 'done');
        const r = await Promise.all(list.map(async (it) => ({ it, summary: await loadSummary(repo, it.id) })));
        if (alive) setRows(r);
      })();
      summaryStatus().then((s) => alive && setStatus(s));
      return () => {
        alive = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repo, version]),
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.it.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Text style={styles.introTitle}>L’essentiel de chaque interview</Text>
            <Text style={styles.introText}>
              Calculé sur l’iPhone par Apple Intelligence : gratuit, et le texte ne quitte pas l’appareil.
              {status && status !== 'ready' ? ` ${summaryStatusMessage(status)}` : ''}
            </Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>Les interviews transcrites apparaîtront ici.</Text>}
        renderItem={({ item: { it, summary } }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/interview/[id]', params: { id: it.id } })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.surfaceAlt }]}
          >
            <View style={styles.head}>
              <Text style={styles.title} numberOfLines={2}>
                {it.title}
              </Text>
              {summary?.example ? <Text style={styles.badge}>EXEMPLE</Text> : null}
            </View>
            <Text style={styles.meta}>{formatDuration(it.durationSec)}</Text>
            {summary ? (
              <Text style={styles.text} numberOfLines={6}>
                {summary.text}
              </Text>
            ) : (
              <Text style={styles.todo}>{status === 'ready' ? 'Pas encore résumée · ouvrir pour résumer' : 'Pas de résumé'}</Text>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.lg, gap: space.sm, paddingBottom: space.xxl },
  intro: { gap: 4, paddingBottom: space.sm },
  introTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  introText: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: space.lg, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  badge: { fontSize: 10, fontWeight: '800', color: colors.warn, backgroundColor: colors.warnSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  meta: { fontSize: 13, color: colors.muted },
  text: { fontSize: 15, color: colors.text, lineHeight: 22 },
  todo: { fontSize: 14, color: colors.accent, fontWeight: '600' },
  empty: { fontSize: 15, color: colors.muted, textAlign: 'center', paddingVertical: space.xxl },
});
