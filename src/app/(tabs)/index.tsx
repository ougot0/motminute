import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActionSheetIOS, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Interview } from '../../data/repository';
import type { SearchHit } from '../../lib/search';
import { formatDate, formatDuration } from '../../lib/time';
import { ImportError, pickAndImportAudio } from '../../services/audioFiles';
import { useApp } from '../../state/AppState';
import { Alert } from '../../ui/alert';
import { Button, Card, ChoiceSheet, ProgressBar, StatusBadge, TextPrompt } from '../../ui/components';
import { HitRow } from '../../ui/HitRow';
import { SUGGESTIONS } from '../../ui/suggestions';
import { colors, HIT, radius, space } from '../../ui/theme';
import { useSearch } from '../../ui/useSearch';

export default function LibraryScreen() {
  const { repo, version, bump, quota, job, deleteInterview, semanticEnabled } = useApp();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [query, setQuery] = useState('');
  const [importing, setImporting] = useState(false);
  const [renaming, setRenaming] = useState<Interview | null>(null);
  const [menuFor, setMenuFor] = useState<Interview | null>(null);
  const [quoteCount, setQuoteCount] = useState(0);
  const results = useSearch(query);

  useFocusEffect(
    useCallback(() => {
      if (!repo) return;
      let alive = true;
      repo.listInterviews().then((list) => alive && setInterviews(list));
      repo.listQuotes().then((q) => alive && setQuoteCount(q.length));
      return () => {
        alive = false;
      };
      // `version` change à chaque modification des données : on recharge.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repo, version]),
  );

  const onImport = async () => {
    if (!repo) return;
    if (Platform.OS === 'web') {
      Alert.alert('Aperçu web', 'L’import de fichiers audio et la transcription fonctionnent uniquement dans l’app iPhone. Ici, utilisez l’interview démo.');
      return;
    }
    setImporting(true);
    try {
      const audio = await pickAndImportAudio();
      if (!audio) return;
      await repo.insertInterview({
        id: audio.id,
        title: audio.title,
        durationSec: audio.durationSec,
        createdAt: Date.now(),
        audioRef: audio.ref,
        originalFilename: audio.originalFilename,
        source: 'user',
      });
      bump();
      router.push({ pathname: '/interview/[id]', params: { id: audio.id, autostart: '1' } });
    } catch (e) {
      Alert.alert(
        e instanceof ImportError ? 'Fichier non importé' : 'Erreur d’import',
        e instanceof Error ? e.message : 'Ce fichier n’a pas pu être lu.',
      );
    } finally {
      setImporting(false);
    }
  };

  const openActions = (it: Interview) => {
    const rename = () => setRenaming(it);
    const remove = () =>
      Alert.alert('Supprimer l’interview ?', `« ${it.title} », son audio, sa transcription et ses citations seront effacés de l’iPhone.`, [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => deleteInterview(it.id) },
      ]);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: it.title, options: ['Renommer', 'Supprimer', 'Annuler'], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
        (i) => (i === 0 ? rename() : i === 1 ? remove() : undefined),
      );
    } else {
      setMenuFor(it);
    }
  };

  const openHit = (h: SearchHit) =>
    router.push({ pathname: '/interview/[id]', params: { id: h.interviewId, t: String(h.start), seg: String(h.segmentId) } });

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.md }}>
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          testID="library-search"
          value={query}
          onChangeText={setQuery}
          placeholder="Chercher une citation dans toutes les interviews"
          placeholderTextColor={colors.faint}
          style={styles.searchInput}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
        />
      </View>
      {results.active ? (
        <Text style={styles.searchMode}>
          {semanticEnabled
            ? 'Recherche textuelle + synonymes + sens (expérimental)'
            : 'Recherche textuelle : accents et majuscules ignorés, expressions exactes en premier, synonymes français'}
        </Text>
      ) : (
        <View style={{ gap: space.md }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {SUGGESTIONS.map((q) => (
              <Pressable key={q} onPress={() => setQuery(q)} accessibilityRole="button" style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}>
                <Text style={styles.chipText}>« {q} »</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.stats}>
            <Stat value={String(interviews.length)} label="interviews" />
            <Stat value={String(quoteCount)} label="citations" />
            <Stat value={`${Math.round(quota.usedSeconds / 60)}`} label="min transcrites" />
          </View>
          <Card style={styles.quota}>
            <View style={styles.quotaHead}>
              <Text style={styles.quotaTitle}>{quota.isPro ? 'MotMinute Pro' : 'Version gratuite'}</Text>
              {!quota.isPro ? (
                <Text style={styles.link} onPress={() => router.push('/paywall')} accessibilityRole="link">
                  Passer à Pro
                </Text>
              ) : null}
            </View>
            <Text style={styles.quotaText}>
              {quota.isPro
                ? 'Nouvelles transcriptions sans limite.'
                : `${Math.round(quota.usedSeconds / 60)} min de transcription utilisées sur 60 · reste ${Math.floor((quota.remainingSeconds ?? 0) / 60)} min`}
            </Text>
            {!quota.isPro ? <ProgressBar value={quota.usedSeconds / (quota.limitSeconds ?? 1)} /> : null}
          </Card>
          <Text style={styles.section}>Vos interviews</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.screen}>
      {results.active ? (
        <FlatList
          data={results.hits}
          keyExtractor={(h) => `${h.interviewId}:${h.segmentId}`}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          ListEmptyComponent={
            results.busy ? undefined : (
              <View style={styles.empty} testID="search-empty">
                <Text style={styles.emptyTitle}>Aucun passage pertinent</Text>
                <Text style={styles.emptyText}>
                  Essayez d’autres mots, une expression entre guillemets, ou vérifiez que l’interview est bien transcrite.
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => <HitRow hit={item} onPress={() => openHit(item)} showTitle />}
        />
      ) : (
        <FlatList
          data={interviews}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Aucune interview</Text>
              <Text style={styles.emptyText}>Importez un enregistrement .m4a, .mp3 ou .wav depuis Fichiers.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <InterviewRow
              it={item}
              progress={job?.interviewId === item.id ? job.progress : undefined}
              onPress={() => router.push({ pathname: '/interview/[id]', params: { id: item.id } })}
              onMore={() => openActions(item)}
            />
          )}
        />
      )}
      <View style={styles.footer}>
        <Button label="Importer une interview" icon="＋" onPress={onImport} loading={importing} testID="import" />
      </View>
      {menuFor ? (
        <ChoiceSheet
          title={menuFor.title}
          onClose={() => setMenuFor(null)}
          choices={[
            { label: 'Renommer', onPress: () => setRenaming(menuFor) },
            {
              label: 'Supprimer',
              destructive: true,
              onPress: () =>
                Alert.alert('Supprimer l’interview ?', `« ${menuFor.title} », son audio, sa transcription et ses citations seront effacés.`, [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Supprimer', style: 'destructive', onPress: () => deleteInterview(menuFor.id) },
                ]),
            },
          ]}
        />
      ) : null}
      <TextPrompt
        visible={renaming !== null}
        title="Renommer l’interview"
        initial={renaming?.title ?? ''}
        onCancel={() => setRenaming(null)}
        onConfirm={async (v) => {
          if (renaming && repo) {
            await repo.renameInterview(renaming.id, v);
            bump();
          }
          setRenaming(null);
        }}
      />
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InterviewRow({ it, progress, onPress, onMore }: { it: Interview; progress?: number; onPress: () => void; onMore: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onMore}
      testID={`interview-${it.id}`}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}
    >
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {it.title}
        </Text>
        <Text style={styles.rowMeta}>
          {formatDuration(it.durationSec)} · ajoutée le {formatDate(it.createdAt)}
          {it.source === 'demo' ? ' · démo' : ''}
        </Text>
        <StatusBadge status={it.status} progress={progress ?? it.progress} />
      </View>
      <Pressable onPress={onMore} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Actions pour ${it.title}`} style={styles.more}>
        <Text style={styles.moreText}>•••</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.lg, paddingBottom: 96, gap: space.sm },
  chips: { flexDirection: 'row', gap: space.sm },
  chip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: space.md, minHeight: 36, justifyContent: 'center' },
  chipText: { fontSize: 14, color: colors.accent, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: space.md, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, color: colors.muted },
  quotaHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { fontSize: 14, fontWeight: '700', color: colors.accent, paddingVertical: 4 },
  section: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: space.sm },
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
  searchMode: { fontSize: 13, color: colors.muted },
  quota: { gap: 6, padding: space.md },
  quotaTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  quotaText: { fontSize: 14, color: colors.muted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  rowMeta: { fontSize: 14, color: colors.muted },
  more: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 16, color: colors.muted, letterSpacing: 1 },
  empty: { paddingVertical: space.xxl, alignItems: 'center', gap: space.sm },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 15, color: colors.muted, textAlign: 'center', maxWidth: 320 },
  footer: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.md },
});
