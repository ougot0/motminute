import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Interview, Segment } from '../../data/repository';
import { formatQuote } from '../../lib/quote';
import { contextStart, formatDate, formatDuration, formatTimestamp } from '../../lib/time';
import { audioExists, audioSourceFor } from '../../services/audioFiles';
import { useApp } from '../../state/AppState';
import { copyText } from '../../ui/clipboard';
import { Alert } from '../../ui/alert';
import { Button, Card, ProgressBar, StatusBadge, TextPrompt, TimeChip, useToast } from '../../ui/components';
import { HitRow } from '../../ui/HitRow';
import { PlayerBar, useInterviewPlayer } from '../../ui/Player';
import { colors, fonts, HIT, radius, space } from '../../ui/theme';
import { useSearch } from '../../ui/useSearch';

type Params = { id: string; t?: string; seg?: string; autostart?: string };

export default function InterviewScreen() {
  const params = useLocalSearchParams<Params>();
  const id = String(params.id);
  const { repo, version, bump, job, startTranscription, cancelTranscription, quota } = useApp();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const listRef = useRef<FlatList<Segment>>(null);

  const [interview, setInterview] = useState<Interview | null | undefined>(undefined);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(params.seg ? Number(params.seg) : null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Segment | null>(null);

  useEffect(() => {
    if (!repo) return;
    let alive = true;
    Promise.all([repo.getInterview(id), repo.listSegments(id)]).then(([it, segs]) => {
      if (!alive) return;
      setInterview(it);
      setSegments(segs);
    });
    return () => {
      alive = false;
    };
  }, [repo, id, version]);

  const audioRef = interview?.audioRef;
  const source = useMemo(() => (audioRef ? audioSourceFor(audioRef) : null), [audioRef]);
  const controls = useInterviewPlayer(source);
  const results = useSearch(query, id);

  const scrollTo = useCallback(
    (segId: number) => {
      const index = segments.findIndex((s) => s.id === segId);
      if (index >= 0) setTimeout(() => listRef.current?.scrollToIndex({ index, viewPosition: 0.25, animated: true }), 250);
    },
    [segments],
  );

  // Ouverture depuis un résultat : positionne le lecteur au début réel du passage.
  const applied = useRef<string | null>(null);
  useEffect(() => {
    if (!interview || params.t === undefined || !segments.length) return;
    const key = `${params.t}|${params.seg ?? ''}`;
    if (applied.current === key) return;
    applied.current = key;
    const target = params.seg ? segments.find((s) => s.id === Number(params.seg)) : undefined;
    const start = target ? target.start : Number(params.t);
    // selectedId est déjà initialisé depuis params.seg
    controls.seek(start, false);
    if (target) scrollTo(target.id);
  }, [interview, params.t, params.seg, segments, controls, scrollTo]);

  // Transcription automatique juste après l'import.
  const autostarted = useRef(false);
  const begin = useCallback(async () => {
    const r = await startTranscription(id);
    if (r.kind === 'quota') router.push({ pathname: '/paywall', params: { reason: 'quota' } });
    else if (r.kind === 'unavailable') Alert.alert('Transcription indisponible', r.message);
    else if (r.kind === 'busy') Alert.alert('Patientez', 'Une autre transcription est en cours.');
    else if (r.kind === 'done') toast.show('Transcription terminée');
  }, [id, startTranscription, toast]);

  useEffect(() => {
    if (params.autostart === '1' && interview?.status === 'pending' && !autostarted.current) {
      autostarted.current = true;
      begin();
    }
  }, [params.autostart, interview?.status, begin]);

  const playingId = useMemo(() => {
    const t = controls.position;
    let current: Segment | undefined;
    for (const s of segments) {
      if (s.start <= t + 0.05) current = s;
      else break;
    }
    return current && t <= current.end + 2 ? current.id : null;
  }, [controls.position, segments]);

  const selected = segments.find((s) => s.id === selectedId) ?? null;

  const copy = async (s: Segment) => {
    if (!interview) return;
    const ok = await copyText(formatQuote({ text: s.text, interviewTitle: interview.title, start: s.start }));
    toast.show(ok ? 'Citation copiée avec son minutage' : 'Copie bloquée par le navigateur');
  };

  const save = async (s: Segment) => {
    if (!repo || !interview) return;
    await repo.saveQuote({ interviewId: interview.id, segmentId: s.id, text: s.text, start: s.start, end: s.end, interviewTitle: interview.title });
    bump();
    toast.show('Citation enregistrée');
  };

  if (interview === undefined) return <View style={styles.screen} />;
  if (interview === null) {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.emptyTitle}>Interview introuvable</Text>
        <Button label="Retour à la bibliothèque" variant="secondary" onPress={() => router.replace('/')} />
      </View>
    );
  }

  const myJob = job?.interviewId === id ? job : null;
  const hasAudio = audioExists(interview.audioRef);

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.md }}>
      <Text style={styles.title} testID="interview-title">
        {interview.title}
      </Text>
      <Text style={styles.meta}>
        {formatDuration(interview.durationSec)} · ajoutée le {formatDate(interview.createdAt)}
        {interview.source === 'demo' ? ' · interview fictive, voix de synthèse' : ''}
      </Text>
      {!hasAudio ? (
        <Card style={{ backgroundColor: colors.dangerSoft }}>
          <Text style={styles.cardText}>Le fichier audio de cette interview est introuvable sur l’iPhone.</Text>
        </Card>
      ) : null}
      {interview.status !== 'done' ? (
        <StatusCard interview={interview} job={myJob} quotaRemaining={quota.remainingSeconds} onStart={begin} onCancel={cancelTranscription} />
      ) : (
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            testID="interview-search"
            value={query}
            onChangeText={setQuery}
            placeholder="Chercher dans cette interview"
            placeholderTextColor={colors.faint}
            style={styles.searchInput}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>
      )}
    </View>
  );

  const selectedPanel = selected ? (
    <View style={styles.panel} testID="selected-panel">
      <View style={styles.panelTop}>
        <TimeChip seconds={selected.start} onPress={() => controls.seek(selected.start, true)} testID="act-play" />
        <Text style={styles.panelText} numberOfLines={2}>
          {selected.text}
        </Text>
        <Pressable onPress={() => setSelectedId(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer le passage" style={styles.close}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
      <View style={styles.panelActions}>
        <Action
          label="⟲ −5 s"
          a11y="Écouter avec 5 secondes de contexte avant la citation"
          onPress={() => controls.seek(contextStart(selected.start), true)}
          testID="context-play"
        />
        <Action label="Copier" onPress={() => copy(selected)} testID="act-copy" />
        <Action label="Enregistrer" onPress={() => save(selected)} testID="act-save" />
        <Action label="Corriger" onPress={() => setEditing(selected)} testID="act-edit" />
      </View>
    </View>
  ) : null;

  return (
    <View style={styles.screen}>
      {results.active ? (
        <FlatList
          data={results.hits}
          keyExtractor={(h) => String(h.segmentId)}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          ListEmptyComponent={
            results.busy ? undefined : (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Aucun passage pertinent</Text>
                <Text style={styles.emptyText}>Aucun bloc de cette interview ne correspond à « {query.trim()} ».</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <HitRow
              hit={item}
              onPress={() => {
                setQuery('');
                setSelectedId(item.segmentId);
                controls.seek(item.start, false);
                scrollTo(item.segmentId);
              }}
            />
          )}
        />
      ) : (
        <FlatList
          ref={listRef}
          data={segments}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          extraData={`${selectedId}|${playingId}`}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
            setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.25 }), 120);
          }}
          renderItem={({ item }) => (
            <SegmentRow
              s={item}
              selected={item.id === selectedId}
              playing={item.id === playingId}
              onSelect={() => setSelectedId(item.id === selectedId ? null : item.id)}
              onPlay={() => {
                setSelectedId(item.id);
                controls.seek(item.start, true);
              }}
            />
          )}
        />
      )}
      <View style={{ paddingBottom: Math.max(insets.bottom, space.md), backgroundColor: colors.surface }}>
        {selectedPanel}
        <PlayerBar controls={controls} />
      </View>
      {toast.node}
      <TextPrompt
        visible={editing !== null}
        title={`Corriger le bloc ${editing ? formatTimestamp(editing.start) : ''}`}
        hint={
          editing
            ? `Le minutage reste ${formatTimestamp(editing.start)} – ${formatTimestamp(editing.end)} : seul le texte change.${editing.edited ? '\nTexte d’origine : « ' + editing.originalText + ' »' : ''}`
            : undefined
        }
        initial={editing?.text ?? ''}
        multiline
        onCancel={() => setEditing(null)}
        onConfirm={async (v) => {
          if (editing && repo) {
            await repo.updateSegmentText(editing.id, v);
            bump();
          }
          setEditing(null);
        }}
      />
    </View>
  );
}

