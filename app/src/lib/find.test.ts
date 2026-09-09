import { describe, expect, it } from 'vitest';
import { countHits, findEverything, spelled } from './find';
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
    // The grade table is the grades grain of Courses, and Courses carries its
    // keywords — so the question still lands on the screen that answers it.
    expect(screens('where are my grades')).toContain('courses');
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

describe('a word typed wrong', () => {
  const cat = buildCatalog([ECON]);
  const screens = (q: string) =>
    findEverything(cat, new Date(), q, [], [])
      .flatMap((g) => g.hits)
      .filter((h) => h.kind === 'screen')
      .map((h) => h.screen);
  const units = (q: string) =>
    findEverything(cat, new Date(), q, [], [])
      .flatMap((g) => g.hits)
      .filter((h) => h.kind === 'unit')
      .map((h) => h.title);

  it('still finds the screen', () => {
    // Every one of these returned nothing at all, under a reply suggesting the
    // person try a course code, a topic, a professor or the name of a screen.
    expect(screens('calender')).toContain('calendar');
    expect(screens('gradess')).toContain('courses');
  });

  it('forgives the typo in one word of a sentence', () => {
    expect(screens('delete my acount')).toContain('privacy');
  });

  it('does not outrank a word spelled right', () => {
    // A near miss is the last tier of all, so anything actually typed wins.
    const hits = findEverything(cat, new Date(), 'calendar', [], [])
      .flatMap((g) => g.hits)
      .filter((h) => h.kind === 'screen');
    expect(hits[0]?.screen).toBe('calendar');
  });

  it('does not dilute a query that found something', () => {
    // The spelling pass runs only when the strict one came back empty, so a
    // word spelled right never drags in the things it is one letter from.
    const hits = findEverything(cat, new Date(), 'grades', [], []).flatMap((g) => g.hits);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.score >= 10)).toBe(true);
  });

  it('puts the near miss on the name above the near miss in the blurb', () => {
    // "calender" means the Calendar screen, not the several other screens
    // whose description happens to mention a calendar.
    expect(screens('calender')[0]).toBe('calendar');
  });

  it('forgives a slip, not a different word', () => {
    expect(screens('parsnip')).toEqual([]);
    expect(units('monopoly parsnip')).toEqual([]);
  });

  it('leaves short words alone', () => {
    // At four letters a single edit reaches half the dictionary, so these are
    // held to exactness rather than turned into each other.
    expect(findEverything(cat, new Date(), 'exan', [], [])).toEqual([]);
  });

  it('finds a study unit by its course as well as its name', () => {
    // "1020 monopoly" is how somebody with two courses covering monopoly says
    // which one they mean.
    expect(units('1020 monopoly')).toContain('12 · Monopoly');
  });
});

describe('saying that the results are a guess', () => {
  const cat = buildCatalog([ECON]);
  const at = (q: string) => findEverything(cat, new Date(), q, [], []);

  it('is true when nothing was spelled the way it is stored', () => {
    expect(spelled(at('calender'))).toBe(true);
  });

  it('is false when the query matched', () => {
    expect(spelled(at('calendar'))).toBe(false);
  });

  it('is false when there is nothing at all', () => {
    // Nothing to be a guess about, and the screen says so in its own words.
    expect(at('parsnip velocity brigade')).toEqual([]);
    expect(spelled(at('parsnip velocity brigade'))).toBe(false);
  });
});
