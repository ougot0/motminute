import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { SavedQuote } from '../../data/repository';
import { formatQuote } from '../../lib/quote';
import { useApp } from '../../state/AppState';
import { copyText } from '../../ui/clipboard';
import { Alert } from '../../ui/alert';
import { TimeChip, useToast } from '../../ui/components';
import { colors, fonts, HIT, radius, space } from '../../ui/theme';

export default function QuotesScreen() {
  const { repo, version, bump, isPro } = useApp();
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const toast = useToast();

  useFocusEffect(
    useCallback(() => {
      if (!repo) return;
      let alive = true;
      repo.listQuotes().then((q) => alive && setQuotes(q));
      return () => {
        alive = false;
      };
      // `version` change à chaque modification des données : on recharge.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repo, version]),
  );

  const open = (q: SavedQuote) =>
    router.push({ pathname: '/interview/[id]', params: { id: q.interviewId, t: String(q.start), ...(q.segmentId ? { seg: String(q.segmentId) } : {}) } });

  return (
    <View style={styles.screen}>
      <FlatList
        ListHeaderComponent={
          quotes.length ? (
            <Pressable
              accessibilityRole="button"
              onPress={async () => {
                if (!isPro) return router.push({ pathname: '/paywall', params: { reason: 'export' } });
                const ok = await copyText(quotes.map((q) => formatQuote({ text: q.text, interviewTitle: q.interviewTitle, start: q.start })).join('\n\n'));
                toast.show(ok ? `${quotes.length} citations copiées` : 'Copie bloquée par le navigateur');
              }}
              style={({ pressed }) => [styles.exportBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.exportText}>Copier toutes les citations</Text>
              {!isPro ? <Text style={styles.proBadge}>PRO</Text> : null}
            </Pressable>
          ) : undefined
        }
        data={quotes}
        keyExtractor={(q) => String(q.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Aucune citation enregistrée</Text>
            <Text style={styles.emptyText}>Dans une transcription, touchez un bloc puis « Enregistrer ».</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card} testID={`quote-${item.id}`}>
            <Text style={styles.text}>« {item.text} »</Text>
            <View style={styles.metaRow}>
              <TimeChip seconds={item.start} onPress={() => open(item)} />
              <Text style={styles.title} numberOfLines={2}>
                {item.interviewTitle}
              </Text>
            </View>
            <View style={styles.actions}>
              <Action label="▶ Réécouter" onPress={() => open(item)} />
              <Action
                label="Copier"
                onPress={async () => {
                  const ok = await copyText(formatQuote({ text: item.text, interviewTitle: item.interviewTitle, start: item.start }));
                  toast.show(ok ? 'Citation copiée avec son minutage' : 'Copie bloquée par le navigateur');
                }}
              />
              <Action
                label="Retirer"
                onPress={() =>
                  Alert.alert('Retirer cette citation ?', undefined, [
                    { text: 'Annuler', style: 'cancel' },
                    {
                      text: 'Retirer',
                      style: 'destructive',
                      onPress: async () => {
                        await repo?.deleteQuote(item.id);
                        bump();
                      },
                    },
                  ])
                }
              />
            </View>
          </View>
        )}
      />
      {toast.node}
    </View>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.border }]}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.lg, gap: space.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.md,
  },
  text: { fontFamily: fonts.serif, fontSize: 18, lineHeight: 27, color: colors.text },
  exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, minHeight: HIT, borderRadius: radius.md, borderWidth: 1, borderColor: colors.accent },
  exportText: { fontSize: 15, fontWeight: '700', color: colors.accent },
  proBadge: { fontSize: 11, fontWeight: '800', color: colors.onInk, backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { flex: 1, fontSize: 14, color: colors.muted, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  action: { minHeight: HIT - 4, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, justifyContent: 'center' },
  actionText: { fontSize: 15, fontWeight: '600', color: colors.text },
  empty: { paddingVertical: space.xxl, alignItems: 'center', gap: space.sm },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 15, color: colors.muted, textAlign: 'center' },
});