function StatusCard({
  interview,
  job,
  quotaRemaining,
  onStart,
  onCancel,
}: {
  interview: Interview;
  job: { phase: 'model' | 'transcribing'; progress: number } | null;
  quotaRemaining: number | null;
  onStart: () => void;
  onCancel: () => void;
}) {
  if (job || interview.status === 'processing') {
    const phase = job?.phase === 'model' ? 'Téléchargement du modèle français (une seule fois)…' : 'Transcription sur l’iPhone…';
    const progress = job?.progress ?? interview.progress;
    return (
      <Card style={{ gap: space.md }}>
        <StatusBadge status="processing" progress={progress} />
        <Text style={styles.cardText}>{phase} Gardez MotMinute ouverte pendant le traitement.</Text>
        <ProgressBar value={progress} />
        <Button label="Interrompre" variant="secondary" onPress={onCancel} />
      </Card>
    );
  }
  if (interview.status === 'error' || interview.status === 'interrupted') {
    return (
      <Card style={{ gap: space.md }}>
        <StatusBadge status={interview.status} />
        <Text style={styles.cardText}>{interview.errorMessage ?? 'Le traitement n’a pas abouti.'}</Text>
        <Text style={styles.cardHint}>L’audio est conservé : inutile de le réimporter.</Text>
        <Button label="Relancer la transcription" onPress={onStart} testID="retry" />
      </Card>
    );
  }
  return (
    <Card style={{ gap: space.md }}>
      <StatusBadge status="pending" />
      <Text style={styles.cardText}>
        Cette interview n’est pas encore transcrite.
        {quotaRemaining !== null ? ` Il vous reste ${formatDuration(quotaRemaining)} de transcription gratuite.` : ''}
      </Text>
      <Button label="Transcrire" onPress={onStart} testID="start-transcription" />
    </Card>
  );
}

