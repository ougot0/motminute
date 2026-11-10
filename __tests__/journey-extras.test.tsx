/** Nouveautés : repère posé à l'écoute, vitesse de lecture, sujets cliquables, transcription complète réservée à Pro. */
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { mockPlayer } from '../__mocks__/expo-audio';
import { DEMO_ID, DEMO_TRANSCRIPT } from '../src/data/demo';
import { loadMarkers } from '../src/services/markers';
import { bootApp, tempDir } from './helpers/harness';

jest.setTimeout(30000);

it('repère, vitesse, sujets et export Pro', async () => {
  const tmp = tempDir();
  const { db, repo } = await bootApp(tmp.dir);
  try {
    await screen.findByText(DEMO_TRANSCRIPT.title);
    fireEvent.changeText(screen.getByTestId('library-search'), 'pourquoi il a démissionné');
    fireEvent.press(await screen.findByTestId('hit-20'));
    await waitFor(() => expect(mockPlayer.seekTo).toHaveBeenCalledWith(1122, 0, 0));

    fireEvent.press(await screen.findByTestId('add-marker'));
    expect(await screen.findByTestId('marker-1122')).toBeTruthy();
    expect((await loadMarkers(repo, DEMO_ID)).map((m) => Math.round(m.t))).toEqual([1122]);

    fireEvent.press(screen.getByTestId('rate'));
    expect(mockPlayer.setPlaybackRate).toHaveBeenCalledWith(1.25);

    expect(screen.getByText('décision')).toBeTruthy(); // sujet détecté

    fireEvent.press(screen.getByTestId('copy-transcript'));
    expect(await screen.findByText(/transcription complète d’un coup fait partie de MotMinute Pro/)).toBeTruthy();
  } finally {
    db.close();
    tmp.cleanup();
  }
});
