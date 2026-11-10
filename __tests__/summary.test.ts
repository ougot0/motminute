import demo from '../src/data/demoTranscript.json';
import { chunkTranscript, summarizeSegments } from '../src/services/summary';

it('découpe une longue transcription sans couper de bloc, minutages compris', () => {
  const segs = Array.from({ length: 400 }, (_, i) => ({ start: i * 7, text: 'Phrase de test assez longue pour remplir un morceau. '.repeat(2) }));
  const chunks = chunkTranscript(segs, 5000);
  expect(chunks.length).toBeGreaterThan(5);
  expect(chunks.every((c) => c.length <= 5000)).toBe(true);
  expect(chunks.join('').split('\n').filter(Boolean)).toHaveLength(400);
  expect(chunks[0].startsWith('[00:00]')).toBe(true);
});

it('résume par morceaux puis assemble (modèle simulé)', async () => {
  const prompts: string[] = [];
  const out = await summarizeSegments(demo.segments, demo.title, async (p) => {
    prompts.push(p);
    return prompts.length === 1 ? '18:42 — démission' : 'En bref …';
  });
  expect(out).toBe('En bref …');
  expect(prompts[0]).toContain('[18:42] J’ai quitté mon poste');
  expect(prompts.at(-1)).toContain('18:42 — démission');
});
