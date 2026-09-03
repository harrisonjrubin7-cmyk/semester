import { describe, expect, it } from 'vitest';
import {
  THRESHOLD,
  asItemDate,
  compare,
  movedLine,
  similarity,
  summary,
  words,
} from './reconcile';
import type { DatedItem, FeedEvent } from './types';

const item = (id: string, title: string, month: number, day: number, c = 'core'): DatedItem =>
  ({
    id,
    c,
    title,
    kind: 'Reflection',
    month,
    day,
    dueTime: '11:59p',
    weight: '',
    where: 'Brightspace',
    detail: '',
    quote: '',
    source: '',
    date: new Date(2026, month, day),
    dueShort: '',
    dow: '',
    mon: '',
    isToday: false,
    isPast: false,
    daysAway: 0,
  }) as DatedItem;

const event = (id: string, title: string, date: string, courseId: string | null = 'core'): FeedEvent => ({
  id,
  sourceId: 'brightspace',
  title,
  date,
  at: null,
  time: '',
  where: '',
  note: '',
  courseId,
});

describe('words', () => {
  it('keeps what identifies a title and drops what does not', () => {
    expect(words('Reflection #1 — Should play be more serious?')).toEqual([
      'reflection',
      '1',
      'should',
      'play',
      'more',
      'serious',
    ]);
  });

  it('drops the words half of all assignments share', () => {
    expect(words('Assignment 3 due')).toEqual(['3']);
  });

  it('drops the course code an LMS prefixes to everything', () => {
    // Left in, "CORE 2500" is two words the syllabus side can never share,
    // and it pushed a real match under the threshold.
    expect(words('CORE 2500 - Reflection 1')).toEqual(['reflection', '1']);
    expect(words('ECON1020 Problem Set 2')).toEqual(['problem', 'set', '2']);
  });
});

describe('similarity', () => {
  it('matches a syllabus title to the shorter one an LMS shows', () => {
    expect(similarity('Reflection #1 — Should play be more serious?', 'Reflection 1')).toBeGreaterThan(
      THRESHOLD,
    );
  });

  it('keeps two numbered assignments in the same series apart', () => {
    // The failure mode of the whole feature: same words, different thing.
    expect(similarity('Reflection #1', 'Reflection #2')).toBeLessThan(THRESHOLD);
  });

  it('is zero for a title with nothing identifying in it', () => {
    expect(similarity('the assignment due', 'Quiz 4')).toBe(0);
  });

  it('matches across an LMS prefix, which is what the feed actually looks like', () => {
    expect(
      similarity('Reflection #1 — Should play be more serious?', 'CORE 2500 - Reflection 1'),
    ).toBeGreaterThan(THRESHOLD);
  });

  it('is one for the same title', () => {
    expect(similarity('Midterm exam', 'Midterm Exam')).toBe(1);
  });
});

describe('compare', () => {
  it('finds a deadline whose date has moved', () => {
    const r = compare(
      [item('a', 'Reflection #1 — Should play be more serious?', 8, 10)],
      [event('x', 'Reflection 1', '2026-09-17')],
    );
    expect(r.moved).toHaveLength(1);
    expect(r.moved[0].was).toBe('2026-09-10');
    expect(r.moved[0].now).toBe('2026-09-17');
    expect(r.moved[0].days).toBe(7);
  });

  it('counts a match whose dates agree instead of reporting it', () => {
    const r = compare([item('a', 'Midterm exam', 9, 30)], [event('x', 'Midterm Exam', '2026-10-30')]);
    expect(r.moved).toEqual([]);
    expect(r.agreed).toBe(1);
  });

  it('never pairs a deadline with an event from a different course', () => {
    const r = compare(
      [item('a', 'Midterm exam', 9, 30, 'core')],
      [event('x', 'Midterm exam', '2026-10-14', 'econ')],
    );
    expect(r.moved).toEqual([]);
    expect(r.onlyHere).toHaveLength(1);
    expect(r.onlyThere).toHaveLength(1);
  });

  it('still pairs when only one side knows the course', () => {
    const r = compare(
      [item('a', 'Midterm exam', 9, 30, 'core')],
      [event('x', 'Midterm exam', '2026-10-14', null)],
    );
    expect(r.moved).toHaveLength(1);
  });

  it('reports two findings rather than one wrong pairing', () => {
    const r = compare(
      [item('a', 'Reflection #1', 8, 10)],
      [event('x', 'Reflection #2', '2026-09-17')],
    );
    expect(r.moved).toEqual([]);
    expect(r.onlyHere).toHaveLength(1);
    expect(r.onlyThere).toHaveLength(1);
  });

  it('uses each side of a pair once, best score first', () => {
    const r = compare(
      [item('a', 'Reflection #1', 8, 10), item('b', 'Reflection #2', 8, 17)],
      [event('x', 'Reflection 1', '2026-09-11'), event('y', 'Reflection 2', '2026-09-18')],
    );
    expect(r.moved).toHaveLength(2);
    expect(r.moved.map((m) => m.item.id)).toEqual(['a', 'b']);
  });

  it('lists what moved soonest first, not by how sure the match is', () => {
    const r = compare(
      [item('a', 'Final paper', 11, 5), item('b', 'Quiz 3', 8, 20)],
      [event('x', 'Final paper', '2026-12-10'), event('y', 'Quiz 3', '2026-09-25')],
    );
    expect(r.moved.map((m) => m.item.id)).toEqual(['b', 'a']);
  });

  it('lists what is in the feed and not in the app', () => {
    const r = compare([], [event('x', 'Extra credit essay', '2026-10-01')]);
    expect(r.onlyThere.map((e) => e.title)).toEqual(['Extra credit essay']);
  });

  it('handles both sides being empty without inventing a finding', () => {
    expect(compare([], [])).toEqual({ moved: [], onlyHere: [], onlyThere: [], agreed: 0 });
  });
});

describe('movedLine', () => {
  it('says which way it moved, in days', () => {
    const later = compare(
      [item('a', 'Quiz 3', 8, 10)],
      [event('x', 'Quiz 3', '2026-09-17')],
    ).moved[0];
    expect(movedLine(later)).toBe('7 days later');

    const earlier = compare(
      [item('a', 'Quiz 3', 8, 10)],
      [event('x', 'Quiz 3', '2026-09-09')],
    ).moved[0];
    expect(movedLine(earlier)).toBe('1 day earlier');
  });
});

describe('summary', () => {
  it('says plainly when everything agrees', () => {
    expect(summary({ moved: [], onlyHere: [], onlyThere: [], agreed: 12 })).toContain(
      'every date agrees',
    );
  });

  it('says when nothing matched at all rather than claiming agreement', () => {
    expect(summary({ moved: [], onlyHere: [], onlyThere: [], agreed: 0 })).toContain(
      'Nothing to compare',
    );
  });

  it('counts what disagrees', () => {
    const r = compare(
      [item('a', 'Quiz 3', 8, 10)],
      [event('x', 'Quiz 3', '2026-09-17'), event('y', 'Surprise essay', '2026-10-01')],
    );
    expect(summary(r)).toBe('1 moved, 1 in the feed is not here.');
  });
});

describe('asItemDate', () => {
  it('turns an ISO date into the month and day an Item stores', () => {
    expect(asItemDate('2026-09-17')).toEqual({ month: 8, day: 17 });
  });

  it('refuses anything that is not one rather than storing NaN', () => {
    expect(asItemDate('next Tuesday')).toBe(null);
    expect(asItemDate('')).toBe(null);
  });
});
