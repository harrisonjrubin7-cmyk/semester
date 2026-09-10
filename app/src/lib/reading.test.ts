import { describe, expect, it } from 'vitest';
import {
  due,
  extent,
  isReading,
  plan,
  planLine,
  size,
  typicalExtent,
  weight,
  type Sized,
} from './reading';
import type { DatedItem } from './types';
import type { Spent } from './pace';
import type { Window } from './windows';

const NOW = new Date(2026, 8, 3, 9, 0); // Thursday 3 September 2026

const item = (over: Partial<DatedItem>): DatedItem =>
  ({
    id: 'r1',
    c: 'core',
    title: 'Read Konner — “Play, Social Learning, and Teaching”',
    kind: 'Reading',
    detail: '',
    daysAway: 1,
    date: new Date(2026, 8, 4),
    ...over,
  }) as DatedItem;

const spent = (over: Partial<Spent> = {}): Spent => ({
  id: 's1',
  courseId: 'core',
  kind: 'reading',
  minutes: 60,
  at: 1,
  ...over,
});

describe('what counts as a reading', () => {
  it('takes the kind', () => {
    expect(isReading({ kind: 'Reading', title: 'Anything' })).toBe(true);
    expect(isReading({ kind: 'Required reading', title: 'x' })).toBe(true);
  });

  it('takes a title that starts with the verb', () => {
    expect(isReading({ kind: '', title: 'Read chapters 4–6' })).toBe(true);
  });

  it('leaves a problem set alone', () => {
    expect(isReading({ kind: 'Problem set', title: 'PS4' })).toBe(false);
  });

  it('does not take a word merely containing it', () => {
    expect(isReading({ kind: 'Exam', title: 'Ready reckoner quiz' })).toBe(false);
  });
});

describe('reading how much there is', () => {
  it('reads a chapter range', () => {
    expect(extent({ title: 'Read ch. 4–6' }).chapters).toBe(3);
    expect(extent({ title: 'Chapters 2 to 5' }).chapters).toBe(4);
  });

  it('reads a chapter list', () => {
    expect(extent({ title: 'Ch. 2, 3, 5' }).chapters).toBe(3);
    expect(extent({ title: 'Chapters 2 and 3' }).chapters).toBe(2);
  });

  it('reads a single chapter', () => {
    expect(extent({ title: 'Chapter 7' }).chapters).toBe(1);
  });

  it('spells a chapter the way a range and a list already spelled it', () => {
    // A range read "Ch 7–9" without the stop and a list read "chs 2, 3", so a
    // syllabus writing "Ch 7" was the only one of the three the app refused.
    for (const said of ['Ch 7', 'ch. 7', 'Chapter 7', 'Chapters 7', 'chs 7', 'chs. 7', 'Ch7']) {
      expect(extent({ title: `Read ${said}` }).chapters).toBe(1);
    }
  });

  it('takes an ampersand for the separator it is', () => {
    // Both of these are in this app's own shipped syllabus, and both read as
    // one chapter.
    expect(extent({ title: 'Fox, Ch. 2 & 4' }).chapters).toBe(2);
    expect(extent({ title: 'Canada, Ch. 2 & 3' }).chapters).toBe(2);
  });

  it('sees past the first mention when the noun is repeated', () => {
    expect(extent({ title: 'Chapter 7 and Chapter 9' }).chapters).toBe(2);
    expect(extent({ title: 'Ch. 1–2, and ch. 6' }).chapters).toBe(3);
  });

  it('counts a chapter named twice as one chapter', () => {
    expect(extent({ title: 'ch 4–6 and ch 5' }).chapters).toBe(3);
  });

  it('is not fooled by a word that merely begins with those two letters', () => {
    for (const said of ['Chicago 3', 'Chem 101 lab', 'Chart 3 explained', 'Multiple choice, 4 of them']) {
      expect(extent({ title: said }).chapters).toBe(0);
    }
    expect(extent({ title: 'A video as well as the chapter.' }).chapters).toBe(0);
  });

  it('refuses a chapter number longer than a chapter number', () => {
    expect(extent({ title: 'ch 1234' }).chapters).toBe(0);
  });

  it('refuses a range whose far end is too long to be a chapter', () => {
    // The repeated group is optional, so without a guard this falls back to
    // reading "4" alone and reports one chapter out of a form it could not
    // read. A list separator is not a range, so a year after a comma still
    // leaves the chapter before it readable.
    expect(extent({ title: 'ch 4-1234' }).chapters).toBe(0);
    expect(extent({ title: 'ch 4-12345' }).chapters).toBe(0);
    expect(extent({ title: 'Ch. 3, 2026 reprint' }).chapters).toBe(1);
  });

  it('reads a page range, and prefers it', () => {
    const e = extent({ title: 'Read ch. 4, pp. 112–140' });
    expect(e.pages).toBe(29);
    expect(weight(e)).toBe(29);
  });

  it('finds an extent in the detail as well as the title', () => {
    expect(extent({ title: 'Konner', detail: 'pp. 10–20' }).pages).toBe(11);
  });

  it('states nothing rather than guessing', () => {
    // Inventing an extent here would put a fabricated number into an hour
    // total that somebody plans against.
    expect(extent({ title: 'Read the Konner piece' })).toEqual({ chapters: 0, pages: 0 });
    expect(weight({ chapters: 0, pages: 0 })).toBe(0);
  });

  it('refuses a range that is not one', () => {
    expect(extent({ title: 'pp. 400–3' }).pages).toBe(0);
    expect(extent({ title: 'ch. 1–99' }).chapters).toBe(0);
    expect(extent({ title: 'ch. 6–4' }).chapters).toBe(0);
  });

  it('counts a range that begins and ends on one page as one page', () => {
    expect(extent({ title: 'pp. 100–100' }).pages).toBe(1);
    expect(extent({ title: 'ch. 4–4' }).chapters).toBe(1);
  });

  it('leaves a lone page number unstated, because it is as likely a start', () => {
    expect(extent({ title: 'Smith p. 45' }).pages).toBe(0);
  });
});

