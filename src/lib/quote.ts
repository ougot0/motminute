import { formatTimestamp } from './time';

export type QuoteInput = { text: string; interviewTitle: string; start: number };

/**
 * Texte copié dans le presse-papiers. La citation reprend mot pour mot le texte
 * affiché du bloc (y compris une correction manuelle), sans retouche.
 *
 *   « J’ai quitté mon poste parce que je ne pouvais plus défendre cette décision. »
 *   — Titre de l’interview, 18:42
 */
export function formatQuote({ text, interviewTitle, start }: QuoteInput): string {
  return `« ${text} »\n— ${interviewTitle}, ${formatTimestamp(start)}`;
}
