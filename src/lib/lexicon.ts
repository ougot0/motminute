/**
 * Lexique de reformulations françaises utilisé par la recherche textuelle.
 *
 * Ce n'est PAS un modèle sémantique : c'est une liste explicite de concepts
 * et de leurs formulations courantes en interview. Elle permet de retrouver
 * « J'ai quitté mon poste parce que… » en tapant « pourquoi il a démissionné ».
 *
 * Règles d'écriture :
 *  - un terme d'un seul mot est comparé par racine (« démissionné » ≈ « démission ») ;
 *  - un terme de plusieurs mots est une expression : ses mots non vides doivent
 *    apparaître dans l'ordre, avec au plus 3 mots intercalés
 *    (« quitter poste » trouve « quitté mon poste », « quitter ce poste »…) ;
 *  - on évite les mots trop ambigus seuls (« quitter » seul trouverait
 *    « j'ai quitté Lyon »).
 */
export type Concept = {
  id: string;
  /** Concept « faible » : il améliore le classement sans être exigé (ex. « pourquoi »). */
  soft?: boolean;
  /** Termes qui, dans une requête, déclenchent ce concept. */
  triggers: string[];
  /** Formulations acceptées dans la transcription (les déclencheurs sont inclus d'office). */
  terms: string[];
};

