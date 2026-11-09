import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DEMO_ID, seedDemo } from '../src/data/demo';
import { Repository } from '../src/data/repository';
import { canStartTranscription, FREE_QUOTA_SECONDS, quotaSnapshot } from '../src/lib/quota';
import { formatQuote } from '../src/lib/quote';
import {
  EngineUnavailableError,
  QuotaExceededError,
  runTranscription,
  type EngineAvailability,
  type TranscriptionEngine,
} from '../src/services/transcriptionRunner';
import { openNodeDb, type ClosableDb } from './helpers/nodeSqlite';

let dir: string;
let dbPath: string;
let db: ClosableDb;
let repo: Repository;

/** Ouvre la base comme au lancement de l'app. */
async function launchApp() {
  db = openNodeDb(dbPath);
  repo = new Repository(db);
  await repo.migrate();
  await seedDemo(repo);
  await repo.recoverInterrupted();
}

/** Ferme tout : équivalent d'un redémarrage de l'iPhone / de l'app. */
async function restartApp() {
  db.close();
  await launchApp();
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'motminute-'));
  dbPath = join(dir, 'motminute.db');
  await launchApp();
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

let n = 0;
async function importInterview(durationSec: number, title = `Interview ${++n}`) {
  const id = `it-${n}-${durationSec}`;
  await repo.insertInterview({
    id,
    title,
    durationSec,
    createdAt: Date.now() + n,
    audioRef: `${id}.m4a`,
    originalFilename: `${title}.m4a`,
    source: 'user',
  });
  return id;
}

function fakeEngine(behaviour: 'ok' | 'fail' | 'cancel' | 'empty', availability: EngineAvailability = 'ready'): TranscriptionEngine & { calls: number } {
  return {
    name: 'FakeEngine',
    calls: 0,
    async availability() {
      return availability;
    },
    async ensureModel(_l, onProgress) {
      onProgress(1);
    },
    async transcribe(_uri, _l, onProgress) {
      this.calls++;
      onProgress(0.5);
      if (behaviour === 'fail') throw Object.assign(new Error('décodeur'), { code: 'ERR_X' });
      if (behaviour === 'cancel') throw Object.assign(new Error('Transcription interrompue.'), { code: 'ERR_CANCELLED' });
      if (behaviour === 'empty') return [];
      return [
        { start: 12.5, end: 17.2, text: 'Bonjour à tous.' },
        { start: 1122, end: 1125.04, text: 'J’ai quitté mon poste parce que je ne pouvais plus défendre cette décision.' },
      ];
    },
    async cancel() {},
  };
}

describe('persistance après redémarrage', () => {
  it('conserve interviews, titres, corrections, citations et état de transcription', async () => {
    const id = await importInterview(45 * 60, 'Entretien Dupont');
    await runTranscription(repo, fakeEngine('ok'), { interviewId: id, fileUri: 'file:///x.m4a', isPro: true });
    await repo.renameInterview(id, 'Entretien Dupont — version finale');
    const [, seg] = await repo.listSegments(id);
    await repo.updateSegmentText(seg.id, 'J’ai quitté mon poste parce que je ne pouvais plus défendre cette décision-là.');
    await repo.saveQuote({ interviewId: id, segmentId: seg.id, text: seg.text, start: seg.start, end: seg.end, interviewTitle: 'Entretien Dupont — version finale' });

    await restartApp();

    const it = await repo.getInterview(id);
    expect(it?.title).toBe('Entretien Dupont — version finale');
    expect(it?.status).toBe('done');
    expect(it?.durationSec).toBe(2700);
    const segs = await repo.listSegments(id);
    expect(segs).toHaveLength(2);
    expect(segs[1].text).toBe('J’ai quitté mon poste parce que je ne pouvais plus défendre cette décision-là.');
    expect(segs[1].edited).toBe(true);
    expect(segs[1].start).toBe(1122); // le repère audio n'a pas bougé
    expect(segs[1].end).toBe(1125.04);
    const quotes = await repo.listQuotes();
    expect(quotes).toHaveLength(1);
    expect(quotes[0].start).toBe(1122);
    expect(quotes[0].segmentId).toBe(seg.id);
  });

  it('ajoute la démo une seule fois et ne la recrée pas si on la supprime', async () => {
    expect((await repo.getInterview(DEMO_ID))?.status).toBe('done');
    await repo.deleteInterview(DEMO_ID);
    await restartApp();
    expect(await repo.getInterview(DEMO_ID)).toBeNull();
    await seedDemo(repo, { force: true });
    expect((await repo.listSegments(DEMO_ID)).length).toBeGreaterThan(10);
  });

  it('un traitement coupé par la fermeture de l’app devient « interrompu » et se relance sans réimport', async () => {
    const id = await importInterview(600);
    await repo.setStatus(id, 'processing'); // l'app est tuée pendant la transcription
    await restartApp();
    const it = await repo.getInterview(id);
    expect(it?.status).toBe('interrupted');
    expect(it?.audioRef).toBe(`${id}.m4a`);
    expect(await repo.usedTranscriptionSeconds()).toBe(0);

    const result = await runTranscription(repo, fakeEngine('ok'), { interviewId: id, fileUri: 'file:///x.m4a', isPro: false });
    expect(result).toBe('done');
    expect(await repo.usedTranscriptionSeconds()).toBe(600);
  });
});

