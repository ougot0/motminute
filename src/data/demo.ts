import demo from './demoTranscript.json';
import type { Repository } from './repository';

export const DEMO_ID = 'demo-interview';
export const DEMO_AUDIO_REF = 'demo:interview';
export const DEMO_TRANSCRIPT = demo;

const SEEDED_KEY = 'demo_seeded_v1';

/**
 * Ajoute l'interview démo (fictive) au premier lancement. Si l'utilisateur la
 * supprime, elle ne revient pas toute seule (`force` la restaure).
 */
export async function seedDemo(repo: Repository, options: { force?: boolean; now?: number } = {}): Promise<boolean> {
  if (!options.force && (await repo.getSetting(SEEDED_KEY))) return false;
  const existing = await repo.getInterview(DEMO_ID);
  if (existing) await repo.deleteInterview(DEMO_ID);
  await repo.insertInterview({
    id: DEMO_ID,
    title: demo.title,
    durationSec: demo.durationSec,
    createdAt: options.now ?? Date.now(),
    audioRef: DEMO_AUDIO_REF,
    originalFilename: null,
    source: 'demo',
    status: 'processing',
  });
  await repo.completeTranscription(
    DEMO_ID,
    demo.segments.map((s) => ({ start: s.start, end: s.end, text: s.text })),
    'Démo (transcription préparée)',
    options.now,
  );
  await repo.setSetting(SEEDED_KEY, '1');
  return true;
}
