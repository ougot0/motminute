import { MotMinuteSpeech } from '../../modules/motminute-speech';
import type { EngineAvailability, TranscriptionEngine } from './transcriptionRunner';

/** Moteur réel : SpeechAnalyzer (iOS 26) via le module natif local. */
export const nativeEngine: TranscriptionEngine = {
  name: 'Apple SpeechAnalyzer (sur l’appareil)',

  async availability(locale) {
    if (!MotMinuteSpeech) return 'module-missing';
    try {
      const a = await MotMinuteSpeech.getAvailability(locale);
      return a.status as EngineAvailability;
    } catch {
      return 'unsupported-device';
    }
  },

  async ensureModel(locale, onProgress) {
    if (!MotMinuteSpeech) throw new Error('Module de transcription absent.');
    const sub = MotMinuteSpeech.addListener('onModelProgress', (e) => onProgress(e.fraction));
    try {
      await MotMinuteSpeech.ensureModel(locale);
    } finally {
      sub.remove();
    }
  },

  async transcribe(fileUri, locale, onProgress) {
    if (!MotMinuteSpeech) throw new Error('Module de transcription absent.');
    const sub = MotMinuteSpeech.addListener('onTranscriptionProgress', (e) => onProgress(e.fraction));
    try {
      const res = await MotMinuteSpeech.transcribe(fileUri, locale);
      return res.segments;
    } finally {
      sub.remove();
    }
  },

  async cancel() {
    await MotMinuteSpeech?.cancel();
  },
};

export async function osVersionInfo(): Promise<string | undefined> {
  try {
    return (await MotMinuteSpeech?.getAvailability('fr-FR'))?.osVersion;
  } catch {
    return undefined;
  }
}
