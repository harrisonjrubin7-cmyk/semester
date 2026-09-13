import { describe, expect, it } from 'vitest';
import { countHits, findEverything, spelled } from './find';
import type { Appointment, CourseUpdate, PersonalTask } from './types';
import type { Doc } from './document';
import type { Sheet } from './sheet';
import type { StoredDeck } from './decks';
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

describe('a task in the results', () => {
  const cat = buildCatalog([]);
  const task = (over: Partial<PersonalTask> = {}): PersonalTask => ({
    id: 't1',
    title: 'Read Chapter 7',
    date: '2026-09-10',
    time: '9:00 PM',
    note: '',
    done: false,
    created: 1,
    courseId: null,
    ...over,
  });
  const sub = (now: Date, over = {}) =>
    findEverything(cat, now, 'chapter 7', [], [task(over)])
      .flatMap((g) => g.hits)
      .find((h) => h.kind === 'task')?.sub;

  it('says its date the way the rest of the app does', () => {
    // It used to print the stored value — "2026-09-10 · 9:00 PM" — which is
    // the one machine date on any screen: Personal writes the same task as
    // "Thu Sep 10", and the deadlines in the group above it read "Tomorrow".
    expect(sub(new Date('2026-09-01T12:00:00'))).toBe('Thu Sep 10 · 9:00 PM');
  });

  it('uses the near words when the date is near', () => {
    expect(sub(new Date('2026-09-10T08:00:00'))).toBe('Today · 9:00 PM');
    expect(sub(new Date('2026-09-09T08:00:00'))).toBe('Tomorrow · 9:00 PM');
  });

  it('still says Someday for a task with no date', () => {
    expect(sub(new Date('2026-09-01T12:00:00'), { date: null, time: '' })).toBe('Someday');
  });
});

describe('your own appointments', () => {
  const cat = buildCatalog([]);
  const appt = (over: Partial<Appointment> & { id: string }): Appointment => ({
    title: over.id,
    date: '2026-09-16',
    at: 600,
    time: '10:00a',
    where: '',
    note: '',
    created: 0,
    ...over,
  });
  const task = (title: string): PersonalTask => ({
    id: title,
    title,
    date: '2026-09-16',
    time: '',
    note: '',
    done: false,
    created: 0,
    courseId: null,
  });
  const NOW = new Date(2026, 8, 9);
  const search = (q: string, appointments: Appointment[], tasks: PersonalTask[] = []) =>
    findEverything(cat, NOW, q, [], tasks, undefined, [], {}, appointments);
  const titles = (q: string, appointments: Appointment[], tasks: PersonalTask[] = []) =>
    search(q, appointments, tasks).flatMap((g) => g.hits.map((h) => h.title));

  /*
   * They were not searched at all, and the control is what makes it plain: a
   * task, a note and an appointment sharing a word, one tab apart on Personal,
   * and the box answered "2 results".
   */
  it('finds one by its title', () => {
    expect(titles('zanzibar', [appt({ id: 'a1', title: 'Zanzibar advising meeting' })])).toEqual([
      'Zanzibar advising meeting',
    ]);
  });

  it('is not the reason a task is found', () => {
    // The control. Both carry the word; before this, only the task came back.
    const both = titles(
      'zanzibar',
      [appt({ id: 'a1', title: 'Zanzibar advising meeting' })],
      [task('Zanzibar reading')],
    );
    expect(both).toContain('Zanzibar reading');
    expect(both).toContain('Zanzibar advising meeting');
  });

  it('finds one by where it is and by what was written on it', () => {
    // Half of why anybody looks an appointment up is to be told where to go.
    const list = [appt({ id: 'a1', title: 'Advising', where: 'Kirkland Hall', note: 'bring the form' })];
    expect(titles('kirkland', list)).toEqual(['Advising']);
    expect(titles('bring the form', list)).toEqual(['Advising']);
  });

  it('says the date the way the rest of the app says it', () => {
    // Not "2026-09-16". The row for the same appointment on Personal reads
    // "Sep 16", and a search result is often the second time somebody sees a
    // thing they wrote.
    const [hit] = search('advising', [appt({ id: 'a1', title: 'Advising', where: 'Kirkland' })])
      .flatMap((g) => g.hits);
    expect(hit.sub).not.toMatch(/2026-09-16/);
    expect(hit.sub).toContain('Kirkland');
  });

  it('groups them under their own heading', () => {
    // "advising" also reaches a screen, which is the search working — the
    // claim here is only that appointments are their own group and not
    // quietly filed under the tasks one.
    const groups = search('advising', [appt({ id: 'a1', title: 'Advising' })]);
    const mine = groups.find((g) => g.hits.some((h) => h.kind === 'appointment'));
    expect(mine?.label).toBe('Your appointments');
  });

  it('finds nothing when there is nothing, rather than everything', () => {
    expect(titles('zanzibar', [appt({ id: 'a1', title: 'Advising meeting' })])).toEqual([]);
  });
});