describe('how long one takes', () => {
  const history = [spent({ minutes: 60 }), spent({ minutes: 60 })];

  it('gives nothing at all when it has no basis', () => {
    const s = size(item({}), [], 25);
    expect(s.known).toBe(false);
    expect(s.minutes).toBe(0);
  });

  it('uses your median where the extent is unstated', () => {
    expect(size(item({}), history, 25).minutes).toBe(60);
  });

  it('scales by how much there is', () => {
    // Fifty pages against a typical twenty-five is twice the usual hour.
    const s = size(item({ title: 'Read pp. 1–50' }), history, 25);
    expect(s.minutes).toBe(120);
  });

  it('caps the scaling in both directions', () => {
    const huge = size(item({ title: 'Read pp. 1–1000' }), history, 25);
    expect(huge.minutes).toBe(240);
    const tiny = size(item({ title: 'Read pp. 1–2' }), history, 400);
    expect(tiny.minutes).toBe(15);
  });

  it('does not scale when there is nothing to scale against', () => {
    expect(size(item({ title: 'Read pp. 1–50' }), history, 0).minutes).toBe(60);
  });
});

describe('the typical extent', () => {
  it('takes the middle of the ones that state it', () => {
    expect(
      typicalExtent([{ title: 'pp. 1–10' }, { title: 'pp. 1–30' }, { title: 'pp. 1–100' }]),
    ).toBe(30);
  });

  it('ignores the ones that state nothing', () => {
    expect(typicalExtent([{ title: 'The Konner piece' }, { title: 'pp. 1–20' }])).toBe(20);
  });

  it('is nothing when nothing states one', () => {
    expect(typicalExtent([{ title: 'The Konner piece' }])).toBe(0);
  });
});

