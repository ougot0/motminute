import { useEffect, useMemo, useState } from 'react';

import { search, type SearchDoc, type SearchHit } from '../lib/search';
import { semanticScores } from '../services/semantic';
import { useApp } from '../state/AppState';

/** Recherche (bibliothèque entière ou une interview) avec un léger délai de frappe. */
export function useSearch(query: string, interviewId?: string) {
  const { repo, version, semanticEnabled } = useApp();
  const [docs, setDocs] = useState<SearchDoc[]>([]);
  // Résultat de la dernière recherche terminée (requête + résultats).
  const [result, setResult] = useState<{ query: string; docs: SearchDoc[]; hits: SearchHit[] }>({ query: '', docs: [], hits: [] });

  useEffect(() => {
    if (!repo) return;
    let alive = true;
    repo.allSearchableSegments().then((segs) => {
      if (!alive) return;
      setDocs(
        segs
          .filter((s) => !interviewId || s.interviewId === interviewId)
          .map((s) => ({ interviewId: s.interviewId, interviewTitle: s.interviewTitle, segmentId: s.id, start: s.start, end: s.end, text: s.text })),
      );
    });
    return () => {
      alive = false;
    };
  }, [repo, version, interviewId]);

  const trimmed = query.trim();
  useEffect(() => {
    if (!trimmed) return;
    let alive = true;
    const t = setTimeout(async () => {
      let semantic: Map<number, number> | undefined;
      if (semanticEnabled) {
        try {
          semantic = await semanticScores(trimmed, docs);
        } catch {
          semantic = undefined;
        }
      }
      if (!alive) return;
      setResult({ query: trimmed, docs, hits: search(trimmed, docs, { semantic }) });
    }, 180);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [trimmed, docs, semanticEnabled]);

  return useMemo(() => {
    const upToDate = result.query === trimmed && result.docs === docs;
    return {
      hits: trimmed && upToDate ? result.hits : [],
      busy: Boolean(trimmed) && !upToDate,
      active: trimmed.length > 0,
      searchedCount: docs.length,
    };
  }, [result, trimmed, docs]);
}