describe('the things you made in the app', () => {
  const cat = buildCatalog([]);
  const NOW = new Date(2026, 8, 9);

  const doc = (over: Partial<Doc> & { id: string }): Doc => ({
    title: over.id,
    subtitle: '',
    courseId: null,
    blocks: [],
    created: 0,
    updated: 0,
    ...over,
  });
  const sheet = (over: Partial<Sheet> & { id: string }): Sheet => ({
    title: over.id,
    courseId: null,
    cells: {},
    rows: 20,
    cols: 8,
    created: 0,
    updated: 0,
    ...over,
  });
  const deck = (over: Partial<StoredDeck> & { id: string }): StoredDeck => ({
    title: over.id,
    subtitle: '',
    slides: [],
    courseId: null,
    created: 0,
    updated: 0,
    ...over,
  });

  const search = (q: string, made: Parameters<typeof findEverything>[9]) =>
    findEverything(cat, NOW, q, [], [], undefined, [], {}, [], made);
  const hits = (q: string, made: Parameters<typeof findEverything>[9]) =>
    search(q, made).flatMap((g) => g.hits);

  it('finds a document by its name', () => {
    const found = hits('rawls', { documents: [doc({ id: 'd1', title: 'Rawls essay' })] });
    expect(found.map((h) => h.title)).toContain('Rawls essay');
    expect(found[0].kind).toBe('document');
  });

  /*
   * The reason the body is searched at all. A document called "Untitled" with
   * three pages of an essay in it is exactly the one somebody looks for by
   * typing a word out of it, and exactly the one a title-only search misses.
   */
  it('finds a document by what is written in it, not only its name', () => {
    const found = hits('veil of ignorance', {
      documents: [
        doc({
          id: 'd1',
          title: 'Untitled',
          blocks: [{ kind: 'text', text: 'The veil of ignorance is the device that makes it fair.' }],
        }),
      ],
    });
    expect(found).toHaveLength(1);
    expect(found[0].title).toBe('Untitled');
  });

  it('reads every kind of block, so no kind of content is invisible', () => {
    // Filtered to documents: "elasticity" reaches a screen too, which is the
    // search working and is not what this is asking about.
    const inside = (block: Doc['blocks'][number], q: string) =>
      hits(q, { documents: [doc({ id: 'd1', title: 'Untitled', blocks: [block] })] }).filter(
        (h) => h.kind === 'document',
      ).length;
    expect(inside({ kind: 'heading', level: 1, text: 'Monopoly' }, 'monopoly')).toBe(1);
    expect(inside({ kind: 'bullets', items: ['Deadweight loss'], numbered: false }, 'deadweight')).toBe(1);
    expect(inside({ kind: 'quote', text: 'a quoted line', source: 'Mankiw' }, 'mankiw')).toBe(1);
    expect(inside({ kind: 'table', rows: [['Elasticity']], header: true, caption: '' }, 'elasticity')).toBe(1);
    expect(inside({ kind: 'equation', latex: 'e = mc^2', caption: 'Energy' }, 'energy')).toBe(1);
  });

  it('finds a sheet by what has been typed into its cells', () => {
    const found = hits('quiz average', {
      sheets: [sheet({ id: 's1', title: 'Untitled', cells: { A1: 'Quiz average', B1: '=AVERAGE(C1:C9)' } })],
    });
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe('sheet');
  });

  // The grid is dragged out to 20×8 by default and that says nothing about
  // the sheet. What is in it does.
  it('describes a sheet by what is in it rather than by how far it was dragged', () => {
    const [found] = hits('budget', {
      sheets: [sheet({ id: 's1', title: 'Budget', cells: { A1: 'Rent', A2: '1200', A3: '' } })],
    });
    expect(found.sub).toBe('2 cells');
    expect(hits('budget', { sheets: [sheet({ id: 's1', title: 'Budget' })] })[0].sub).toBe('Empty');
  });

  it('finds a deck by its slides', () => {
    const found = hits('anchoring', {
      decks: [deck({ id: 'k1', title: 'Week 4', slides: [{ title: 'Bias', bullets: ['Anchoring'] }] })],
    });
    expect(found).toHaveLength(1);
    expect(found[0].sub).toBe('1 slide');
  });

  it('gives each its own group rather than one pile of made things', () => {
    const groups = search('draft', {
      documents: [doc({ id: 'd1', title: 'Draft' })],
      sheets: [sheet({ id: 's1', title: 'Draft' })],
      decks: [deck({ id: 'k1', title: 'Draft' })],
    });
    const labels = groups.map((g) => g.label);
    expect(labels).toContain('Documents');
    expect(labels).toContain('Sheets');
    expect(labels).toContain('Decks');
  });

  it('tags one filed under a course with that course', () => {
    const withCourse = buildCatalog([ECON]);
    const [found] = findEverything(
      withCourse,
      NOW,
      'rawls',
      [],
      [],
      undefined,
      [],
      {},
      [],
      { documents: [doc({ id: 'd1', title: 'Rawls essay', courseId: 'econ' })] },
    ).flatMap((g) => g.hits.filter((h) => h.kind === 'document'));
    expect(found.tag).toBe('ECON 1020');
  });

  it('names an untitled thing rather than showing an empty row', () => {
    const [found] = hits('mankiw', {
      documents: [doc({ id: 'd1', title: '', blocks: [{ kind: 'text', text: 'Mankiw ch. 4' }] })],
    });
    expect(found.title).toBe('Untitled document');
  });

  it('is silent for a caller that has made nothing', () => {
    expect(hits('rawls', {})).toEqual([]);
    expect(findEverything(cat, NOW, 'rawls', [], []).flatMap((g) => g.hits)).toEqual([]);
  });

  // `score` is a substring test run on every keystroke, and a sheet can hold
  // ten thousand cells. The cap is what keeps the fourth keystroke fast.
  it('caps how much of a body it searches, rather than scanning a whole sheet', () => {
    const cells: Record<string, string> = {};
    for (let i = 1; i <= 4000; i++) cells[`A${i}`] = 'filler text in this cell';
    cells.A4001 = 'zanzibar';
    const found = hits('zanzibar', { sheets: [sheet({ id: 's1', title: 'Big', cells })] });
    expect(found).toEqual([]);
  });
});

describe('search is a gate too', () => {
  const cat = buildCatalog([]);
  const NOW = new Date(2026, 8, 9);
  const hits = (q: string, role?: 'student' | 'faculty') =>
    findEverything(cat, NOW, q, [], [], undefined, [], {}, [], {}, role).flatMap((g) => g.hits);

  /*
   * The note on `caps` in `find.ts` says why this matters: search was the leak
   * that would have let somebody reach a meal-plan screen their university
   * does not have. A role is the same kind of hole.
   */
  it('does not offer a screen the directory has stopped showing this role', () => {
    expect(hits('housing', 'student').some((h) => h.kind === 'screen')).toBe(true);
    expect(hits('housing', 'faculty').some((h) => h.kind === 'screen')).toBe(false);
  });

  it('still finds what the role does have', () => {
    expect(hits('calendar', 'faculty').some((h) => h.kind === 'screen')).toBe(true);
  });

  it('searches as a student when no role is given', () => {
    expect(hits('housing').some((h) => h.kind === 'screen')).toBe(true);
  });
});
