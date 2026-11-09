/**
 * Parcours principal dans l’interface (routeur Expo réel, base SQLite réelle) :
 * chercher → toucher le résultat → lecteur positionné au début du passage →
 * écouter avec contexte → copier mot pour mot → enregistrer.
 */
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

it('affiche un état vide quand aucun passage n’est pertinent', async () => {
  await boot();
  await screen.findByText(DEMO_TRANSCRIPT.title);
  fireEvent.changeText(screen.getByTestId('library-search'), 'recette de cuisine');
  expect(await screen.findByTestId('search-empty')).toBeTruthy();
  expect(screen.getByText('Aucun passage pertinent')).toBeTruthy();
});

it('« pourquoi il a démissionné » → résultat 18:42 → audio ouvert au bon passage → copie mot pour mot', async () => {
  const router = await boot();
  expect(await screen.findByText(DEMO_TRANSCRIPT.title)).toBeTruthy();

  fireEvent.changeText(screen.getByTestId('library-search'), 'pourquoi il a démissionné');

  const segs = await repo.listSegments(DEMO_ID);
  const keySeg = segs.find((s) => s.start === KEY.start)!;
  const hit = await screen.findByTestId(`hit-${keySeg.id}`);
  expect(within(hit).getByText('18:42')).toBeTruthy();
  expect(within(hit).getByText('Reformulation (synonymes)')).toBeTruthy();

  fireEvent.press(hit);

  await waitFor(() => expect(router.getPathname()).toBe(`/interview/${DEMO_ID}`));
  await waitFor(() => expect(mockPlayer.seekTo).toHaveBeenCalledWith(1122, 0, 0));
  expect(mockPlayer.play).not.toHaveBeenCalled();
  expect(screen.getByTestId('player-position')).toHaveTextContent('18:42');

  // Écouter avec 5 secondes de contexte
  fireEvent.press(screen.getByTestId('context-play'));
  await waitFor(() => expect(mockPlayer.seekTo).toHaveBeenLastCalledWith(1117, 0, 0));
  expect(mockPlayer.play).toHaveBeenCalled();

  // Copier : texte affiché + titre + minutage
  fireEvent.press(screen.getByTestId('act-copy'));
  await waitFor(() =>
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      formatQuote({ text: keySeg.text, interviewTitle: DEMO_TRANSCRIPT.title, start: keySeg.start }),
    ),
  );
  expect((Clipboard.setStringAsync as jest.Mock).mock.calls[0][0]).toBe(
    `« J’ai quitté mon poste parce que je ne pouvais plus défendre cette décision. »\n— ${DEMO_TRANSCRIPT.title}, 18:42`,
  );

  // Enregistrer la citation
  fireEvent.press(screen.getByTestId('act-save'));
  await screen.findByText('Citation enregistrée');
  expect(await repo.listQuotes()).toHaveLength(1);
});