export const CONCEPTS: Concept[] = [
  {
    id: 'cause',
    soft: true,
    triggers: ['pourquoi', 'raison', 'raisons', 'motif', 'motifs', 'cause'],
    terms: [
      'parce que', 'car', 'raison', 'raisons', 'cause', 'à cause', 'en raison', 'motif', 'puisque',
      'c’est pour ça', 'c’est pour cela', 'voilà pourquoi', 'pour cette raison', 'explique', 'la vraie raison',
    ],
  },
  {
    id: 'demission',
    triggers: [
      'démission', 'démissionner', 'démissionné', 'démissionnaire', 'quitter poste', 'quitter fonctions',
      'quitter travail', 'quitter emploi', 'quitter entreprise', 'quitter job', 'parti entreprise', 'départ',
    ],
    terms: [
      'démission', 'démissionner', 'quitter poste', 'quitter fonctions', 'quitter travail', 'quitter emploi',
      'quitter entreprise', 'quitter boîte', 'quitter job', 'quitter boulot', 'quitter rédaction',
      'quitter ministère', 'quitter direction', 'quitter conseil', 'partir entreprise', 'partir boîte',
      'claquer porte', 'rendre tablier', 'jeter éponge', 'départ volontaire', 'renoncer poste',
      'arrêter travailler', 'lettre démission', 'quitter navire', 'remettre démission',
    ],
  },
  {
    id: 'licenciement',
    triggers: ['licencié', 'licencier', 'licenciement', 'viré', 'virer', 'renvoyé', 'renvoyer', 'limogé', 'limoger', 'congédié'],
    terms: [
      'licencier', 'licenciement', 'virer', 'viré', 'renvoyer', 'renvoyé', 'limoger', 'limogeage', 'congédier',
      'été remercié', 'fait remercier', 'mis porte', 'débarqué', 'évincé', 'écarté', 'rupture conventionnelle',
      'plan social',
    ],
  },
  {
    id: 'argent',
    triggers: ['salaire', 'payé', 'payer', 'paie', 'paye', 'rémunération', 'rémunéré', 'argent', 'gagner', 'gagnait', 'combien gagnait'],
    terms: [
      'salaire', 'payé', 'payer', 'paie', 'paye', 'rémunération', 'rémunéré', 'argent', 'gagner', 'euros',
      'fiche paie', 'smic', 'revenu', 'revenus', 'fric', 'thune', 'gagnais', 'gagnait',
    ],
  },
  {
    id: 'peur',
    triggers: ['peur', 'crainte', 'craindre', 'angoisse', 'effrayé', 'inquiet', 'inquiétude', 'trouille'],
    terms: [
      'peur', 'crainte', 'craindre', 'craignais', 'angoisse', 'angoissé', 'effrayé', 'terrifié', 'inquiet',
      'inquiétude', 'trouille', 'frousse', 'panique', 'paniqué', 'mort peur',
    ],
  },
  {
    id: 'regret',
    triggers: ['regret', 'regrets', 'regretter', 'regrette', 'regretté'],
    terms: [
      'regret', 'regretter', 'si c’était à refaire', 'remords', 'erreur', 'erreurs', 'faute', 'je m’en veux',
    ],
  },
  {
    id: 'colere',
    triggers: ['colère', 'énervé', 'furieux', 'fâché', 'agacé', 'révolté', 'indigné'],
    terms: ['colère', 'énervé', 'furieux', 'furieuse', 'fâché', 'agacé', 'révolté', 'indigné', 'rage', 'hors de moi', 'exaspéré'],
  },
  {
    id: 'desaccord',
    triggers: ['désaccord', 'opposé', 'opposer', 'contester', 'refuser', 'refus', 'pas d’accord', 'défendre'],
    terms: [
      'désaccord', 'pas d’accord', 'opposé', 'opposer', 'contester', 'contesté', 'refuser', 'refusé', 'refus',
      'pouvais plus défendre', 'défendre', 'cautionner', 'assumer', 'conscience', 'pas en accord', 'valeurs',
    ],
  },
  {
    id: 'decision',
    triggers: ['décision', 'décider', 'décidé', 'choix', 'choisir'],
    terms: ['décision', 'décider', 'décidé', 'choix', 'choisir', 'choisi', 'trancher', 'tranché', 'arbitrage', 'arbitré'],
  },
  {
    id: 'direction',
    triggers: ['patron', 'direction', 'chef', 'dirigeant', 'dirigeants', 'hiérarchie', 'supérieur', 'pdg'],
    terms: ['patron', 'direction', 'chef', 'dirigeant', 'dirigeants', 'hiérarchie', 'supérieur', 'pdg', 'directeur', 'directrice', 'actionnaires', 'conseil d’administration'],
  },
  {
    id: 'mensonge',
    triggers: ['mensonge', 'mentir', 'menti', 'cacher', 'caché', 'dissimuler'],
    terms: ['mensonge', 'mentir', 'menti', 'cacher', 'caché', 'dissimuler', 'dissimulé', 'tromper', 'trompé', 'omerta', 'étouffer affaire'],
  },
  {
    id: 'sante',
    triggers: ['santé', 'malade', 'maladie', 'burn out', 'épuisement', 'épuisé', 'déprime', 'dépression'],
    terms: ['santé', 'malade', 'maladie', 'burn out', 'burnout', 'épuisement', 'épuisé', 'déprime', 'dépression', 'arrêt maladie', 'dormais plus', 'craqué', 'à bout'],
  },
  {
    id: 'famille',
    triggers: ['famille', 'enfants', 'enfant', 'femme', 'mari', 'parents', 'père', 'mère'],
    terms: ['famille', 'enfants', 'enfant', 'femme', 'mari', 'épouse', 'parents', 'père', 'mère', 'fils', 'fille', 'proches', 'conjoint'],
  },
  {
    id: 'enfance',
    triggers: ['enfance', 'jeunesse', 'petit', 'grandi', 'grandir'],
    terms: ['enfance', 'jeunesse', 'enfant', 'quand j’étais petit', 'quand j’étais petite', 'grandi', 'grandir', 'adolescence', 'adolescent'],
  },
  {
    id: 'debut',
    triggers: ['commencer', 'commencé', 'début', 'débuts', 'démarrer', 'démarré', 'premier jour'],
    terms: ['commencer', 'commencé', 'début', 'débuts', 'démarrer', 'démarré', 'premier jour', 'premiers pas', 'arrivé', 'embauché', 'recruté'],
  },
  {
    id: 'avenir',
    triggers: ['avenir', 'futur', 'projets', 'projet', 'demain'],
    terms: ['avenir', 'futur', 'projets', 'projet', 'demain', 'prochaine étape', 'désormais', 'à l’avenir'],
  },
  {
    id: 'succes',
    triggers: ['réussite', 'réussir', 'succès', 'fierté', 'fier'],
    terms: ['réussite', 'réussir', 'réussi', 'succès', 'fierté', 'fier', 'fière', 'victoire', 'gagné pari'],
  },
  {
    id: 'echec',
    triggers: ['échec', 'échouer', 'raté', 'rater', 'perdu'],
    terms: ['échec', 'échouer', 'échoué', 'raté', 'rater', 'perdu', 'fiasco', 'désastre', 'catastrophe'],
  },
  {
    id: 'scandale',
    triggers: ['scandale', 'affaire', 'polémique', 'révélation', 'révélations'],
    terms: ['scandale', 'affaire', 'polémique', 'révélation', 'révélations', 'enquête', 'lanceur d’alerte', 'fuite', 'fuites'],
  },
];
