/** 1122 → « 18:42 » ; 3725 → « 1:02:05 ». Tronque à la seconde (le passage commence à cet instant). */
export function formatTimestamp(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** Durée lisible : « 45 min », « 1 h 05 », « 38 s ». */
export function formatDuration(totalSeconds: number): string {
  const s = Math.round(Math.max(0, totalSeconds || 0));
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h === 0) return `${Math.round(s / 60)} min`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

export function formatDate(ms: number): string {
  return DATE_FMT.format(new Date(ms));
}

/** Position de départ pour « écouter avec contexte ». */
export function contextStart(start: number, contextSeconds = 5): number {
  return Math.max(0, start - contextSeconds);
}
