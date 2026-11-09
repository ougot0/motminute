import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { openRepository } from '../data/db';
import type { Repository } from '../data/repository';
import { quotaSnapshot, type QuotaSnapshot } from '../lib/quota';
import { audioFileFor, deleteAudio } from '../services/audioFiles';
import { nativeEngine } from '../services/nativeEngine';
import {
  connectStore,
  isEntitlementActive,
  listenToPurchases,
  readEntitlement,
  type Entitlement,
} from '../services/subscriptions';
import {
  EngineUnavailableError,
  QuotaExceededError,
  runTranscription,
  type TranscriptionEngine,
} from '../services/transcriptionRunner';

export type Job = { interviewId: string; phase: 'model' | 'transcribing'; progress: number };

export type StartResult =
  | { kind: 'done' | 'error' | 'interrupted' }
  | { kind: 'quota'; remainingSeconds: number }
  | { kind: 'unavailable'; message: string }
  | { kind: 'busy' };

type AppState = {
  repo: Repository | null;
  fatalError: string | null;
  /** Incrémenté à chaque modification de données : les écrans se rechargent. */
  version: number;
  bump: () => void;
  quota: QuotaSnapshot;
  isPro: boolean;
  entitlement: Entitlement | null;
  devPro: boolean;
  setDevPro: (v: boolean) => Promise<void>;
  refreshEntitlement: () => Promise<void>;
  storeError: string | null;
  job: Job | null;
  startTranscription: (interviewId: string) => Promise<StartResult>;
  cancelTranscription: () => Promise<void>;
  deleteInterview: (interviewId: string) => Promise<void>;
  semanticEnabled: boolean;
  setSemanticEnabled: (v: boolean) => Promise<void>;
};

const Ctx = createContext<AppState | null>(null);

const ENTITLEMENT_KEY = 'entitlement_cache';
const DEV_PRO_KEY = 'dev_simulated_pro';
const SEMANTIC_KEY = 'semantic_search_enabled';

export function AppStateProvider({
  children,
  repository,
  engine = nativeEngine,
}: {
  children: ReactNode;
  /** Injecté par les tests ; sinon la base SQLite de l'app est ouverte. */
  repository?: Repository;
  engine?: TranscriptionEngine;
}) {
  const [repo, setRepo] = useState<Repository | null>(repository ?? null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [usedSeconds, setUsedSeconds] = useState(0);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [devPro, setDevProState] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [semanticEnabled, setSemanticState] = useState(false);
  const jobRef = useRef<Job | null>(null);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (repository) return;
    openRepository().then(setRepo, (e) => setFatalError(String(e?.message ?? e)));
  }, [repository]);

  // Réglages persistants + quota
  useEffect(() => {
    if (!repo) return;
    let alive = true;
    (async () => {
      const [used, cached, dev, sem] = await Promise.all([
        repo.usedTranscriptionSeconds(),
        repo.getSetting(ENTITLEMENT_KEY),
        repo.getSetting(DEV_PRO_KEY),
        repo.getSetting(SEMANTIC_KEY),
      ]);
      if (!alive) return;
      setUsedSeconds(used);
      setDevProState(dev === '1');
      setSemanticState(sem === '1');
      if (cached) {
        try {
          setEntitlement((prev) => prev ?? (JSON.parse(cached) as Entitlement));
        } catch {
          // cache illisible : ignoré
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [repo, version]);

  const refreshEntitlement = useCallback(async () => {
    try {
      const e = await readEntitlement();
      if (!e) return; // App Store indisponible : on garde le dernier état connu
      setEntitlement(e);
      await repo?.setSetting(ENTITLEMENT_KEY, JSON.stringify(e));
    } catch (err) {
      setStoreError(String((err as Error)?.message ?? err));
    }
  }, [repo]);

  // Connexion à l'App Store et écoute des achats
  useEffect(() => {
    if (!repo || repository) return;
    let unsub = () => undefined as void;
    connectStore().then((ok) => {
      if (!ok) return;
      refreshEntitlement();
      unsub = listenToPurchases(
        () => {
          setStoreError(null);
          refreshEntitlement();
        },
        (msg) => setStoreError(msg),
      );
    });
    return () => unsub();
  }, [repo, repository, refreshEntitlement]);

  const isPro = devPro || isEntitlementActive(entitlement);
  const quota = useMemo(() => quotaSnapshot(usedSeconds, isPro), [usedSeconds, isPro]);

  const startTranscription = useCallback(
    async (interviewId: string): Promise<StartResult> => {
      if (!repo) return { kind: 'unavailable', message: 'Base de données non prête.' };
      if (jobRef.current) return { kind: 'busy' };
      const interview = await repo.getInterview(interviewId);
      if (!interview) return { kind: 'unavailable', message: 'Interview introuvable.' };
      const update = (j: Job | null) => {
        jobRef.current = j;
        setJob(j);
      };
      update({ interviewId, phase: 'transcribing', progress: 0 });
      try {
        const result = await runTranscription(
          repo,
          engine,
          { interviewId, fileUri: audioFileFor(interview.audioRef).uri, isPro },
          {
            onPhase: (phase) => update({ interviewId, phase, progress: 0 }),
            onModelProgress: (progress) => update({ interviewId, phase: 'model', progress }),
            onProgress: (progress) => update({ interviewId, phase: 'transcribing', progress }),
          },
        );
        return { kind: result };
      } catch (e) {
        if (e instanceof QuotaExceededError) return { kind: 'quota', remainingSeconds: e.remainingSeconds };
        if (e instanceof EngineUnavailableError) return { kind: 'unavailable', message: e.message };
        return { kind: 'unavailable', message: String((e as Error)?.message ?? e) };
      } finally {
        update(null);
        bump();
      }
    },
    [repo, engine, isPro, bump],
  );

  const cancelTranscription = useCallback(async () => {
    await engine.cancel();
  }, [engine]);

  const deleteInterview = useCallback(
    async (interviewId: string) => {
      if (!repo) return;
      if (jobRef.current?.interviewId === interviewId) await engine.cancel();
      const it = await repo.getInterview(interviewId);
      await repo.deleteInterview(interviewId);
      if (it) deleteAudio(it.audioRef);
      bump();
    },
    [repo, engine, bump],
  );

  const setDevPro = useCallback(
    async (v: boolean) => {
      setDevProState(v);
      await repo?.setSetting(DEV_PRO_KEY, v ? '1' : '0');
    },
    [repo],
  );

  const setSemanticEnabled = useCallback(
    async (v: boolean) => {
      setSemanticState(v);
      await repo?.setSetting(SEMANTIC_KEY, v ? '1' : '0');
    },
    [repo],
  );

  const value: AppState = {
    repo,
    fatalError,
    version,
    bump,
    quota,
    isPro,
    entitlement,
    devPro,
    setDevPro,
    refreshEntitlement,
    storeError,
    job,
    startTranscription,
    cancelTranscription,
    deleteInterview,
    semanticEnabled,
    setSemanticEnabled,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp doit être utilisé dans AppStateProvider');
  return v;
}
