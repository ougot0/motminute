/** Aperçu web : importer un exemple → transcription simulée → recherche → quota. */
import { WebRepository } from '../src/data/db.web';
import { SAMPLES, sampleRef } from '../src/data/samples';
import { search } from '../src/lib/search';
import { createSampleEngine } from '../src/services/sampleEngine';
import { runTranscription } from '../src/services/transcriptionRunner';

it('importe et transcrit l’exemple, puis le passage est cherchable', async () => {
  const repo = new WebRepository();
  const s = SAMPLES[0];
  await repo.insertInterview({ id: 'ex1', title: s.title, durationSec: s.durationSec, createdAt: 1, audioRef: sampleRef(s.id), originalFilename: s.fileName, source: 'user' });
  const progress: number[] = [];
  expect(await runTranscription(repo, createSampleEngine(1), { interviewId: 'ex1', fileUri: sampleRef(s.id), isPro: false }, { onProgress: (f) => progress.push(f) })).toBe('done');
  expect(progress.at(-1)).toBe(1);
  const docs = (await repo.allSearchableSegments()).map((x) => ({ interviewId: x.interviewId, interviewTitle: x.interviewTitle, segmentId: x.id, start: x.start, end: x.end, text: x.text }));
  expect(search('combien d’arbres', docs)[0].text).toContain('dix mille arbres');
  expect(await repo.usedTranscriptionSeconds()).toBeCloseTo(s.durationSec);
});
