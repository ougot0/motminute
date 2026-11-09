import { CONCEPTS, type Concept } from './lexicon';
import { isStopword, normalize, stem, tokenize, type Token } from './text';

/**
 * Recherche de citations.
 *
 * 1. Expression exacte (accents et casse ignorés) — toujours en tête.
 * 2. Mots de la requête (par racine) et reformulations du lexique français.
 * 3. Optionnel : scores « par sens » fournis par un modèle local (expérimental).
 *
 * Chaque résultat pointe vers un bloc réel de transcription (id + minutage).
 */

export type SearchDoc = {
  interviewId: string;
  interviewTitle: string;
  segmentId: number;
  start: number;
  end: number;
  text: string;
};

export type MatchType = 'exact' | 'mots' | 'reformulation' | 'sens';

export type SearchHit = SearchDoc & {
  score: number;
  matchType: MatchType;
  /** Plages [début, fin[ à surligner dans `text`. */
  highlights: [number, number][];
};

export type SearchOptions = {
  limit?: number;
  /** Similarités cosinus [-1, 1] par segmentId, si la recherche par sens est active. */
  semantic?: Map<number, number>;
  /** Seuil de similarité pour qu'un résultat « par sens » seul soit retenu. */
  semanticThreshold?: number;
};

type Term = { stems: string[] };

type CompiledConcept = {
  id: string;
  soft: boolean;
  /** Racines de la requête qui ont déclenché le concept (correspondance littérale). */
  literal: Set<string>;
  terms: Term[];
};

const MAX_GAP = 3;

/** Les mots vides sont gardés : « été remercié » ne doit pas trouver « je vous remercie ». */
function termFromPhrase(phrase: string): Term | null {
  const stems = tokenize(phrase).map((t) => t.stem);
  return stems.length ? { stems } : null;
}

const COMPILED_LEXICON = CONCEPTS.map((c: Concept) => ({
  concept: c,
  triggers: c.triggers.map(termFromPhrase).filter((t): t is Term => t !== null),
  terms: [...c.terms, ...c.triggers].map(termFromPhrase).filter((t): t is Term => t !== null),
}));

/** Cherche `term` dans `tokens` ; renvoie les index des mots trouvés ou null. */
function findTerm(tokens: Token[], term: Term): number[] | null {
  const [first, ...rest] = term.stems;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].stem !== first) continue;
    const found = [i];
    let pos = i;
    let ok = true;
    for (const s of rest) {
      let next = -1;
      for (let j = pos + 1; j <= Math.min(tokens.length - 1, pos + 1 + MAX_GAP); j++) {
        if (tokens[j].stem === s) {
          next = j;
          break;
        }
      }
      if (next < 0) {
        ok = false;
        break;
      }
      found.push(next);
      pos = next;
    }
    if (ok) return found;
  }
  return null;
}

/** Index des mots consécutifs (formes normalisées) égaux à `needle`. */
function findExact(tokens: Token[], needle: string[]): number[] | null {
  if (!needle.length) return null;
  outer: for (let i = 0; i + needle.length <= tokens.length; i++) {
    for (let k = 0; k < needle.length; k++) {
      if (tokens[i + k].norm !== needle[k]) continue outer;
    }
    return needle.map((_, k) => i + k);
  }
  return null;
}

export type ParsedQuery = {
  raw: string;
  exactOnly: boolean;
  exactTokens: string[];
  concepts: CompiledConcept[];
};

export function parseQuery(raw: string): ParsedQuery {
  const trimmed = raw.trim();
  const quoted = /^["«“„]\s*(.+?)\s*["»”]$/.exec(trimmed);
  const body = quoted ? quoted[1] : trimmed;
  const tokens = tokenize(body);
  const exactTokens = tokens.map((t) => t.norm);
  if (quoted) return { raw, exactOnly: true, exactTokens, concepts: [] };

  const consumed = new Set<number>();
  const concepts: CompiledConcept[] = [];
  for (const { concept, triggers, terms } of COMPILED_LEXICON) {
    let hit: number[] | null = null;
    for (const trig of triggers) {
      hit = findTerm(tokens, trig);
      if (hit) break;
    }
    if (!hit) continue;
    hit.forEach((i) => consumed.add(i));
    concepts.push({
      id: concept.id,
      soft: Boolean(concept.soft),
      literal: new Set(hit.map((i) => tokens[i].stem)),
      terms: [{ stems: hit.map((i) => tokens[i].stem) }, ...terms],
    });
  }
  tokens.forEach((t, i) => {
    if (consumed.has(i) || isStopword(t.norm)) return;
    if (t.norm.length < 2 && !/\d/.test(t.norm)) return;
    concepts.push({ id: `mot:${t.stem}`, soft: false, literal: new Set([t.stem]), terms: [{ stems: [t.stem] }] });
  });
  return { raw, exactOnly: false, exactTokens, concepts };
}

