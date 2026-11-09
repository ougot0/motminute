import { Link, router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Interview } from '../data/repository';
import type { SearchHit } from '../lib/search';
import { formatDate, formatDuration } from '../lib/time';
import { ImportError, pickAndImportAudio } from '../services/audioFiles';
import { useApp } from '../state/AppState';
import { Button, Card, ProgressBar, StatusBadge, TextPrompt } from '../ui/components';
import { HitRow } from '../ui/HitRow';
import { colors, HIT, radius, space } from '../ui/theme';
import { useSearch } from '../ui/useSearch';

function HeaderLinks() {
  return (
    <View style={{ flexDirection: 'row', gap: space.lg }}>
      <Link href="/quotes" style={styles.headerLink} accessibilityLabel="Citations enregistrées">
        Citations
      </Link>
      <Link href="/settings" style={styles.headerLink} accessibilityLabel="Réglages">
        Réglages
      </Link>
    </View>
  );
}

// Options stables : un objet recréé à chaque rendu relancerait la navigation en boucle.
const SCREEN_OPTIONS = { headerRight: () => <HeaderLinks /> };

export default function LibraryScreen() {
  const { repo, version, bump, quota, job, deleteInterview, semanticEnabled } = useApp();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [query, setQuery] = useState('');
  const [importing, setImporting] = useState(false);
  const [renaming, setRenaming] = useState<Interview | null>(null);
  const results = useSearch(query);

  useFocusEffect(
    useCallback(() => {
      if (!repo) return;
      let alive = true;
      repo.listInterviews().then((list) => alive && setInterviews(list));
      return () => {
        alive = false;
      };
      // `version` change à chaque modification des données : on recharge.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repo, version]),
  );

  const onImport = async () => {
    if (!repo) return;
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
      Alert.alert(it.title, undefined, [
        { text: 'Renommer', onPress: rename },
        { text: 'Supprimer', style: 'destructive', onPress: remove },
        { text: 'Annuler', style: 'cancel' },
      ]);
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
        <Pressable onPress={() => router.push('/settings')} accessibilityRole="button">
          <Card style={styles.quota}>
            <Text style={styles.quotaTitle}>{quota.isPro ? 'MotMinute Pro' : 'Version gratuite'}</Text>
            <Text style={styles.quotaText}>
              {quota.isPro
                ? 'Nouvelles transcriptions sans limite.'
                : `${Math.round(quota.usedSeconds / 60)} min de transcription utilisées sur 60 · reste ${Math.floor((quota.remainingSeconds ?? 0) / 60)} min`}
            </Text>
            {!quota.isPro ? <ProgressBar value={quota.usedSeconds / (quota.limitSeconds ?? 1)} /> : null}
          </Card>
        </Pressable>
      )}
    </View>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={SCREEN_OPTIONS} />
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
  list: { padding: space.lg, paddingBottom: 120, gap: space.md },
  headerLink: { fontSize: 16, color: colors.text, fontWeight: '600', paddingVertical: 8 },
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
  searchInput: { flex: 1, fontSize: 17, color: colors.text, paddingVertical: space.md },
  searchMode: { fontSize: 13, color: colors.muted },
  quota: { gap: 6, padding: space.md },
  quotaTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  quotaText: { fontSize: 14, color: colors.muted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.md,
  },
  rowTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  rowMeta: { fontSize: 14, color: colors.muted },
  more: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 16, color: colors.muted, letterSpacing: 1 },
  empty: { paddingVertical: space.xxl, alignItems: 'center', gap: space.sm },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 15, color: colors.muted, textAlign: 'center', maxWidth: 320 },
  footer: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.xl },
});