describe('placing them in the week', () => {
  const windows: Window[] = [
    { id: 'w', label: 'Evenings', days: [0, 1, 2, 3, 4, 5, 6], from: 19 * 60, to: 21 * 60 },
  ];
  // Seven days from Thursday 3 Sep, nothing else promised.
  const days = Array.from({ length: 7 }, (_, n) => ({
    date: new Date(2026, 8, 3 + n),
    promised: 0,
  }));

  const sized = (over: Partial<DatedItem>, minutes: number): Sized => ({
    item: item(over),
    minutes,
    extent: { chapters: 0, pages: 0 },
    known: true,
  });

  it('puts a reading on the earliest day with room', () => {
    const p = plan({ readings: [sized({ daysAway: 3, date: new Date(2026, 8, 6) }, 60)], days, windows, now: NOW });
    expect(p.placed).toHaveLength(1);
    expect(p.placed[0].on.getDate()).toBe(3);
  });

  it('gives the soonest reading the first day', () => {
    const p = plan({
      readings: [
        sized({ id: 'late', daysAway: 5, date: new Date(2026, 8, 8) }, 120),
        sized({ id: 'soon', daysAway: 1, date: new Date(2026, 8, 4) }, 120),
      ],
      days,
      windows,
      now: NOW,
    });
    // Two hours is the whole evening, so whoever gets Thursday gets it alone.
    expect(p.placed.find((x) => x.on.getDate() === 3)?.item.id).toBe('soon');
  });

  it('never places one after it is due', () => {
    const p = plan({
      readings: [sized({ daysAway: 0, date: new Date(2026, 8, 3) }, 60)],
      days,
      windows,
      now: NOW,
    });
    expect(p.placed[0].on.getDate()).toBe(3);
  });

  it('says a reading does not fit rather than squeezing it in', () => {
    // Three hours, and no day offers more than two.
    const p = plan({
      readings: [sized({ daysAway: 1, date: new Date(2026, 8, 4) }, 180)],
      days,
      windows,
      now: NOW,
    });
    expect(p.placed).toEqual([]);
    expect(p.unplaced).toHaveLength(1);
  });

  it('respects what is already promised on a day', () => {
    const busy = days.map((d, n) => ({ ...d, promised: n === 0 ? 2 : 0 }));
    const p = plan({
      readings: [sized({ daysAway: 3, date: new Date(2026, 8, 6) }, 60)],
      days: busy,
      windows,
      now: NOW,
    });
    expect(p.placed[0].on.getDate()).toBe(4);
  });

  it('keeps the ones it cannot size apart from the ones that will not fit', () => {
    const p = plan({
      readings: [{ ...sized({}, 0), known: false }],
      days,
      windows,
      now: NOW,
    });
    expect(p.unsized).toHaveLength(1);
    expect(p.unplaced).toEqual([]);
  });
});

describe('the sentence it earns', () => {
  const s = (minutes: number): Sized => ({
    item: item({}),
    minutes,
    extent: { chapters: 0, pages: 0 },
    known: true,
  });

  it('says nothing about an empty week', () => {
    expect(planLine({ placed: [], unplaced: [], unsized: [] })).toBe(
      'No readings due in the next seven days.',
    );
  });

  it('counts what it placed and how long that is', () => {
    const p = { placed: [{ item: item({}), on: NOW, minutes: 90 }], unplaced: [], unsized: [] };
    expect(planLine(p)).toBe('1 reading placed, 1.5 hours of it.');
  });

  it('names what does not fit, which is the half worth having', () => {
    const p = { placed: [], unplaced: [s(180), s(200)], unsized: [] };
    expect(planLine(p)).toBe('2 that do not fit.');
  });

  it('names what it cannot size separately', () => {
    const p = { placed: [], unplaced: [], unsized: [s(0)] };
    expect(planLine(p)).toBe('1 the app cannot size yet.');
  });
});

describe('which readings are due', () => {
  it('takes the ones ahead, inside the window, and not ticked', () => {
    const items = [
      item({ id: 'a', daysAway: 2 }),
      item({ id: 'b', daysAway: 9 }),
      item({ id: 'c', daysAway: -1 }),
      item({ id: 'd', daysAway: 2 }),
      item({ id: 'e', daysAway: 1, kind: 'Problem set', title: 'PS4' }),
    ];
    expect(due(items, { d: true }, 7).map((i) => i.id)).toEqual(['a']);
  });
});
