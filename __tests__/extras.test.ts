import demo from '../src/data/demoTranscript.json';
import { WebRepository } from '../src/data/db.web';
import { extractTopics } from '../src/lib/topics';
import { formatTranscript } from '../src/lib/transcriptExport';
import { addMarker, loadMarkers, removeMarker } from '../src/services/markers';

it('repères : ajout trié, doublons proches ignorés, suppression', async () => {
  const repo = new WebRepository();
  await addMarker(repo, 'i1', 1122);
  await addMarker(repo, 'i1', 190);
  await addMarker(repo, 'i1', 1123); // trop proche de 1122
  expect((await loadMarkers(repo, 'i1')).map((m) => m.t)).toEqual([190, 1122]);
  await removeMarker(repo, 'i1', 190);
  expect((await loadMarkers(repo, 'i1')).map((m) => m.t)).toEqual([1122]);
});

it('sujets de la démo : mots porteurs de sens, sans mots vides', () => {
  const topics = extractTopics(demo.segments.map((s) => s.text));
  expect(topics.length).toBeGreaterThanOrEqual(4);
  expect(topics).toContain('décision');
  for (const w of topics) expect(['parce', 'vraiment', 'alors', 'cette']).not.toContain(w);
});

it('transcription exportée : minutage et texte affiché', () => {
  const out = formatTranscript('Titre', [{ start: 1122, text: 'J’ai quitté mon poste.' }]);
  expect(out).toBe('Titre\n\n[18:42] J’ai quitté mon poste.');
});
