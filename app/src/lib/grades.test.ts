import { describe, expect, it } from 'vitest';
import { key, needFor, readScore, readWeight, standing } from './grades';
import type { Course } from './types';

const course = (grading: { what: string; pct: string }[]) =>
  ({ id: 'econ', grading } as unknown as Course);

describe('readWeight', () => {
  it('reads a plain percentage', () => {
    expect(readWeight('20%')).toEqual({ weight: 20, extra: false });
  });

  it('takes the midpoint of a range', () => {
    expect(readWeight('25–30%').weight).toBe(27.5);
  });

  it('marks extra credit as extra rather than part of the hundred', () => {
    expect(readWeight('+3% EC')).toEqual({ weight: 3, extra: true });
  });

  it('does not read a count as a range', () => {
    // "best 2 of 3 exams, 60%" is worth 60, not the midpoint of two and three.
    expect(readWeight('Best 2 of 3 exams, 60%').weight).toBe(60);
  });

  it('returns null rather than guessing at wording it cannot read', () => {
    expect(readWeight('graded pass/fail').weight).toBeNull();
    expect(readWeight('10 pts').weight).toBeNull();
  });
});

describe('readScore', () => {
  it('reads the shapes people type', () => {
    expect(readScore('88')).toBe(88);
    expect(readScore('88%')).toBe(88);
    expect(readScore(' 88 ')).toBe(88);
  });

  it('reads a fraction', () => {
    expect(readScore('17/20')).toBe(85);
  });

  it('reads a bare proportion as a percentage', () => {
    expect(readScore('0.88')).toBe(88);
  });

  it('does not divide by zero', () => {
    expect(readScore('5/0')).toBeNull();
  });

  it('returns null for nothing and for nonsense', () => {
    expect(readScore('')).toBeNull();
    expect(readScore('  ')).toBeNull();
    expect(readScore('most of it')).toBeNull();
  });
});

describe('standing', () => {
  const econ = course([
    { what: 'Problem sets', pct: '20%' },
    { what: 'Exams', pct: '80%' },
    { what: 'Participation', pct: '+3% EC' },
  ]);

  it('reports nothing entered as nothing known', () => {
    const s = standing(econ, {});
    expect(s.current).toBeNull();
    expect(s.counted).toBe(0);
    expect(s.remaining).toBe(100);
  });

  it('computes the standing across what has been graded', () => {
    const s = standing(econ, { [key('econ', 0)]: '90' });
    expect(s.counted).toBe(20);
    expect(s.earned).toBeCloseTo(18);
    expect(s.current).toBeCloseTo(90);
    expect(s.remaining).toBe(80);
  });

  it('keeps extra credit out of the weighting but counts its points', () => {
    const s = standing(econ, { [key('econ', 2)]: '100' });
    expect(s.counted).toBe(0);
    expect(s.extraCredit).toBeCloseTo(3);
  });

  it('flags a table whose weights do not add to 100', () => {
    expect(standing(course([{ what: 'Only thing', pct: '40%' }]), {}).incomplete).toBe(true);
    expect(standing(econ, {}).incomplete).toBe(false);
  });
});

describe('needFor', () => {
  const econ = course([
    { what: 'Problem sets', pct: '20%' },
    { what: 'Exams', pct: '80%' },
  ]);

  it('answers what the rest has to average', () => {
    // 90% of a 20% category is 18 banked; 75 more points needed from 80.
    const s = standing(econ, { [key('econ', 0)]: '90' });
    expect(needFor(s, 93)).toBeCloseTo(93.75);
  });

  it('returns an impossible number rather than hiding it', () => {
    const s = standing(econ, { [key('econ', 1)]: '40' });
    const need = needFor(s, 93);
    expect(need).not.toBeNull();
    expect(need!).toBeGreaterThan(100);
  });

  it('returns null when there is nothing left to play for', () => {
    const s = standing(econ, { [key('econ', 0)]: '90', [key('econ', 1)]: '90' });
    expect(needFor(s, 93)).toBeNull();
  });
});
