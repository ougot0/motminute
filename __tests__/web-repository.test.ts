/** La base de l'aperçu web se comporte comme la base iPhone pour la démo et le quota. */
import { DEMO_ID, seedDemo } from '../src/data/demo';
import { WebRepository } from '../src/data/db.web';
import { search } from '../src/lib/search';

// Sans localStorage (environnement de test), la base reste en mémoire.

it('démo, recherche à 18:42, citation, correction et quota', async () => {
  const repo = new WebRepository();
  await seedDemo(repo);
  const segs = await repo.allSearchableSegments();
  const hit = search('pourquoi il a démissionné', segs.map((s) => ({ interviewId: s.interviewId, interviewTitle: s.interviewTitle, segmentId: s.id, start: s.start, end: s.end, text: s.text })))[0];
  expect(hit.start).toBe(1122);
  await repo.updateSegmentText(hit.segmentId, 'Texte corrigé.');
  expect((await repo.getSegment(hit.segmentId))?.start).toBe(1122);
  await repo.saveQuote({ interviewId: DEMO_ID, segmentId: hit.segmentId, text: 'x', start: 1122, end: 1125, interviewTitle: 't' });
  expect(await repo.listQuotes()).toHaveLength(1);
  expect(await repo.usedTranscriptionSeconds()).toBe(0);
});
