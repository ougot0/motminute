import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useApp } from '../state/AppState';
import { generateSummary, loadSummary, summaryStatus, summaryStatusMessage, type Summary, type SummaryStatus } from '../services/summary';
import { Button, Card } from './components';
import { colors, space } from './theme';

/** Résumé IA de l'interview (sur l'iPhone, gratuit). */
export function SummaryCard({ interviewId, title }: { interviewId: string; title: string }) {
  const { repo, version } = useApp();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState<SummaryStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!repo) return;
    let alive = true;
    loadSummary(repo, interviewId).then((s) => alive && setSummary(s));
    summaryStatus().then((s) => alive && setStatus(s));
    return () => {
      alive = false;
    };
  }, [repo, interviewId, version]);

  const run = async () => {
    if (!repo) return;
    setBusy(true);
    setError(null);
    try {
      setSummary(await generateSummary(repo, interviewId, title));
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const canGenerate = status === 'ready';
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>Résumé IA</Text>
        {summary?.example ? <Text style={styles.badge}>EXEMPLE</Text> : null}
      </View>
      {summary ? (
        <>
          <Text style={styles.text} numberOfLines={open ? undefined : 4} testID="summary-text">
            {summary.text}
          </Text>
          <Text style={styles.link} onPress={() => setOpen(!open)} accessibilityRole="button">
            {open ? 'Réduire' : 'Lire tout le résumé'}
          </Text>
          <Text style={styles.small}>
            {summary.example ? 'Résumé d’exemple rédigé pour la démo. ' : `${summary.engine}. `}À vérifier avec l’audio avant publication.
          </Text>
        </>
      ) : (
        <Text style={styles.small}>{status ? summaryStatusMessage(status) : 'Vérification…'}</Text>
      )}
      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.small}>Résumé en cours sur l’iPhone…</Text>
        </View>
      ) : canGenerate ? (
        <Button label={summary && !summary.example ? 'Refaire le résumé' : 'Résumer l’interview (gratuit)'} variant="secondary" onPress={run} />
      ) : null}
      {error ? <Text style={[styles.small, { color: colors.danger }]}>{error}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, padding: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  badge: { fontSize: 10, fontWeight: '800', color: colors.warn, backgroundColor: colors.warnSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  text: { fontSize: 15, color: colors.text, lineHeight: 22 },
  link: { fontSize: 14, fontWeight: '700', color: colors.accent },
  small: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  busy: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
