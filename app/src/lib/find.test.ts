import { describe, expect, it } from 'vitest';
import { countHits, findEverything } from './find';
import type { CourseUpdate } from './types';
import ECON from '../data/courses/econ';
import { buildCatalog } from '../data/catalog';


describe('a query that is a sentence', () => {
  const cat = buildCatalog([]);
  const screens = (q: string) =>
    findEverything(cat, new Date(), q, [], [])
      .flatMap((g) => g.hits)
      .filter((h) => h.kind === 'screen')
      .map((h) => h.screen);

  it('finds a page by words in any order', () => {
    // Until this, the whole query had to appear as one run of characters, so
    // "delete my account" found nothing while "delete account" found the page
    // whose button is literally labelled Delete my account.
    expect(screens('delete my account')).toContain('privacy');
    expect(screens('delete account')).toContain('privacy');
  });

  it('handles the words people put in between', () => {
    expect(screens('where are my grades')).toContain('grades');
  });

  it('does not outrank a direct match', () => {
    // The loose match is a last resort, not a competitor.
    const hits = findEverything(cat, new Date(), 'take it with you', [], [])
      .flatMap((g) => g.hits)
      .filter((h) => h.kind === 'screen');
    expect(hits[0]?.screen).toBe('export');
  });

  it('still finds nothing for words that are nowhere', () => {
    expect(screens('parsnip velocity brigade')).toEqual([]);
  });

  it('needs every word, not any of them', () => {
    // Otherwise one common word would match everything.
    expect(screens('grades parsnip')).toEqual([]);
  });
});

describe('material added since the courses were imported', () => {
  // A real course, because the point is that added content joins module
  // content in the same index rather than sitting beside it.
  const cat = buildCatalog([ECON]);
  const reading = (over: Partial<CourseUpdate> = {}): CourseUpdate => ({
    id: 'u1',
    courseId: cat.courses[0].id,
    unit: null,
    title: 'Redlining and the HOLC',
    source: 'Reading 7',
    body: '',
    created: 1,
    cards: [{ q: 'What did the HOLC grade?', a: 'It graded 239 cities between 1930 and 1960.' }],
    terms: [],
    fileIds: [],
    ...over,
  });

  it('is findable by the name of the unit it made', () => {
    // Search read the modules as compiled, so typing the name of the thing you
    // added yesterday returned nothing — which reads as "it did not save".
    const before = findEverything(cat, new Date(), 'redlining', [], []);
    expect(countHits(before)).toBe(0);
    const after = findEverything(cat, new Date(), 'redlining', [], [], undefined, [reading()]);
    expect(countHits(after)).toBeGreaterThan(0);
  });

  it('is findable by the text of a card inside it', () => {
    const hits = findEverything(cat, new Date(), 'HOLC', [], [], undefined, [reading()]);
    expect(countHits(hits)).toBeGreaterThan(0);
  });

  it('opens the unit it actually made, not a stale index', () => {
    const hits = findEverything(cat, new Date(), 'redlining', [], [], undefined, [reading()])
      .flatMap((g) => g.hits)
      .filter((h) => h.kind === 'unit');
    expect(hits).toHaveLength(1);
    expect(hits[0].courseId).toBe(cat.courses[0].id);
  });

  it('changes nothing when there is nothing added', () => {
    const q = 'redlining';
    expect(findEverything(cat, new Date(), q, [], [], undefined, [])).toEqual(
      findEverything(cat, new Date(), q, [], []),
    );
  });
});
