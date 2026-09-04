import { describe, expect, it } from 'vitest';
import {
  ONE_SITTING,
  far,
  farLine,
  finished,
  left,
  leftLine,
  mark,
  minutesLeft,
  newProgress,
  open,
  pace,
  pct,
  perDayLine,
  readProgress,
  suggestTotal,
  type Progress,
} from './progress';

const AT = new Date(2026, 8, 4, 20, 10).getTime();
const min = (n: number) => n * 60_000;

const started = (total = 96, unit: 'pages' | 'chapters' | 'percent' = 'pages'): Progress =>
  newProgress('i1', unit, total, AT);

describe('where you are', () => {
  it('is the last mark', () => {
    const p = mark(mark(started(), 12, AT), 40, AT + min(55));
    expect(far(p)).toBe(40);
    expect(left(p)).toBe(56);
    expect(pct(p)).toBe(42);
  });

  it('is nothing before the first mark', () => {
    expect(far(started())).toBe(0);
    expect(farLine(started())).toBe('Not started.');
  });

  it('keeps a move backwards, because re-reading is a real thing', () => {
    // Rejecting it would make the field argue with the person using it.
    const p = mark(mark(started(), 40, AT), 20, AT + min(10));
    expect(far(p)).toBe(20);
  });

  it('drops a repeat inside one sitting, so saving twice is not a leg', () => {
    const once = mark(started(), 40, AT);
    expect(mark(once, 40, AT + min(5))).toBe(once);
  });

  it('keeps the same page a day later, which is picking the book back up', () => {
    // Dropping it unconditionally made every session after the first
    // unmeasurable — there was nothing to time the next mark against.
    const once = mark(started(), 40, AT);
    expect(mark(once, 40, AT + 86_400_000).marks).toHaveLength(2);
  });

  it('says nothing to count down without a length', () => {
    const p = mark(started(0), 40, AT);
    expect(left(p)).toBeNull();
    expect(pct(p)).toBeNull();
    expect(leftLine(p)).toBe('No length set, so nothing to count down.');
    expect(farLine(p)).toBe('At 40 pages.');
  });

  it('knows when it is done', () => {
    expect(finished(mark(started(96), 96, AT))).toBe(true);
    expect(finished(mark(started(96), 95, AT))).toBe(false);
    expect(leftLine(mark(started(96), 96, AT))).toBe('Finished.');
  });
});

describe('the pace, which is measured or absent', () => {
  it('comes from two marks in one sitting', () => {
    // 40 pages in 55 minutes.
    const p = mark(mark(started(), 0, AT), 40, AT + min(55));
    expect(pace(p)?.perHour).toBeCloseTo(43.6, 1);
    expect(pace(p)?.from).toBe(1);
    expect(pace(p)?.minutes).toBe(55);
  });

  it('refuses to read a night of sleep as a very slow hour', () => {
    // Two marks a day apart are two facts about two days, not a rate. This is
    // the pair that would otherwise produce two pages an hour.
    const p = mark(mark(started(), 0, AT), 40, AT + ONE_SITTING + min(1));
    expect(pace(p)).toBeNull();
  });

  it('has no default speed and says so instead', () => {
    // Every published figure is an average over people and material.
    const p = mark(started(), 40, AT);
    expect(pace(p)).toBeNull();
    expect(leftLine(p)).toContain('No pace measured yet');
    expect(minutesLeft(p)).toBeNull();
  });

  it('skips a backwards move rather than counting negative reading', () => {
    const p = mark(mark(mark(started(), 40, AT), 20, AT + min(5)), 60, AT + min(65));
    // Only the 20 to 60 leg, which is inside a sitting and moves forwards.
    expect(pace(p)?.from).toBe(1);
  });

  it('adds up several sittings', () => {
    let p = mark(started(), 0, AT);
    p = mark(p, 30, AT + min(30));
    p = mark(p, 30, AT + min(30) + 86_400_000);
    p = mark(p, 60, AT + min(60) + 86_400_000);
    expect(pace(p)?.from).toBe(2);
    expect(pace(p)?.perHour).toBe(60);
  });

  it('turns a pace and a remainder into minutes', () => {
    const p = mark(mark(started(96), 0, AT), 48, AT + min(60));
    expect(minutesLeft(p)).toBe(60);
    expect(leftLine(p)).toBe('48 pages left, about 1h 00m at your 48 pages an hour.');
  });

  it('writes a short remainder in minutes', () => {
    const p = mark(mark(started(60), 0, AT), 48, AT + min(60));
    expect(leftLine(p)).toContain('about 15 min');
  });
});

