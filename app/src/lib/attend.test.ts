import { describe, expect, it } from 'vitest';
import {
  NO_POLICY,
  attendLine,
  budget,
  hasPolicy,
  mark,
  markOn,
  pointsOff,
  rate,
  readLog,
  readPolicy,
  standing,
  tally,
  type AttendPolicy,
  type Attended,
} from './attend';

/** CORE 2500's rule: two free, then ten points of the final grade each. */
const CORE: AttendPolicy = { allowed: 2, penaltyPer: 10, worth: 0, note: '' };
/** BUS 1600's: attendance is a graded category worth 10%. */
const BUS: AttendPolicy = { allowed: 0, penaltyPer: 0, worth: 10, note: '' };

const log = (...marks: [string, Attended['mark']][]): Attended[] =>
  marks.map(([date, m], i) => ({ id: `core:${date}`, courseId: 'core', date, mark: m, at: i }));

const absences = (n: number) =>
  log(...Array.from({ length: n }, (_, i) => [`2026-09-${String(i + 1).padStart(2, '0')}`, 'absent'] as [string, Attended['mark']]));

describe('whether a course has said anything', () => {
  it('is silent about a course whose syllabus does not mention it', () => {
    expect(hasPolicy(NO_POLICY)).toBe(false);
    expect(hasPolicy(undefined)).toBe(false);
    expect(attendLine(NO_POLICY, tally([], 'core'))).toBe('');
    expect(standing(NO_POLICY, tally([], 'core'))).toBe('none');
  });

  it('counts a note on its own as having said something', () => {
    expect(hasPolicy({ ...NO_POLICY, note: 'Attendance is expected.' })).toBe(true);
  });
});

describe('the budget', () => {
  it('counts down while there is room', () => {
    expect(budget(CORE, tally(absences(0), 'core')).left).toBe(2);
    expect(budget(CORE, tally(absences(1), 'core')).left).toBe(1);
    expect(budget(CORE, tally(absences(2), 'core')).left).toBe(0);
  });

  it('costs nothing up to the allowance and everything after', () => {
    expect(budget(CORE, tally(absences(2), 'core')).cost).toBe(0);
    expect(budget(CORE, tally(absences(3), 'core')).cost).toBe(10);
    expect(budget(CORE, tally(absences(5), 'core')).cost).toBe(30);
  });

  it('never goes negative on what is left', () => {
    expect(budget(CORE, tally(absences(9), 'core')).left).toBe(0);
    expect(budget(CORE, tally(absences(9), 'core')).over).toBe(7);
  });

  it('does not count an excused absence against you', () => {
    // The whole reason for recording one. It is the difference between a
    // budget with one left in it and a budget already spent.
    const mixed = log(['2026-09-01', 'absent'], ['2026-09-03', 'excused'], ['2026-09-05', 'excused']);
    expect(budget(CORE, tally(mixed, 'core')).left).toBe(1);
    expect(budget(CORE, tally(mixed, 'core')).cost).toBe(0);
  });

  it('keeps one course absences out of another', () => {
    const both: Attended[] = [
      { id: 'core:2026-09-01', courseId: 'core', date: '2026-09-01', mark: 'absent', at: 1 },
      { id: 'econ:2026-09-01', courseId: 'econ', date: '2026-09-01', mark: 'absent', at: 1 },
    ];
    expect(tally(both, 'core').absent).toBe(1);
    expect(tally(both, 'econ').absent).toBe(1);
  });
});

describe('how close it is to costing something', () => {
  it('says clear, then close, then over', () => {
    expect(standing(CORE, tally(absences(0), 'core'))).toBe('clear');
    // The one that matters: "1 left" said in the same voice as "3 left" is
    // not a warning.
    expect(standing(CORE, tally(absences(1), 'core'))).toBe('close');
    expect(standing(CORE, tally(absences(2), 'core'))).toBe('close');
    expect(standing(CORE, tally(absences(3), 'core'))).toBe('over');
  });
});

describe('attendance as a graded category', () => {
  it('is the share of marked meetings you turned up to', () => {
    const mixed = log(['2026-09-01', 'present'], ['2026-09-03', 'present'], ['2026-09-05', 'absent']);
    expect(rate(tally(mixed, 'core'))).toBeCloseTo(66.7, 1);
  });

  it('leaves an excused meeting out of both halves', () => {
    // Counting it as attended would inflate the figure the graded category is
    // computed from; counting it as missed would punish a thing the syllabus
    // explicitly forgives.
    const mixed = log(['2026-09-01', 'present'], ['2026-09-03', 'excused']);
    expect(rate(tally(mixed, 'core'))).toBe(100);
  });

  it('is null before anything is marked, not zero', () => {
    // 0% and "not known yet" look identical as a number and are opposite as
    // facts.
    expect(rate(tally([], 'core'))).toBeNull();
  });
});

