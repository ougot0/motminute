import type { Repository } from '../data/repository';

/** Repères « moment fort » posés pendant l'enregistrement ou à l'écoute. */
export type Marker = { t: number; createdAt: number };

const KEY = (id: string) => `markers:${id}`;

export async function loadMarkers(repo: Repository, interviewId: string): Promise<Marker[]> {
  try {
    const raw = await repo.getSetting(KEY(interviewId));
    return raw ? (JSON.parse(raw) as Marker[]).sort((a, b) => a.t - b.t) : [];
  } catch {
    return [];
  }
}

export async function saveMarkers(repo: Repository, interviewId: string, markers: Marker[]): Promise<void> {
  await repo.setSetting(KEY(interviewId), JSON.stringify([...markers].sort((a, b) => a.t - b.t)));
}

/** Ajoute un repère ; ignoré s'il en existe déjà un à moins de 2 s. */
export async function addMarker(repo: Repository, interviewId: string, t: number, now = Date.now()): Promise<Marker[]> {
  const list = await loadMarkers(repo, interviewId);
  if (list.some((m) => Math.abs(m.t - t) < 2)) return list;
  const next = [...list, { t: Math.max(0, t), createdAt: now }];
  await saveMarkers(repo, interviewId, next);
  return next.sort((a, b) => a.t - b.t);
}

export async function removeMarker(repo: Repository, interviewId: string, t: number): Promise<Marker[]> {
  const next = (await loadMarkers(repo, interviewId)).filter((m) => m.t !== t);
  await saveMarkers(repo, interviewId, next);
  return next;
}
