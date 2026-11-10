import { formatTimestamp } from './time';

/** Transcription complète en texte, chaque bloc précédé de son minutage (texte affiché, corrections comprises). */
export function formatTranscript(title: string, segments: { start: number; text: string }[]): string {
  return [title, '', ...segments.map((s) => `[${formatTimestamp(s.start)}] ${s.text}`)].join('\n');
}
