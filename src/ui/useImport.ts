import { router } from 'expo-router';
import { useState } from 'react';
import { Platform } from 'react-native';

import { ImportError, pickAndImportAudio, type ImportedAudio } from '../services/audioFiles';
import { useApp } from '../state/AppState';
import { Alert } from './alert';

/** Ajoute un audio (importé ou enregistré) à la bibliothèque puis ouvre l'interview et lance la transcription. */
export function useAddInterview() {
  const { repo, bump } = useApp();
  const [importing, setImporting] = useState(false);

  const add = async (audio: ImportedAudio) => {
    if (!repo) return;
    await repo.insertInterview({
      id: audio.id,
      title: audio.title,
      durationSec: audio.durationSec,
      createdAt: Date.now(),
      audioRef: audio.ref,
      originalFilename: audio.originalFilename ?? null,
      source: 'user',
    });
    bump();
    router.push({ pathname: '/interview/[id]', params: { id: audio.id, autostart: '1' } });
  };

  const importFile = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Aperçu web', 'L’import de fichiers audio fonctionne dans l’app iPhone. Ici, essayez l’interview démo.');
      return;
    }
    setImporting(true);
    try {
      const audio = await pickAndImportAudio();
      if (audio) await add(audio);
    } catch (e) {
      Alert.alert(e instanceof ImportError ? 'Fichier non importé' : 'Erreur d’import', e instanceof Error ? e.message : 'Ce fichier n’a pas pu être lu.');
    } finally {
      setImporting(false);
    }
  };

  return { importing, importFile, add };
}
