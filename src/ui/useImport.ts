import { router } from 'expo-router';
import { useState } from 'react';
import { Platform } from 'react-native';

import { ImportError, pickAndImportAudio, type ImportedAudio } from '../services/audioFiles';
import { sampleRef, type Sample } from '../data/samples';
import { saveMarkers } from '../services/markers';
import { useApp } from '../state/AppState';
import { Alert } from './alert';

/** Ajoute un audio (importé ou enregistré) à la bibliothèque puis ouvre l'interview et lance la transcription. */
export function useAddInterview() {
  const { repo, bump } = useApp();
  const [importing, setImporting] = useState(false);

  const add = async (audio: ImportedAudio, markerTimes: number[] = []) => {
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
    if (markerTimes.length) await saveMarkers(repo, audio.id, markerTimes.map((t) => ({ t, createdAt: Date.now() })));
    bump();
    router.push({ pathname: '/interview/[id]', params: { id: audio.id, autostart: '1' } });
  };

  const importFile = async () => {
    if (Platform.OS === 'web') {
      router.push('/samples'); // aperçu web : choisir un fichier d'exemple
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

  /** Importe une interview d'exemple (aperçu web) : même parcours qu'un vrai fichier. */
  const importSample = async (s: Sample) => {
    await add({ id: `ex-${Date.now().toString(36)}`, ref: sampleRef(s.id), title: s.title, durationSec: s.durationSec, originalFilename: s.fileName });
  };

  return { importing, importFile, importSample, add };
}
