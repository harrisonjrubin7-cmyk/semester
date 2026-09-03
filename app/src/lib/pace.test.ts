import { describe, expect, it } from 'vitest';
import {
  BUCKETS,
  askAbout,
  askedLine,
  estimate,
  forecast,
  learned,
  normalKind,
  record,
  showSpan,
  type Spent,
} from './pace';

const spent = (over: Partial<Spent> = {}): Spent => ({
  id: `i${Math.random()}`,
  courseId: 'econ',
  kind: 'problem set',
  minutes: 60,
  at: 1,
  ...over,
});

describe('the question that is asked', () => {
  it('is a handful of taps, not a stopwatch', () => {
    expect(BUCKETS.length).toBeLessThanOrEqual(5);
  });

  it('spreads unevenly, because coursework does', () => {
    const gaps = BUCKETS.slice(1).map((b, i) => b.minutes - BUCKETS[i].minutes);
    expect(gaps.every((g, i) => i === 0 || g >= gaps[i - 1])).toBe(true);
  });

  it('turns a tap into a record', () => {
    expect(record('i1', 'econ', 'Problem Set 4', 'hour', 5)).toEqual({
      id: 'i1',
      courseId: 'econ',
      kind: 'problem set',
      minutes: 60,
      at: 5,
    });
  });

  it('refuses a bucket that is not one', () => {
    expect(record('i1', 'econ', 'Problem Set 4', 'ages', 5)).toBeNull();
  });
});

describe('what counts as the same kind of work', () => {
  it('reads the four names a syllabus gives one thing', () => {
    for (const written of ['Problem Set 4', 'PS4', 'Problem sets', 'Homework 4']) {
      expect(normalKind(written)).toBe('problem set');
    }
  });

  it('separates the ones that really are different', () => {
    expect(normalKind('Reading')).toBe('reading');
    expect(normalKind('Midterm 2')).toBe('exam');
    expect(normalKind('Response paper')).toBe('essay');
  });

  it('keeps a kind it does not recognise rather than binning it', () => {
    expect(normalKind('Fieldwork write-up')).toBe('essay');
    expect(normalKind('Recital')).toBe('recital');
  });

  it('survives an empty kind', () => {
    expect(normalKind('')).toBe('other');
  });
});

describe('estimating from your own evidence', () => {
  it('gives nothing at all when it has nothing', () => {
    expect(estimate([], 'econ', 'Problem set')).toEqual({ minutes: 0, from: 0, basis: '' });
  });

  it('uses this course first', () => {
    const history = [
      spent({ courseId: 'econ', minutes: 60 }),
      spent({ courseId: 'econ', minutes: 90 }),
      spent({ courseId: 'econ', minutes: 120 }),
      spent({ courseId: 'psci', minutes: 20 }),
    ];
    expect(estimate(history, 'econ', 'Problem Set 5')).toEqual({
      minutes: 90,
      from: 3,
      basis: 'course',
    });
  });

  it('falls back to the same kind of work elsewhere', () => {
    const history = [spent({ courseId: 'psci', kind: 'essay', minutes: 300 })];
    expect(estimate(history, 'core', 'Response paper')).toEqual({
      minutes: 300,
      from: 1,
      basis: 'kind',
    });
  });

  it('never falls back across kinds', () => {
    const history = [spent({ courseId: 'econ', kind: 'problem set', minutes: 60 })];
    expect(estimate(history, 'econ', 'Final essay').from).toBe(0);
  });

  it('takes the median, so one all-nighter does not move it', () => {
    const history = [
      spent({ minutes: 60 }),
      spent({ minutes: 60 }),
      spent({ minutes: 600 }),
    ];
    expect(estimate(history, 'econ', 'Problem set').minutes).toBe(60);
  });

  it('averages the middle two when there is an even number', () => {
    const history = [spent({ minutes: 60 }), spent({ minutes: 150 })];
    expect(estimate(history, 'econ', 'Problem set').minutes).toBe(105);
  });
});