describe('spreading what is left', () => {
  it('divides, and does not call it being behind', () => {
    // Nothing says a reading has to be spread evenly, so the app will not
    // invent that schedule and then judge somebody against it.
    const p = mark(started(96), 36, AT);
    const said = perDayLine(p, 5);
    expect(said).toBe('10 pages a day to spread it to the deadline in 5 days.');
    expect(said.toLowerCase()).not.toContain('behind');
    expect(said.toLowerCase()).not.toContain('on track');
  });

  it('says the plain thing about today and about a day gone', () => {
    const p = mark(started(96), 36, AT);
    expect(perDayLine(p, 0)).toBe('Due today, so it is all today.');
    expect(perDayLine(p, -1)).toBe('The day for it has gone.');
  });

  it('says nothing at all when there is nothing to spread', () => {
    expect(perDayLine(mark(started(96), 96, AT), 5)).toBe('');
    expect(perDayLine(started(0), 5)).toBe('');
  });
});

describe('chapters and percent read the way they are said', () => {
  it('uses the unit it was given, and does not convert', () => {
    const p = mark(started(3, 'chapters'), 1, AT);
    expect(farLine(p)).toBe('1 of 3 chapters.');
    expect(leftLine(p)).toContain('2 chapters left');
  });

  it('writes percent as percent', () => {
    const p = mark(started(100, 'percent'), 40, AT);
    expect(farLine(p)).toBe('40% of the way through.');
    expect(leftLine(p)).toContain('60% left');
  });

  it('gets its singular right', () => {
    expect(leftLine(mark(started(96), 95, AT))).toContain('1 page left');
  });
});

describe('a length suggested from what the syllabus said', () => {
  it('prefers pages, which is what somebody can check against the book', () => {
    expect(suggestTotal({ pages: 28, chapters: 3 })).toEqual({ unit: 'pages', total: 28 });
    expect(suggestTotal({ pages: 0, chapters: 3 })).toEqual({ unit: 'chapters', total: 3 });
  });

  it('suggests nothing where the syllabus stated nothing', () => {
    expect(suggestTotal({ pages: 0, chapters: 0 })).toEqual({ unit: 'pages', total: 0 });
  });
});

describe('the list of what is on the go', () => {
  it('holds what is started and unfinished, most recent first', () => {
    const a = mark(newProgress('a', 'pages', 96, AT), 10, AT);
    const b = mark(newProgress('b', 'pages', 96, AT), 10, AT + min(60));
    const done = mark(newProgress('c', 'pages', 20, AT), 20, AT);
    const notStarted = newProgress('d', 'pages', 96, AT);
    expect(open({ a, b, c: done, d: notStarted }).map((p) => p.id)).toEqual(['b', 'a']);
  });
});

describe('reading a stored map', () => {
  it('sorts marks, because two devices merge in neither one’s order', () => {
    const stored = {
      i1: { unit: 'pages', total: 96, updated: AT, marks: [{ at: AT + 100, done: 40 }, { at: AT, done: 0 }] },
    };
    expect(readProgress(stored).i1.marks.map((m) => m.done)).toEqual([0, 40]);
  });

  it('drops what is not a mark and falls back on an unknown unit', () => {
    const stored = { i1: { unit: 'furlongs', total: -3, marks: [{ at: 'soon' }, null] } };
    const p = readProgress(stored).i1;
    expect(p.unit).toBe('pages');
    expect(p.total).toBe(0);
    expect(p.marks).toEqual([]);
  });

  it('takes anything that is not a map as nothing', () => {
    expect(readProgress(null)).toEqual({});
    expect(readProgress([1, 2])).toEqual({});
  });
});