function SegmentRow({
  s,
  selected,
  playing,
  onSelect,
  onPlay,
}: {
  s: Segment;
  selected: boolean;
  playing: boolean;
  onSelect: () => void;
  onPlay: () => void;
}) {
  return (
    <Pressable
      testID={`segment-${s.id}`}
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityHint="Sélectionne le passage : écouter, copier, enregistrer, corriger"
      style={[styles.seg, playing && styles.segPlaying, selected && styles.segSelected]}
    >
      <TimeChip seconds={s.start} onPress={onPlay} active={playing} testID={`seg-time-${s.id}`} />
      <Text style={styles.segText}>
        {s.text}
        {s.edited ? <Text style={styles.edited}> (corrigé)</Text> : null}
      </Text>
    </Pressable>
  );
}

function Action({ label, onPress, testID, a11y }: { label: string; onPress: () => void; testID?: string; a11y?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y ?? label} style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.border }]}>
      <Text style={styles.actionText} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  list: { padding: space.lg, paddingBottom: space.xxl, gap: space.sm },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, lineHeight: 32 },
  meta: { fontSize: 14, color: colors.muted },
  cardText: { fontSize: 15, color: colors.text, lineHeight: 21 },
  cardHint: { fontSize: 13, color: colors.muted },
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
  searchIcon: { fontSize: 20, color: colors.muted, marginRight: space.sm },
  searchInput: { flex: 1, fontSize: 17, color: colors.text, paddingVertical: space.md, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : null) },
  seg: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', borderRadius: radius.md, padding: space.sm, borderWidth: 1, borderColor: 'transparent' },
  segPlaying: { backgroundColor: colors.playing, borderLeftColor: colors.mint, borderLeftWidth: 3 },
  segSelected: { backgroundColor: colors.surface, borderColor: colors.accent },
  segText: { flex: 1, fontFamily: fonts.serif, fontSize: 17, lineHeight: 25, color: colors.text },
  edited: { fontFamily: undefined, fontSize: 12, color: colors.faint },
  panel: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  panelTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  panelText: { flex: 1, fontFamily: fonts.serif, fontSize: 15, lineHeight: 20, color: colors.text },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 16, color: colors.muted },
  panelActions: { flexDirection: 'row', gap: 6 },
  action: {
    flexGrow: 1,
    minHeight: HIT,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontSize: 14, fontWeight: '600', color: colors.text },
  empty: { paddingVertical: space.xxl, alignItems: 'center', gap: space.sm },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 15, color: colors.muted, textAlign: 'center' },
});
