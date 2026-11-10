import { isStopword, tokenize } from './text';

/** Mots trop courants à l'oral pour faire un « sujet ». */
const ORAL = new Set(
  ('vraiment chose choses alors parce comme quand aussi encore toujours jamais rien beaucoup moins autre autres ' +
    'avoir etre faire fais faisait dire disait voila puis apres avant ensuite peut-etre etait etaient avait avaient ' +
    'pouvais pouvait suis sommes serait seront juste bonjour merci votre notre leurs celle celui cela quelques plus ' +
    'tres moment fois annee annees honnetement mille cents')
    .split(/\s+/),
);

/**
 * Sujets d'une interview, calculés sur l'iPhone sans IA : les mots porteurs de
 * sens les plus fréquents (regroupés par racine), dans leur forme la plus courante.
 */
export function extractTopics(texts: string[], max = 6): string[] {
  const byStem = new Map<string, { count: number; forms: Map<string, number> }>();
  for (const text of texts) {
    for (const tok of tokenize(text)) {
      if (tok.norm.length < 5 || isStopword(tok.norm) || ORAL.has(tok.norm) || /^\d+$/.test(tok.norm) || /ez$/.test(tok.norm)) continue;
      const surface = text.slice(tok.start, tok.end).toLowerCase();
      const e = byStem.get(tok.stem) ?? { count: 0, forms: new Map() };
      e.count++;
      e.forms.set(surface, (e.forms.get(surface) ?? 0) + 1);
      byStem.set(tok.stem, e);
    }
  }
  return [...byStem.values()]
    .filter((e) => e.count >= 1)
    .sort((a, b) => b.count - a.count || [...b.forms.keys()][0].length - [...a.forms.keys()][0].length)
    .slice(0, max)
    .map((e) => [...e.forms.entries()].sort((a, b) => b[1] - a[1])[0][0]);
}
