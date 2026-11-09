import type { Repository } from '../data/repository';
import { canStartTranscription } from '../lib/quota';

export type EngineAvailability =
  | 'ready'
  | 'needs-download'
  | 'unsupported-os'
  | 'unsupported-device'
  | 'unsupported-locale'
  | 'module-missing';

export interface TranscriptionEngine {
  readonly name: string;
  availability(locale: string): Promise<EngineAvailability>;
  ensureModel(locale: string, onProgress: (fraction: number) => void): Promise<void>;
  transcribe(
    fileUri: string,
    locale: string,
    onProgress: (fraction: number) => void,
  ): Promise<{ start: number; end: number; text: string }[]>;
  cancel(): Promise<void>;
}

export class QuotaExceededError extends Error {
  constructor(public readonly remainingSeconds: number) {
    super('Quota gratuit atteint');
    this.name = 'QuotaExceededError';
  }
}

export class EngineUnavailableError extends Error {
  constructor(public readonly availability: EngineAvailability) {
    super(engineMessage(availability));
    this.name = 'EngineUnavailableError';
  }
}

export function engineMessage(a: EngineAvailability): string {
  switch (a) {
    case 'ready':
      return 'Transcription locale prête.';
    case 'needs-download':
      return 'Le modèle français doit être téléchargé (une seule fois).';
    case 'unsupported-os':
      return 'La transcription locale nécessite iOS 26 ou plus récent. La démo reste disponible.';
    case 'unsupported-device':
      return 'Cet iPhone ne prend pas en charge la transcription locale d’Apple. La démo reste disponible.';
    case 'unsupported-locale':
      return 'Le français n’est pas proposé par le moteur de transcription sur cet appareil.';
    case 'module-missing':
      return 'Module de transcription absent : installez le build de développement MotMinute (Expo Go ne suffit pas). La démo reste disponible.';
  }
}

export type RunCallbacks = {
  onPhase?: (phase: 'model' | 'transcribing') => void;
  onModelProgress?: (fraction: number) => void;
  onProgress?: (fraction: number) => void;
};

const LOCALE = 'fr-FR';

/**
 * Lance (ou relance) la transcription d'une interview déjà importée.
 *
 * - vérifie le quota AVANT de commencer (Pro = sans limite) ;
 * - l'état passe à « processing » puis à « done » / « error » / « interrupted » ;
 * - en cas d'échec, l'audio et l'interview sont conservés : on peut relancer
 *   sans réimporter ;
 * - seul un traitement terminé est inscrit au quota (voir Repository.completeTranscription).
 */
export async function runTranscription(
  repo: Repository,
  engine: TranscriptionEngine,
  params: { interviewId: string; fileUri: string; isPro: boolean },
  cb: RunCallbacks = {},
): Promise<'done' | 'error' | 'interrupted'> {
  const interview = await repo.getInterview(params.interviewId);
  if (!interview) throw new Error('Interview introuvable.');

  if (interview.source === 'user') {
    const used = await repo.usedTranscriptionSeconds();
    const decision = canStartTranscription({ usedSeconds: used, durationSeconds: interview.durationSec, isPro: params.isPro });
    if (!decision.allowed) throw new QuotaExceededError(decision.remainingSeconds);
  }

  const availability = await engine.availability(LOCALE);
  if (availability !== 'ready' && availability !== 'needs-download') {
    throw new EngineUnavailableError(availability);
  }

  await repo.setStatus(interview.id, 'processing');
  try {
    if (availability === 'needs-download') {
      cb.onPhase?.('model');
      await engine.ensureModel(LOCALE, (f) => cb.onModelProgress?.(f));
    }
    cb.onPhase?.('transcribing');
    let lastSaved = 0;
    const segments = await engine.transcribe(params.fileUri, LOCALE, (f) => {
      cb.onProgress?.(f);
      if (f - lastSaved >= 0.05) {
        lastSaved = f;
        repo.setProgress(interview.id, f).catch(() => undefined);
      }
    });
    const clean = segments
      .map((s) => ({ start: s.start, end: Math.max(s.end, s.start), text: s.text.replace(/\s+/g, ' ').trim() }))
      .filter((s) => s.text.length > 0 && Number.isFinite(s.start))
      .sort((a, b) => a.start - b.start);
    if (!clean.length) {
      await repo.setStatus(interview.id, 'error', 'Aucune parole détectée dans ce fichier. Vérifiez qu’il s’agit bien d’un enregistrement en français.');
      return 'error';
    }
    await repo.completeTranscription(interview.id, clean, engine.name);
    return 'done';
  } catch (e) {
    const err = e as { code?: string; message?: string };
    const cancelled = err?.code === 'ERR_CANCELLED' || /annul|interromp|cancel/i.test(err?.message ?? '');
    await repo.setStatus(
      interview.id,
      cancelled ? 'interrupted' : 'error',
      cancelled ? 'Transcription interrompue. L’audio est conservé : vous pouvez relancer.' : humanError(err),
    );
    return cancelled ? 'interrupted' : 'error';
  }
}

function humanError(err: { code?: string; message?: string }): string {
  if (err?.code === 'ERR_UNREADABLE_AUDIO') return 'Fichier audio illisible. Essayez un autre export (.m4a, .mp3 ou .wav).';
  if (err?.code === 'ERR_MODEL_MISSING') return 'Le modèle français n’a pas pu être téléchargé. Vérifiez la connexion puis relancez.';
  const msg = (err?.message ?? '').trim();
  return msg ? `La transcription a échoué : ${msg}` : 'La transcription a échoué.';
}