describe('what it says', () => {
  it('counts down the allowance', () => {
    expect(attendLine(CORE, tally(absences(0), 'core'))).toBe(
      '2 absences left before the penalty starts.',
    );
    expect(attendLine(CORE, tally(absences(1), 'core'))).toContain('1 absence left');
    expect(attendLine(CORE, tally(absences(2), 'core'))).toBe(
      'No absences left before the penalty starts.',
    );
  });

  it('names the cost once it has started', () => {
    expect(attendLine(CORE, tally(absences(3), 'core'))).toBe(
      '1 absence past the allowance, costing 10% of the final grade.',
    );
    expect(attendLine(CORE, tally(absences(4), 'core'))).toContain('20% of the final grade');
  });

  it('reports a graded category as a rate', () => {
    expect(attendLine(BUS, tally([], 'core'))).toContain('nothing is marked yet');
    const some = log(['2026-09-01', 'present'], ['2026-09-03', 'absent']);
    expect(attendLine(BUS, tally(some, 'core'))).toContain('50% attendance');
  });

  it('says excused absences did not count', () => {
    const one = log(['2026-09-03', 'excused']);
    expect(attendLine(CORE, tally(one, 'core'))).toContain('1 excused, which does not count');
  });
});

describe('what the projection is told', () => {
  it('is points off the final grade, not a weight', () => {
    // The syllabus subtracts the penalty from the final grade rather than
    // averaging it in, and those are different numbers.
    expect(pointsOff(CORE, tally(absences(3), 'core'))).toBe(10);
    expect(pointsOff(CORE, tally(absences(2), 'core'))).toBe(0);
    expect(pointsOff(NO_POLICY, tally(absences(9), 'core'))).toBe(0);
  });
});

describe('marking a class', () => {
  it('records one mark per course per day', () => {
    let out = mark([], 'core', '2026-09-01', 'present');
    out = mark(out, 'core', '2026-09-01', 'absent');
    expect(out).toHaveLength(1);
    expect(markOn(out, 'core', '2026-09-01')).toBe('absent');
  });

  it('clears a mis-tap rather than leaving it', () => {
    const out = mark(mark([], 'core', '2026-09-01', 'absent'), 'core', '2026-09-01', null);
    expect(out).toEqual([]);
    expect(markOn(out, 'core', '2026-09-01')).toBeNull();
  });

  it('leaves other days and other courses alone', () => {
    let out = mark([], 'core', '2026-09-01', 'absent');
    out = mark(out, 'core', '2026-09-03', 'present');
    out = mark(out, 'econ', '2026-09-01', 'excused');
    expect(out).toHaveLength(3);
    expect(markOn(out, 'core', '2026-09-01')).toBe('absent');
  });

  it('never assumes anything about a class nobody marked', () => {
    // No inference from a phone that did not move, no default after the class
    // ends. An unmarked class is unmarked.
    expect(markOn([], 'core', '2026-09-01')).toBeNull();
    expect(tally([], 'core')).toEqual({ present: 0, absent: 0, excused: 0, marked: 0 });
  });
});

describe('reading a stored policy', () => {
  it('takes real numbers', () => {
    expect(readPolicy({ allowed: 2, penaltyPer: 10, worth: 0, note: 'Two free.' })).toEqual({
      allowed: 2,
      penaltyPer: 10,
      worth: 0,
      note: 'Two free.',
    });
  });

  it('turns nonsense into "nothing stated" rather than a guess', () => {
    expect(readPolicy(undefined)).toEqual(NO_POLICY);
    expect(readPolicy({ allowed: -3, penaltyPer: 'lots', worth: NaN })).toEqual(NO_POLICY);
  });

  it('caps a figure that would swamp the grade', () => {
    expect(readPolicy({ penaltyPer: 900 }).penaltyPer).toBe(100);
    expect(readPolicy({ allowed: 900 }).allowed).toBe(60);
  });

  it('rounds an allowance to whole classes', () => {
    expect(readPolicy({ allowed: 2.6 }).allowed).toBe(3);
  });
});

describe('reading a stored log', () => {
  it('drops anything that is not a mark on a real day', () => {
    expect(
      readLog([
        { courseId: 'core', date: '2026-09-01', mark: 'absent', at: 1 },
        { courseId: 'core', date: 'sometime', mark: 'absent', at: 1 },
        { courseId: '', date: '2026-09-02', mark: 'absent', at: 1 },
        { courseId: 'core', date: '2026-09-03', mark: 'maybe', at: 1 },
        'not an object',
      ]),
    ).toHaveLength(1);
  });

  it('keeps one record per class, however many arrived', () => {
    // Two devices marking the same class is a real collision, and the second
    // copy is not a second absence.
    const twice = readLog([
      { courseId: 'core', date: '2026-09-01', mark: 'absent', at: 1 },
      { courseId: 'core', date: '2026-09-01', mark: 'absent', at: 2 },
    ]);
    expect(twice).toHaveLength(1);
    expect(tally(twice, 'core').absent).toBe(1);
  });

  it('is empty for anything that is not a list', () => {
    expect(readLog(undefined)).toEqual([]);
    expect(readLog({ 0: {} })).toEqual([]);
  });
});

describe('the id a record carries', () => {
  it('is the class it is about, so two devices cannot double-count it', () => {
    // `union` in `lib/merge.ts` keeps one row per id and prefers the newer
    // stamp. A random id would make the same absence merge into two.
    const here = mark([], 'core', '2026-09-01', 'absent', 100);
    const there = mark([], 'core', '2026-09-01', 'present', 200);
    expect(here[0].id).toBe(there[0].id);
    expect(here[0].id).toBe('core:2026-09-01');
  });

  it('is recomputed on read, so an old record without one still merges', () => {
    const old = readLog([{ courseId: 'core', date: '2026-09-01', mark: 'absent', at: 1 }]);
    expect(old[0].id).toBe('core:2026-09-01');
  });
});
