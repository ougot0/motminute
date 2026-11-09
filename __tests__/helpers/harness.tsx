import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { configure, renderRouter } from 'expo-router/testing-library';

import Library from '../../src/app/index';
import Interview from '../../src/app/interview/[id]';
import Paywall from '../../src/app/paywall';
import Quotes from '../../src/app/quotes';
import Settings from '../../src/app/settings';
import { DEMO_TRANSCRIPT, seedDemo } from '../../src/data/demo';
import { Repository } from '../../src/data/repository';
import type { TranscriptionEngine } from '../../src/services/transcriptionRunner';
import { AppStateProvider } from '../../src/state/AppState';
import { RootStack } from '../../src/ui/RootStack';
import { openNodeDb, type ClosableDb } from './nodeSqlite';

configure({ asyncUtilTimeout: 5000 });

export const KEY = DEMO_TRANSCRIPT.segments.find((s) => s.text.startsWith('J’ai quitté mon poste'))!;

const engine: TranscriptionEngine = {
  name: 'test',
  availability: async () => 'module-missing',
  ensureModel: async () => undefined,
  transcribe: async () => [],
  cancel: async () => undefined,
};

export function tempDir(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'motminute-ui-'));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Lance l'app (vraie base SQLite sur fichier, vrais écrans, vrai routeur). */
export async function bootApp(dir: string): Promise<{ repo: Repository; db: ClosableDb; router: Awaited<ReturnType<typeof renderRouter>> }> {
  const db = openNodeDb(join(dir, 'motminute.db'));
  const repo = new Repository(db);
  await repo.migrate();
  await seedDemo(repo);
  await repo.recoverInterrupted();
  const Layout = () => (
    <AppStateProvider repository={repo} engine={engine}>
      <RootStack />
    </AppStateProvider>
  );
  const router = await renderRouter(
    { _layout: Layout, index: Library, 'interview/[id]': Interview, quotes: Quotes, settings: Settings, paywall: Paywall },
    { initialUrl: '/' },
  );
  // renderRouter active des minuteries simulées ; l'app utilise de vrais délais
  // (recherche pendant la frappe), on revient donc au temps réel.
  jest.useRealTimers();
  return { repo, db, router };
}
