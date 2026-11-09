import { MotMinuteSpeech } from '../../modules/motminute-speech';
import type { SearchDoc } from '../lib/search';

/**
 * Recherche par sens — EXPÉRIMENTALE et désactivée par défaut.
 *
 * S'appuie sur NLEmbedding.sentenceEmbedding(for: .french) d'Apple (modèle
 * local). Sa qualité en français n'a pas été vérifiée sur iPhone pendant le
 * développement : l'écran Réglages propose un diagnostic qui l'évalue sur
 * l'appareil avant de l'activer.
 */

const cache = new Map<string, number[]>();

export async function semanticAvailable(): Promise<boolean> {
  if (!MotMinuteSpeech) return false;
  try {
    return (await MotMinuteSpeech.sentenceEmbeddingInfo('fr')).available;
  } catch {
    return false;
  }
}

export function cosine(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export async function semanticScores(query: string, docs: SearchDoc[]): Promise<Map<number, number>> {
  const scores = new Map<number, number>();
  if (!MotMinuteSpeech || !query.trim()) return scores;
  const missing = docs.filter((d) => !cache.has(`${d.segmentId}\u0000${d.text}`));
  for (let i = 0; i < missing.length; i += 200) {
    const batch = missing.slice(i, i + 200);
    const vectors = await MotMinuteSpeech.embedSentences(batch.map((d) => d.text), 'fr');
    batch.forEach((d, k) => cache.set(`${d.segmentId}\u0000${d.text}`, vectors[k] ?? []));
  }
  const [q] = await MotMinuteSpeech.embedSentences([query], 'fr');
  for (const d of docs) {
    const v = cache.get(`${d.segmentId}\u0000${d.text}`);
    if (v?.length && q?.length) scores.set(d.segmentId, cosine(q, v));
  }
  return scores;
}

/** Cas de test exécutés sur l'iPhone par le diagnostic (requête → texte attendu en tête). */
export const SEMANTIC_PROBES: { query: string; expected: string; distractors: string[] }[] = [
  {
    query: 'pourquoi il a démissionné',
    expected: 'J’ai quitté mon poste parce que je ne pouvais plus défendre cette décision.',
    distractors: ['J’ai quitté Lyon en 2011 pour Paris.', 'Pourquoi avez-vous accepté ce poste à l’époque ?', 'Je vous remercie de m’avoir invité.'],
  },
  {
    query: 'combien il était payé',
    expected: 'Je gagnais à peine deux mille euros par mois.',
    distractors: ['Trois cents familles étaient concernées.', 'J’ai écrit une note interne.', 'Je suis entré dans le bureau du président.'],
  },
  {
    query: 'est-ce qu’il avait peur',
    expected: 'J’avais la trouille, je vous l’avoue.',
    distractors: ['C’était une fierté.', 'La direction voulait des messages très lisses.', 'Aucun regret.'],
  },
  {
    query: 'son collaborateur a été licencié',
    expected: 'Mon adjoint, lui, a été remercié six mois plus tard.',
    distractors: ['Je vous remercie pour cette question.', 'Merci à vous.', 'Il y a eu une démission collective.'],
  },
];

export type ProbeReport = { passed: number; total: number; details: { query: string; ok: boolean; best: string }[] };

export async function runSemanticDiagnostic(): Promise<ProbeReport> {
  if (!MotMinuteSpeech) throw new Error('Module natif absent.');
  const details: ProbeReport['details'] = [];
  for (const p of SEMANTIC_PROBES) {
    const candidates = [p.expected, ...p.distractors];
    const vectors = await MotMinuteSpeech.embedSentences([p.query, ...candidates], 'fr');
    const [q, ...vs] = vectors;
    const ranked = candidates.map((c, i) => ({ c, s: cosine(q, vs[i]) })).sort((a, b) => b.s - a.s);
    details.push({ query: p.query, ok: ranked[0].c === p.expected, best: ranked[0].c });
  }
  return { passed: details.filter((d) => d.ok).length, total: details.length, details };
}
