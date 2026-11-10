import { MotMinuteSpeech } from '../../modules/motminute-speech';
import { DEMO_ID } from '../data/demo';
import type { Repository, Segment } from '../data/repository';
import { formatTimestamp } from '../lib/time';

/**
 * Résumé d'interview par l'IA d'Apple (Foundation Models, iOS 26),
 * calculé sur l'iPhone : gratuit, sans envoi de l'audio ni du texte.
 * Le modèle local a une petite fenêtre : on résume par morceaux, puis on
 * résume les résumés.
 */

export type Summary = { text: string; createdAt: number; engine: string; example?: boolean };
export type SummaryStatus = 'ready' | 'device-not-eligible' | 'ai-disabled' | 'model-not-ready' | 'unavailable' | 'unsupported-os' | 'module-missing';

export type Llm = (prompt: string, instructions: string) => Promise<string>;

const KEY = (id: string) => `summary:${id}`;
const CHUNK_CHARS = 5000; // ≈ 1 300 tokens : laisse de la place aux consignes et à la réponse

const INSTRUCTIONS =
  'Tu aides un journaliste. Réponds en français, de façon factuelle et concise. ' +
  'N’invente rien : n’écris que ce qui est dit dans la transcription. N’invente aucune citation.';

export const DEMO_SUMMARY: Summary = {
  example: true,
  engine: 'Exemple rédigé pour la démo',
  createdAt: 0,
  text: [
    'En bref',
    'Marc Delaunay, ancien directeur de la communication de Varennes Industries (entreprise fictive), raconte ses douze ans dans le groupe et sa démission en janvier 2020.',
    '',
    'Points clés',
    '• 00:13 — Arrivée en 2011 comme chargé de communication, après avoir quitté Lyon.',
    '• 03:12 — Il a accepté le poste surtout pour le salaire.',
    '• 12:22 — La fermeture du site de Saint-Aubin, décidée en comité restreint, devait être présentée comme une réorganisation.',
    '• 18:42 — Il démissionne : il ne pouvait plus défendre cette décision.',
    '• 21:01 — Aucun regret ; il forme aujourd’hui de jeunes journalistes.',
  ].join('\n'),
};

export async function summaryStatus(): Promise<SummaryStatus> {
  if (!MotMinuteSpeech) return 'module-missing';
  try {
    return (await MotMinuteSpeech.summaryAvailability()).status as SummaryStatus;
  } catch {
    return 'unavailable';
  }
}

export function summaryStatusMessage(s: SummaryStatus): string {
  switch (s) {
    case 'ready':
      return 'Résumé calculé sur l’iPhone par Apple Intelligence : gratuit et privé.';
    case 'device-not-eligible':
      return 'Cet iPhone n’est pas compatible avec Apple Intelligence (iPhone 15 Pro ou plus récent requis).';
    case 'ai-disabled':
      return 'Activez Apple Intelligence dans Réglages › Apple Intelligence et Siri.';
    case 'model-not-ready':
      return 'Le modèle d’Apple Intelligence se télécharge encore. Réessayez dans quelques minutes.';
    case 'unsupported-os':
      return 'Le résumé nécessite iOS 26.';
    case 'module-missing':
      return 'Le résumé IA fonctionne dans l’app iPhone (pas dans l’aperçu web).';
    default:
      return 'Le résumé n’est pas disponible sur cet appareil.';
  }
}

/** Découpe la transcription en morceaux minutés, sans couper un bloc. */
export function chunkTranscript(segments: Pick<Segment, 'start' | 'text'>[], maxChars = CHUNK_CHARS): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const s of segments) {
    const line = `[${formatTimestamp(s.start)}] ${s.text}\n`;
    if (current && current.length + line.length > maxChars) {
      chunks.push(current);
      current = '';
    }
    current += line;
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function summarizeSegments(segments: Pick<Segment, 'start' | 'text'>[], title: string, llm: Llm): Promise<string> {
  const chunks = chunkTranscript(segments);
  if (!chunks.length) throw new Error('Rien à résumer : la transcription est vide.');
  const partials: string[] = [];
  for (const [i, chunk] of chunks.entries()) {
    partials.push(
      await llm(
        `Extrait ${i + 1}/${chunks.length} de l’interview « ${title} ». Chaque ligne commence par son minutage.\n\n${chunk}\n\n` +
          'Liste les 3 à 5 informations importantes de cet extrait, une par ligne, en commençant chaque ligne par le minutage où elle est dite.',
        INSTRUCTIONS,
      ),
    );
  }
  return llm(
    `Voici les notes de l’interview « ${title} », dans l’ordre :\n\n${partials.join('\n')}\n\n` +
      'Rédige le résumé final avec deux parties :\n« En bref » : deux phrases.\n« Points clés » : 4 à 7 puces « • mm:ss — information », dans l’ordre chronologique.',
    INSTRUCTIONS,
  );
}

export async function loadSummary(repo: Repository, interviewId: string): Promise<Summary | null> {
  const raw = await repo.getSetting(KEY(interviewId));
  if (raw) {
    try {
      return JSON.parse(raw) as Summary;
    } catch {
      // ignoré
    }
  }
  return interviewId === DEMO_ID ? DEMO_SUMMARY : null;
}

export async function generateSummary(repo: Repository, interviewId: string, title: string): Promise<Summary> {
  if (!MotMinuteSpeech) throw new Error(summaryStatusMessage('module-missing'));
  const segments = await repo.listSegments(interviewId);
  const text = await summarizeSegments(segments, title, (p, i) => MotMinuteSpeech!.generateText(p, i));
  const summary: Summary = { text: text.trim(), createdAt: Date.now(), engine: 'Apple Intelligence (sur l’iPhone)' };
  await repo.setSetting(KEY(interviewId), JSON.stringify(summary));
  return summary;
}
