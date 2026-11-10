import podcast from './samplePodcast.json';

/** Interviews d'EXEMPLE (fictives) proposées par « Importer » dans l'aperçu web. */
export type Sample = { id: string; title: string; fileName: string; durationSec: number; segments: { start: number; end: number; text: string }[]; hint: string };

export const SAMPLES: Sample[] = [{ ...podcast, hint: 'Cherchez ensuite « combien d’arbres » ou « combien ça a coûté ».' }];

export const SAMPLE_PREFIX = 'sample:';
export const sampleRef = (id: string) => `${SAMPLE_PREFIX}${id}`;
export const sampleFromRef = (ref: string) => (ref.startsWith(SAMPLE_PREFIX) ? SAMPLES.find((s) => s.id === ref.slice(SAMPLE_PREFIX.length)) : undefined);

export const SAMPLE_AUDIO: Record<string, number> = { 'podcast-ville': require('../../assets/samples/podcast-ville.m4a') };
