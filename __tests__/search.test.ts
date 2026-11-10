import demo from '../src/data/demoTranscript.json';
import { normalize, parseQuery, search, stem, type SearchDoc } from '../src/lib/search';
import { formatTimestamp } from '../src/lib/time';

const DEMO_DOCS: SearchDoc[] = demo.segments.map((s, i) => ({
  interviewId: 'demo',
  interviewTitle: demo.title,
  segmentId: i + 1,
  start: s.start,
  end: s.end,
  text: s.text,
}));

// Deuxième interview fictive, pleine de distracteurs, pour la recherche bibliothèque.
const OTHER: SearchDoc[] = [
  'Je suis parti en vacances parce que j’étais épuisé.',
  'Le ministre a quitté la salle sans répondre.',
  'On m’a proposé un poste à Bruxelles, je l’ai refusé.',
  'Ma fille m’a dit : papa, pourquoi tu travailles autant ?',
  'Le PDG a démissionné en 2015 après le scandale des comptes.',
  'Nous avons défendu cette décision devant les actionnaires.',
  'Je vous remercie pour cette question.',
].map((text, i) => ({
  interviewId: 'autre',
  interviewTitle: 'Autre interview (fictive)',
  segmentId: 1000 + i,
  start: 60 * (i + 1),
  end: 60 * (i + 1) + 5,
  text,
}));

const ALL = [...DEMO_DOCS, ...OTHER];
const KEY_QUOTE = 'J’ai quitté mon poste parce que je ne pouvais plus défendre cette décision.';

const top = (q: string, docs = DEMO_DOCS) => search(q, docs)[0];
const texts = (q: string, docs = DEMO_DOCS) => search(q, docs).map((h) => h.text);

describe('normalisation', () => {
  it('ignore accents, casse et apostrophes typographiques', () => {
    expect(normalize('J’AI Démissionné !')).toBe('j ai demissionne');
    expect(normalize("l'Été")).toBe('l ete');
  });
  it('rapproche les formes d’un même mot', () => {
    expect(stem('demissionne')).toBe(stem('demission'));
    expect(stem('quitte')).toBe(stem('quitter'));
    expect(stem('regrette')).toBe(stem('regrets'));
    expect(stem('licencie')).toBe(stem('licenciement'));
  });
});

describe('parcours principal : « pourquoi il a démissionné »', () => {
  it('propose en premier l’extrait réel à 18:42', () => {
    const hit = top('pourquoi il a démissionné');
    expect(hit.text).toBe(KEY_QUOTE);
    expect(formatTimestamp(hit.start)).toBe('18:42');
    expect(hit.start).toBe(1122);
    expect(hit.matchType).toBe('reformulation');
  });

  it('chaque résultat pointe vers un bloc existant avec son vrai minutage', () => {
    for (const hit of search('pourquoi il a démissionné', ALL)) {
      const source = ALL.find((d) => d.segmentId === hit.segmentId)!;
      expect(source).toBeDefined();
      expect(hit.start).toBe(source.start);
      expect(hit.end).toBe(source.end);
      expect(hit.text).toBe(source.text);
    }
  });

  it('écarte les distracteurs (« quitté Lyon », « accepté ce poste », « je vous remercie »)', () => {
    const res = texts('pourquoi il a démissionné');
    expect(res.some((t) => t.includes('quitté Lyon'))).toBe(false);
    expect(res.some((t) => t.includes('accepté ce poste'))).toBe(false);
    expect(res.some((t) => t.includes('remercie'))).toBe(false);
  });

  it('fonctionne sans accents ni majuscules', () => {
    expect(top('POURQUOI IL A DEMISSIONNE').text).toBe(KEY_QUOTE);
  });

  it('dans toute la bibliothèque, la citation reste en tête devant les autres démissions', () => {
    const res = search('pourquoi il a démissionné', ALL);
    expect(res[0].text).toBe(KEY_QUOTE);
    expect(res.map((r) => r.text)).toContain('Le PDG a démissionné en 2015 après le scandale des comptes.');
    expect(res.map((r) => r.text)).not.toContain('Le ministre a quitté la salle sans répondre.');
  });
});

describe('autres reformulations', () => {
  const cases: [string, string][] = [
    ['il a quitté son poste', KEY_QUOTE],
    ['raison de son départ', KEY_QUOTE],
    ['il ne pouvait plus défendre la décision', KEY_QUOTE],
    ['combien il était payé', 'Honnêtement, pour le salaire. Je gagnais à peine deux mille euros par mois dans mon ancien journal.'],
    ['est-ce qu’il avait peur', 'J’avais la trouille, je vous l’avoue. Trois cents familles étaient concernées.'],
    ['est-ce qu’il regrette', 'Aucun regret. Si c’était à refaire, je partirais peut-être même plus tôt.'],
    ['son adjoint a été licencié', 'Mon adjoint, lui, a été remercié six mois plus tard.'],
    ['ses débuts', 'J’ai quitté Lyon en 2011 pour Paris. J’ai été recruté comme chargé de communication, et le premier jour, je ne connaissais personne.'],
  ];
  it.each(cases)('« %s »', (query, expected) => {
    expect(top(query)?.text).toBe(expected);
  });

  it('« licencié » ne confond pas avec « je vous remercie »', () => {
    const res = texts('il a été licencié', ALL);
    expect(res).not.toContain('Je vous remercie pour cette question.');
    expect(res.some((t) => t.startsWith('Merci à vous. Je vous remercie'))).toBe(false);
  });
});

describe('expressions exactes', () => {
  it('passent devant les correspondances partielles', () => {
    const res = search('défendre cette décision', ALL);
    expect(res[0].matchType).toBe('exact');
    const exact = res.filter((r) => r.matchType === 'exact').map((r) => r.text);
    expect(exact).toContain(KEY_QUOTE);
    expect(exact).not.toContain('Nous avons défendu cette décision devant les actionnaires.');
  });

  it('entre guillemets : expression exacte uniquement', () => {
    const res = search('« décision collective »', ALL);
    expect(res).toHaveLength(1);
    expect(res[0].text).toContain('C’est une décision collective');
    expect(parseQuery('"décision collective"').exactOnly).toBe(true);
  });

  it('surligne les mots trouvés dans le texte affiché', () => {
    const hit = top('défendre cette décision');
    const marked = hit.highlights.map(([a, b]) => hit.text.slice(a, b));
    expect(marked).toEqual(['défendre', 'cette', 'décision']);
  });
});

describe('état vide', () => {
  it.each(['recette de cuisine', 'football', 'pourquoi il a été licencié de la NASA', '   '])('« %s » ne renvoie rien', (q) => {
    expect(search(q, ALL)).toEqual([]);
  });

  it('une requête faite uniquement de mots vides ne trouve que l’expression exacte', () => {
    const res = search('il y a', ALL);
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((r) => r.matchType === 'exact')).toBe(true);
  });
});

describe('recherche par sens (scores injectés)', () => {
  it('n’ajoute un résultat « sens » qu’au-dessus du seuil', () => {
    const semantic = new Map<number, number>([
      [1003, 0.9],
      [1004, 0.5],
    ]);
    const res = search('surmenage', OTHER, { semantic });
    expect(res.find((r) => r.segmentId === 1003)?.matchType).toBe('sens');
    expect(res.find((r) => r.segmentId === 1004)).toBeUndefined();
  });
});