describe('a week, forecast', () => {
  const history = [
    spent({ courseId: 'econ', kind: 'problem set', minutes: 60 }),
    spent({ courseId: 'psci', kind: 'reading', minutes: 150 }),
  ];

  it('adds up what it knows and counts what it does not', () => {
    const f = forecast(history, [
      { c: 'econ', kind: 'Problem Set 6' },
      { c: 'psci', kind: 'Reading 4' },
      { c: 'bus', kind: 'Case memo' },
    ]);
    expect(f).toEqual({ hours: 3.5, covered: 2, unknown: 1 });
  });

  it('contributes nothing for the unknown one, rather than a guess', () => {
    const two = forecast(history, [{ c: 'econ', kind: 'Problem Set 6' }]);
    const three = forecast(history, [
      { c: 'econ', kind: 'Problem Set 6' },
      { c: 'bus', kind: 'Case memo' },
    ]);
    expect(three.hours).toBe(two.hours);
  });

  it('says both halves, second one last', () => {
    const f = forecast(history, [
      { c: 'econ', kind: 'Problem Set 6' },
      { c: 'bus', kind: 'Case memo' },
    ]);
    expect(askedLine(f)).toBe(
      'About 1 hour of coursework, across 1 of the 2 things due — the other 1 is a kind of work you have not timed before.',
    );
  });

  it('gives one thing a sentence rather than a fraction of itself', () => {
    const f = forecast(history, [{ c: 'econ', kind: 'Problem Set 6' }]);
    expect(askedLine(f)).toBe('About 1 hour for the one thing due.');
  });

  it('says "all of them" when it knows all of them', () => {
    const f = forecast(history, [
      { c: 'econ', kind: 'Problem Set 6' },
      { c: 'psci', kind: 'Reading 4' },
    ]);
    expect(askedLine(f)).toBe('About 3.5 hours of coursework, across all 2 things due.');
  });

  it('admits outright when it can estimate nothing', () => {
    expect(askedLine(forecast([], [{ c: 'bus', kind: 'Case memo' }]))).toMatch(/no estimate/);
  });

  it('says nothing at all about an empty week', () => {
    expect(askedLine(forecast([], []))).toBe('');
  });
});

describe('when to ask', () => {
  it('asks about something new', () => {
    expect(askAbout([], 'i1', 'econ', 'Problem set')).toBe(true);
  });

  it('never asks twice about the same thing', () => {
    expect(askAbout([spent({ id: 'i1' })], 'i1', 'econ', 'Problem set')).toBe(false);
  });

  it('stops asking once it has enough to be useful', () => {
    const five = Array.from({ length: 5 }, () => spent());
    expect(askAbout(five, 'new', 'econ', 'Problem Set 9')).toBe(false);
  });

  it('still asks about a kind it has not seen in this course', () => {
    const five = Array.from({ length: 5 }, () => spent());
    expect(askAbout(five, 'new', 'econ', 'Final essay')).toBe(true);
    expect(askAbout(five, 'new', 'psci', 'Problem Set 1')).toBe(true);
  });
});

describe('what you learn about yourself', () => {
  it('groups by course and kind, longest first', () => {
    const history = [
      spent({ courseId: 'econ', kind: 'problem set', minutes: 60 }),
      spent({ courseId: 'econ', kind: 'problem set', minutes: 60 }),
      spent({ courseId: 'core', kind: 'essay', minutes: 300 }),
    ];
    expect(learned(history)).toEqual([
      { courseId: 'core', kind: 'essay', minutes: 300, from: 1 },
      { courseId: 'econ', kind: 'problem set', minutes: 60, from: 2 },
    ]);
  });

  it('keeps a two-word kind whole', () => {
    // The grouping key joins course and kind with a space, and "problem set"
    // has one of its own — splitting the key back apart filed every one of
    // these under "problem".
    expect(learned([spent({ kind: 'problem set' })])[0].kind).toBe('problem set');
  });

  it('shows a row backed by one report, marked as one', () => {
    expect(learned([spent()])[0].from).toBe(1);
  });
});

describe('saying a span', () => {
  it('rounds to the half hour, which is all an estimate deserves', () => {
    expect(showSpan(2.4)).toBe('2.5 hours');
    expect(showSpan(2)).toBe('2 hours');
    expect(showSpan(1)).toBe('1 hour');
  });

  it('drops to minutes under the hour', () => {
    expect(showSpan(0.5)).toBe('30 minutes');
  });

  it('says nothing rather than zero hours', () => {
    expect(showSpan(0)).toBe('no time');
  });
});
