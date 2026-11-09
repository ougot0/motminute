import { requireOptionalNativeModule } from 'expo';

export type EngineStatus =
  | 'ready'
  | 'needs-download'
  | 'unsupported-os'
  | 'unsupported-device'
  | 'unsupported-locale'
  | 'module-missing';

export type Availability = { status: EngineStatus; locale?: string; osVersion?: string };

export type NativeSegment = { start: number; end: number; text: string };

type Subscription = { remove(): void };

type NativeSpeech = {
  getAudioInfo(uri: string): Promise<{ durationSec: number; sampleRate: number; channels: number }>;
  getAvailability(localeId: string): Promise<Availability>;
  ensureModel(localeId: string): Promise<{ status: string; locale: string }>;
  transcribe(uri: string, localeId: string): Promise<{ segments: NativeSegment[]; engine: string; locale: string }>;
  cancel(): Promise<boolean>;
  sentenceEmbeddingInfo(language: string): Promise<{ available: boolean; dimension?: number; revision?: number }>;
  embedSentences(texts: string[], language: string): Promise<number[][]>;
  addListener(event: 'onTranscriptionProgress', cb: (e: { fraction: number; processedSec: number }) => void): Subscription;
  addListener(event: 'onModelProgress', cb: (e: { fraction: number }) => void): Subscription;
};

/**
 * Le module n'existe que dans un build de développement / production iOS.
 * Dans Expo Go, sur le web ou dans les tests il vaut `null`.
 */
export const MotMinuteSpeech = requireOptionalNativeModule<NativeSpeech>('MotMinuteSpeech');
