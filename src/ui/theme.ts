import { Platform } from 'react-native';

export const colors = {
  bg: '#F6F1E7', // papier légèrement chaud
  surface: '#FFFCF6',
  surfaceAlt: '#EFE8DA',
  border: '#E1D7C5',
  text: '#2A2C30', // anthracite
  muted: '#66625A',
  faint: '#958E82',
  accent: '#9E3D17', // minutages : brique, contraste AA sur le fond
  accentSoft: '#F4E2D3',
  ink: '#2A2C30',
  onInk: '#FFFCF6',
  ok: '#2F6B43',
  okSoft: '#E1EEDF',
  warn: '#8A5A00',
  warnSoft: '#F7EBCB',
  danger: '#A12D1C',
  dangerSoft: '#F6DED8',
  highlight: '#F6DF8E',
  playing: '#FBF0D6',
};

export const fonts = {
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  serif: Platform.select({ ios: 'Georgia', default: 'serif' }),
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 6, md: 10, lg: 14, pill: 999 };

/** Cible tactile minimale recommandée par Apple. */
export const HIT = 44;
