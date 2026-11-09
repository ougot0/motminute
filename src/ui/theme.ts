import { Platform } from 'react-native';

// Palette : blanc cassé, texte bleu encre, bleu électrique pour l'action, menthe pour les repères actifs.
export const colors = {
  bg: '#F8F7F3', // blanc cassé
  surface: '#FFFFFF',
  surfaceAlt: '#EFEFF4',
  border: '#E3E3EA',
  text: '#121A3A', // bleu encre
  muted: '#5A6378',
  faint: '#8B93A5',
  accent: '#2B00FF', // bleu électrique : boutons, liens, sélection, minutages
  accentSoft: '#ECE8FF',
  mint: '#5EEFC5', // menthe du logo : point du lecteur
  mintText: '#0B7F5E', // menthe foncée lisible : minutage actif
  mintSoft: '#DCFBF1',
  ink: '#2B00FF', // fond des boutons principaux
  onInk: '#FFFFFF',
  ok: '#1E7A5C',
  okSoft: '#DDF6EE',
  warn: '#8A5A00',
  warnSoft: '#FBF0D4',
  danger: '#B42318',
  dangerSoft: '#FDE8E6',
  highlight: '#E1DBFF',
  playing: '#F1FCF8',
};

export const fonts = {
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  serif: Platform.select({ ios: 'Georgia', default: 'serif' }),
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 6, md: 8, lg: 10, pill: 999 };

/** Cible tactile minimale recommandée par Apple. */
export const HIT = 44;