const tokenCache = new Map<string, Token[]>();

function docTokens(doc: SearchDoc): Token[] {
  const key = `${doc.segmentId}\u0000${doc.text}`;
  let t = tokenCache.get(key);
  if (!t) {
    if (tokenCache.size > 50_000) tokenCache.clear();
    t = tokenize(doc.text);
    tokenCache.set(key, t);
  }
  return t;
}

function toRanges(tokens: Token[], idx: Iterable<number>): [number, number][] {
  const sorted = [...new Set(idx)].sort((a, b) => a - b);
  return sorted.map((i) => [tokens[i].start, tokens[i].end] as [number, number]);
}

export function requiredHardMatches(hardCount: number): number {
  if (hardCount <= 2) return hardCount;
  return Math.ceil(hardCount * 0.6);
}

export function search(query: string, docs: SearchDoc[], options: SearchOptions = {}): SearchHit[] {
  const limit = options.limit ?? 50;
  const parsed = parseQuery(query);
  if (!parsed.exactTokens.length) return [];

  const hard = parsed.concepts.filter((c) => !c.soft);
  const soft = parsed.concepts.filter((c) => c.soft);
  const required = hard.length ? requiredHardMatches(hard.length) : soft.length ? 1 : Infinity;
  const semThreshold = options.semanticThreshold ?? 0.78;

  const hits: SearchHit[] = [];
  for (const doc of docs) {
    const tokens = docTokens(doc);
    const exact = findExact(tokens, parsed.exactTokens);
    const highlight = new Set<number>(exact ?? []);
    let score = exact ? 100 + parsed.exactTokens.length : 0;
    let matchedHard = 0;
    let matchedSoft = 0;
    let literalOnly = true;

    if (!parsed.exactOnly) {
      for (const c of parsed.concepts) {
        let matched: number[] | null = null;
        for (const term of c.terms) {
          matched = findTerm(tokens, term);
          if (matched) break;
        }
        if (!matched) continue;
        // On ne surligne pas les mots vides (« que » dans « parce que »).
        matched.filter((i) => !isStopword(tokens[i].norm) || matched!.length === 1).forEach((i) => highlight.add(i));
        const isLiteral = matched.every((i) => c.literal.has(tokens[i].stem));
        if (!isLiteral) literalOnly = false;
        if (c.soft) {
          matchedSoft++;
          score += 1.5;
        } else {
          matchedHard++;
          score += isLiteral ? 3.5 : 3;
        }
      }
    }

    const lexicalOk = Boolean(exact) || (!parsed.exactOnly && (hard.length ? matchedHard : matchedSoft) >= required);
    const sem = options.semantic?.get(doc.segmentId);
    const semanticOk = !parsed.exactOnly && sem !== undefined && sem >= semThreshold;
    if (!lexicalOk && !semanticOk) continue;

    if (sem !== undefined && !parsed.exactOnly) score += Math.max(0, sem - 0.5) * 6;
    if (!lexicalOk) score = Math.max(0.1, score);
    // Les passages courts et denses passent devant à score égal.
    score += Math.min(0.5, 8 / Math.max(8, tokens.length));
    // On cherche des citations : une question (souvent celle du journaliste)
    // passe après une réponse de même pertinence.
    if (!exact && doc.text.trim().endsWith('?')) score -= 0.75;

    const matchType: MatchType = exact
      ? 'exact'
      : lexicalOk
        ? literalOnly
          ? 'mots'
          : 'reformulation'
        : 'sens';
    hits.push({ ...doc, score, matchType, highlights: toRanges(tokens, highlight) });
  }

  hits.sort((a, b) => b.score - a.score || a.interviewTitle.localeCompare(b.interviewTitle) || a.start - b.start);
  return hits.slice(0, limit);
}

/** Libellé affiché sous chaque résultat. */
export function matchLabel(t: MatchType): string {
  switch (t) {
    case 'exact':
      return 'Expression exacte';
    case 'mots':
      return 'Mots de la requête';
    case 'reformulation':
      return 'Reformulation (synonymes)';
    case 'sens':
      return 'Proche par le sens (expérimental)';
  }
}

export { normalize, stem };
