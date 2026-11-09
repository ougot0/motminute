import { sampleFromRef } from '../data/samples';
import type { TranscriptionEngine } from './transcriptionRunner';

/**
 * Aperçu web : « transcription » SIMULÉE des interviews d'exemple.
 * Renvoie la transcription préparée de l'exemple, avec une progression visible.
 */
export function createSampleEngine(stepMs = 350): TranscriptionEngine {
  let cancelled = false;
  return {
    name: 'Transcription simulée (aperçu web)',
    availability: async () => 'ready',
    ensureModel: async () => undefined,
    async transcribe(fileUri, _locale, onProgress) {
      const sample = sampleFromRef(fileUri);
      if (!sample) throw new Error('Dans l’aperçu web, seules les interviews d’exemple peuvent être transcrites.');
      cancelled = false;
      for (let i = 1; i <= 10; i++) {
        await new Promise((r) => setTimeout(r, stepMs));
        if (cancelled) throw Object.assign(new Error('Transcription interrompue.'), { code: 'ERR_CANCELLED' });
        onProgress(i / 10);
      }
      return sample.segments;
    },
    async cancel() {
      cancelled = true;
    },
  };
}
