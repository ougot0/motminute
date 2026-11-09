/** Une citation enregistrée ramène à son passage audio, même après redémarrage. */
import * as Clipboard from 'expo-clipboard';
import { router as appRouter } from 'expo-router';
import { act, fireEvent, screen, testRouter, waitFor, within } from 'expo-router/testing-library';

import { DEMO_ID, DEMO_TRANSCRIPT } from '../src/data/demo';
import type { Repository } from '../src/data/repository';
import { formatQuote } from '../src/lib/quote';
import { mockPlayer } from '../__mocks__/expo-audio';
import { bootApp, KEY, tempDir } from './helpers/harness';
import type { ClosableDb } from './helpers/nodeSqlite';

jest.setTimeout(30000);

let tmp: ReturnType<typeof tempDir>;
let db: ClosableDb;
let repo: Repository;

async function boot() {
  const r = await bootApp(tmp.dir);
  db = r.db;
  repo = r.repo;
  return r.router;
}

beforeEach(() => {
  tmp = tempDir();
  jest.clearAllMocks();
  mockPlayer.currentTime = 0;
  mockPlayer.playing = false;
});

afterEach(() => {
  db.close();
  tmp.cleanup();
});

it('une citation enregistrée ramène au passage audio après redémarrage', async () => {
  await boot();
  const keySeg = (await repo.listSegments(DEMO_ID)).find((s) => s.start === KEY.start)!;
  await repo.saveQuote({ interviewId: DEMO_ID, segmentId: keySeg.id, text: keySeg.text, start: keySeg.start, end: keySeg.end, interviewTitle: DEMO_TRANSCRIPT.title });
  screen.unmount();
  db.close();

  // « Redémarrage » : nouvelle connexion au même fichier, nouvelle arborescence d'écrans.
  await boot();
  await screen.findByText(DEMO_TRANSCRIPT.title);
  fireEvent.press(await screen.findByText('Citations'));
  fireEvent.press(await screen.findByText('▶ Réécouter'));
  await waitFor(() => expect(mockPlayer.seekTo).toHaveBeenCalledWith(1122, 0, 0));
});
