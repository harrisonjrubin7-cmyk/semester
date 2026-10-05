import { expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { EMPTY_PRODUCTIVITY, newDecision, type Capture } from './productivity';
import {
  packetPiece,
  planBlocks,
  preparationContext,
  readSemanticHits,
  revisitFeed,
} from './productivity-tools';
const capture: Capture = {
  id: 'source-a',
  title: 'Research opening',
  kind: 'Website',
  source: 'https://example.edu/research',
  context: 'Applications close Friday.',
  reason: 'Fits my interest',
  next: '',
  due: '',
  status: 'Saved for later',
  authorized: true,
};
it('builds context from selected authorized sources and excludes private reflections', () => {
  const d = newDecision('Research');
  d.reflection = 'PRIVATE';
  const value = {
    ...EMPTY_PRODUCTIVITY,
    decisions: [d],
    captures: [
      capture,
      { ...capture, id: 'source-b', authorized: false, context: 'SECRET' },
    ],
  };
  const context = preparationContext(value, d.id, ['source-a', 'source-b']);
  expect(context).toContain('Applications close Friday.');
  expect(context).not.toContain('PRIVATE');
  expect(context).not.toContain('SECRET');
});
it('rejects invented excerpts, unauthorized IDs, duplicates, and malformed semantic results', () => {
  const hit = {
    id: 'source-a',
    why: 'Deadline fits',
    excerpt: 'Applications close Friday.',
  };
  expect(readSemanticHits(JSON.stringify([hit]), [capture])).toEqual([hit]);
  for (const result of [
    [{ ...hit, excerpt: 'Deadline tomorrow' }],
    [{ ...hit, id: 'invented' }],
    [hit, hit],
    null,
  ])
    expect(() => readSemanticHits(JSON.stringify(result), [capture])).toThrow();
  expect(() =>
    readSemanticHits(JSON.stringify([hit]), [
      { ...capture, authorized: false },
    ]),
  ).toThrow();
});
it('produces bounded weekly blocks across month changes and refuses invalid dates', () => {
  expect(
    planBlocks('2026-10-28', 2, 1.5, 960, 'Study', 'assumptions').map((x) => [
      x.date,
      x.minutes,
    ]),
  ).toEqual([
    ['2026-10-28', 90],
    ['2026-11-04', 90],
  ]);
  for (const args of [
    ['2026-02-30', 2, 1, 960],
    ['2026-10-01', 13, 1, 960],
    ['2026-10-01', 2, 8, 1380],
  ] as const)
    expect(() =>
      planBlocks(args[0], args[1], args[2], args[3], 'Study', ''),
    ).toThrow();
});
it('exports only reviewed content as valid PDF and DOCX', async () => {
  const pdf = await packetPiece('Reviewed content', 'pdf');
  expect((await (pdf.body as Blob).text()).startsWith('%PDF-')).toBe(true);
  const word = await packetPiece('Reviewed content', 'docx');
  const files = unzipSync(
    new Uint8Array(await (word.body as Blob).arrayBuffer()),
  );
  expect(new TextDecoder().decode(files['word/document.xml'])).toContain(
    'Reviewed content',
  );
});
it('calendar reminders contain stable IDs and exclude reflections', () => {
  const d = newDecision('Office visit');
  d.revisit = '2026-10-02';
  d.questions = 'Ask about funding';
  d.reflection = 'PRIVATE';
  const feed = revisitFeed([d]);
  expect(feed).toContain('BEGIN:VALARM');
  expect(feed).toContain('Ask about funding');
  expect(feed).not.toContain('PRIVATE');
  expect(feed).toContain(`productivity-${d.id}`);
});
