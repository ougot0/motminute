/**
 * Normalisation du français pour la recherche : casse, accents, apostrophes,
 * ponctuation, et racinisation légère (« démissionné » ≈ « démission »).
 */

/** Minuscules, sans accents, apostrophes et ponctuation remplacées par des espaces. */
export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[’'`´‘ʼ]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export type Token = {
  /** Forme normalisée (sans accents). */
  norm: string;
  /** Racine utilisée pour comparer. */
  stem: string;
  /** Position dans le texte d'origine (pour surligner). */
  start: number;
  end: number;
};

const WORD_RE = /[\p{L}\p{N}]+/gu;

/** Découpe un texte en mots en gardant leurs positions dans le texte original. */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  for (const m of input.matchAll(WORD_RE)) {
    const raw = m[0];
    const norm = normalize(raw);
    if (!norm) continue;
    // « j'ai » est déjà coupé par l'apostrophe ; on ignore les élisions d'une lettre
    tokens.push({ norm, stem: stem(norm), start: m.index ?? 0, end: (m.index ?? 0) + raw.length });
  }
  return tokens;
}

// Suffixes triés du plus long au plus court. Appliqués sur une forme sans accents.
const SUFFIXES = [
  'issements', 'issement', 'eraient', 'ements', 'ations', 'atrices', 'ateurs',
  'aient', 'ement', 'ation', 'atrice', 'ateur', 'ances', 'ences', 'ables', 'istes', 'ismes', 'erons',
  'eront', 'erais', 'erait', 'aires', 'euses', 'iques',
  'ance', 'ence', 'ites', 'ives', 'euse', 'able', 'iste', 'isme', 'erez', 'aire', 'ique',
  'ante', 'ants', 'ees', 'ite', 'ive', 'ifs', 'eux', 'iez', 'ait', 'ais', 'ant',
  'er', 'ez', 'ir', 'ee', 'es', 'if',
  'e', 's', 'x',
];

// Suffixes dérivationnels : on exige une racine plus longue pour éviter
// « comité » ≈ « commencé » (→ « com »).
const DERIVATIONAL = new Set([
  'issements', 'issement', 'ements', 'ations', 'atrices', 'ateurs', 'ement', 'ation', 'atrice', 'ateur',
  'ances', 'ences', 'ables', 'istes', 'ismes', 'aires', 'euses', 'iques', 'ance', 'ence', 'ites', 'ives',
  'euse', 'able', 'iste', 'isme', 'aire', 'ique', 'ite', 'ive', 'ifs', 'eux', 'if',
]);

/** Racinisation française volontairement simple et prévisible. */
export function stem(word: string): string {
  let w = word;
  if (w.length <= 3) return w;
  for (const suf of SUFFIXES) {
    if (w.endsWith(suf) && w.length - suf.length >= (DERIVATIONAL.has(suf) ? 5 : 3)) {
      w = w.slice(0, -suf.length);
      break;
    }
  }
  // consonne doublée finale : « demissionn » → « demission », « quitt » → « quit »
  if (w.length >= 4 && w[w.length - 1] === w[w.length - 2] && !/[aeiouy]/.test(w[w.length - 1])) {
    w = w.slice(0, -1);
  }
  return w;
}

/** Mots vides français ignorés dans les requêtes (mais conservés pour les expressions). */
export const STOPWORDS = new Set(
  (
    'a ai as au aux avec avez avons avait avais avaient avoir c ca ce ceci cela celle celui ces cet cette ' +
    'd dans de des du elle elles en es est et etaient etait ete etre eu eux fait faire il ils ' +
    'j je l la le les leur leurs lui m ma mais me meme mes moi mon n ne ni nos notre nous on ou ' +
    'par pas pour qu que quel quelle quels quelles qui s sa se ses si son sont sur t ta te tes toi ton ' +
    'tu un une vos votre vous y est-ce ceux plus tres bien alors donc la-bas ici t-il t-elle ' +
    'avez-vous vraiment tout tous toute toutes peu aussi deja encore etais etiez ' +
    'dit dire disait parle parler parlait explique expliquer raconte raconter evoque passage moment ' +
    'comment quand combien quoi ou interview invite'
  ).split(/\s+/),
);

export function isStopword(norm: string): boolean {
  return STOPWORDS.has(norm);
}
