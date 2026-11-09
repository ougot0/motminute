import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActionSheetIOS, FlatList, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Interview } from '../../data/repository';
import { normalize } from '../../lib/text';
import { useApp } from '../../state/AppState';
import { Alert } from '../../ui/alert';
import { Button, ChoiceSheet, TextPrompt } from '../../ui/components';
import { InterviewRow } from '../../ui/InterviewRow';
import { colors, HIT, radius, space } from '../../ui/theme';
import { useAddInterview } from '../../ui/useImport';

export default function LibraryScreen() {
  const { repo, version, bump, job, deleteInterview } = useApp();
  const { importing, importFile } = useAddInterview();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [filter, setFilter] = useState('');
  const [renaming, setRenaming] = useState<Interview | null>(null);
  const [menuFor, setMenuFor] = useState<Interview | null>(null);

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

  const confirmDelete = (it: Interview) =>
    Alert.alert('Supprimer l’interview ?', `« ${it.title} », son audio, sa transcription et ses citations seront effacés.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteInterview(it.id) },
    ]);

  const openActions = (it: Interview) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: it.title, options: ['Renommer', 'Supprimer', 'Annuler'], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
        (i) => (i === 0 ? setRenaming(it) : i === 1 ? confirmDelete(it) : undefined),
      );
    } else setMenuFor(it);
  };

  const f = normalize(filter);
  const shown = f ? interviews.filter((i) => normalize(i.title).includes(f)) : interviews;

  return (
    <View style={styles.screen}>
      <FlatList
        data={shown}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: space.md, paddingBottom: space.sm }}>
            <View style={styles.actions}>
              <Button label="● Enregistrer" onPress={() => router.push('/record')} style={{ flex: 1 }} testID="library-record" />
              <Button label="Importer" variant="secondary" onPress={importFile} loading={importing} style={{ flex: 1 }} testID="import" />
            </View>
            <TextInput
              value={filter}
              onChangeText={setFilter}
              placeholder="Filtrer par titre"
              placeholderTextColor={colors.faint}
              style={styles.filter}
              clearButtonMode="while-editing"
            />
            <Text style={styles.count}>
              {shown.length} interview{shown.length > 1 ? 's' : ''}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{f ? 'Aucun titre ne correspond' : 'Aucune interview'}</Text>
            <Text style={styles.emptyText}>Enregistrez une interview ou importez un fichier .m4a, .mp3 ou .wav.</Text>
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
      {menuFor ? (
        <ChoiceSheet
          title={menuFor.title}
          onClose={() => setMenuFor(null)}
          choices={[
            { label: 'Renommer', onPress: () => setRenaming(menuFor) },
            { label: 'Supprimer', destructive: true, onPress: () => confirmDelete(menuFor) },
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.lg, gap: space.sm, paddingBottom: space.xxl },
  actions: { flexDirection: 'row', gap: space.sm },
  filter: {
    minHeight: HIT,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    fontSize: 16,
    color: colors.text,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : null),
  },
  count: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  empty: { paddingVertical: space.xxl, alignItems: 'center', gap: space.sm },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 15, color: colors.muted, textAlign: 'center', maxWidth: 320 },
});