describe('quota gratuit : seuls les traitements terminés comptent', () => {
  it('erreur, annulation et transcription vide ne consomment rien', async () => {
    const a = await importInterview(20 * 60);
    expect(await runTranscription(repo, fakeEngine('fail'), { interviewId: a, fileUri: 'f', isPro: false })).toBe('error');
    expect((await repo.getInterview(a))?.errorMessage).toContain('décodeur');
    expect(await runTranscription(repo, fakeEngine('cancel'), { interviewId: a, fileUri: 'f', isPro: false })).toBe('interrupted');
    expect(await runTranscription(repo, fakeEngine('empty'), { interviewId: a, fileUri: 'f', isPro: false })).toBe('error');
    expect(await repo.usedTranscriptionSeconds()).toBe(0);

    // relance réussie : comptée une seule fois
    expect(await runTranscription(repo, fakeEngine('ok'), { interviewId: a, fileUri: 'f', isPro: false })).toBe('done');
    expect(await repo.usedTranscriptionSeconds()).toBe(1200);
  });

  it('la démo n’est jamais comptée', async () => {
    expect(await repo.usedTranscriptionSeconds()).toBe(0);
  });

  it('bloque une nouvelle transcription qui dépasserait 60 minutes cumulées', async () => {
    const a = await importInterview(45 * 60);
    await runTranscription(repo, fakeEngine('ok'), { interviewId: a, fileUri: 'f', isPro: false });
    const b = await importInterview(20 * 60);
    const engine = fakeEngine('ok');
    await expect(runTranscription(repo, engine, { interviewId: b, fileUri: 'f', isPro: false })).rejects.toBeInstanceOf(QuotaExceededError);
    expect(engine.calls).toBe(0);
    expect((await repo.getInterview(b))?.status).toBe('pending'); // rien n'a été lancé

    const c = await importInterview(15 * 60); // tient exactement dans les 15 min restantes
    expect(await runTranscription(repo, fakeEngine('ok'), { interviewId: c, fileUri: 'f', isPro: false })).toBe('done');
    expect(await repo.usedTranscriptionSeconds()).toBe(FREE_QUOTA_SECONDS);
  });

  it('Pro transcrit sans limite ; après expiration les interviews restent accessibles', async () => {
    const a = await importInterview(50 * 60);
    const b = await importInterview(50 * 60);
    await runTranscription(repo, fakeEngine('ok'), { interviewId: a, fileUri: 'f', isPro: true });
    await runTranscription(repo, fakeEngine('ok'), { interviewId: b, fileUri: 'f', isPro: true });
    expect(await repo.usedTranscriptionSeconds()).toBe(6000);

    // abonnement expiré : plus de nouvelle transcription…
    const c = await importInterview(60);
    await expect(runTranscription(repo, fakeEngine('ok'), { interviewId: c, fileUri: 'f', isPro: false })).rejects.toBeInstanceOf(QuotaExceededError);
    // …mais les interviews existantes restent lisibles et cherchables
    expect((await repo.listSegments(a)).length).toBe(2);
    expect((await repo.allSearchableSegments()).some((s) => s.interviewId === b)).toBe(true);
  });

  it('supprimer une interview ne rend pas de minutes', async () => {
    const a = await importInterview(30 * 60);
    await runTranscription(repo, fakeEngine('ok'), { interviewId: a, fileUri: 'f', isPro: false });
    await repo.deleteInterview(a);
    await restartApp();
    expect(await repo.usedTranscriptionSeconds()).toBe(1800);
  });

  it('moteur indisponible : message clair, rien n’est consommé ni modifié', async () => {
    const a = await importInterview(60);
    await expect(runTranscription(repo, fakeEngine('ok', 'unsupported-os'), { interviewId: a, fileUri: 'f', isPro: false })).rejects.toBeInstanceOf(
      EngineUnavailableError,
    );
    expect((await repo.getInterview(a))?.status).toBe('pending');
  });

  it('calculs de quota', () => {
    expect(quotaSnapshot(1200, false).remainingSeconds).toBe(2400);
    expect(quotaSnapshot(99999, true).limitSeconds).toBeNull();
    expect(canStartTranscription({ usedSeconds: 3000, durationSeconds: 601, isPro: false }).allowed).toBe(false);
    expect(canStartTranscription({ usedSeconds: 3000, durationSeconds: 600, isPro: false }).allowed).toBe(true);
  });
});

describe('citation copiée', () => {
  it('reprend le texte affiché mot pour mot, le titre et le minutage', () => {
    const text = 'J’ai quitté mon poste parce que je ne pouvais plus défendre cette décision.';
    expect(formatQuote({ text, interviewTitle: 'Entretien Dupont', start: 1122.9 })).toBe(`« ${text} »\n— Entretien Dupont, 18:42`);
  });
});
