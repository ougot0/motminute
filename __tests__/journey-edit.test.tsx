/** Corriger un bloc : le texte copié change, jamais les repères audio. */
import * as Clipboard from 'expo-clipboard';
import { router as appRouter } from 'expo-router';
import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

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

it('corriger un bloc change le texte copié mais pas son minutage', async () => {
  await boot();
  const keySeg = (await repo.listSegments(DEMO_ID)).find((s) => s.start === KEY.start)!;
  await screen.findByText(DEMO_TRANSCRIPT.title);
  fireEvent.changeText(screen.getByTestId('library-search'), '« défendre cette décision »');
  fireEvent.press(await screen.findByTestId(`hit-${keySeg.id}`));
  fireEvent.press(await screen.findByTestId('act-edit'));
  const corrected = 'J’ai quitté mon poste, parce que je ne pouvais plus défendre cette décision.';
  fireEvent.changeText(await screen.findByTestId('prompt-input'), corrected);
  await screen.findByDisplayValue(corrected); // la saisie est affichée avant de valider
  fireEvent.press(screen.getByTestId('prompt-confirm'));
  // Le panneau du passage affiche le texte corrigé une fois enregistré.
  await screen.findByText('J’ai quitté mon poste, parce que je ne pouvais plus défendre cette décision.');
  expect((await repo.getSegment(keySeg.id))?.edited).toBe(true);
  const edited = (await repo.getSegment(keySeg.id))!;
  expect(edited.start).toBe(1122);
  expect(edited.end).toBe(keySeg.end);

  fireEvent.press(await screen.findByTestId('act-copy'));
  await waitFor(() =>
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith(
      `« J’ai quitté mon poste, parce que je ne pouvais plus défendre cette décision. »\n— ${DEMO_TRANSCRIPT.title}, 18:42`,
    ),
  );
});
