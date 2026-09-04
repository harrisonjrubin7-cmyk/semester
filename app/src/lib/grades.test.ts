import { describe, expect, it } from 'vitest';
import { TARGETS, key, needCaveat, needFor, reachFor, reaches, readScore, readWeight, standing } from './grades';
import type { Standing } from './grades';
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

describe('what a target grade would take', () => {
  /** A course with `counted`% graded at `avg`, and the rest to play for. */
  const at = (counted: number, avg: number, total = 100): Standing => ({
    rows: [],
    earned: (counted * avg) / 100,
    counted,
    remaining: Math.max(0, total - counted),
    current: counted > 0 ? avg : null,
    extraCredit: 0,
    incomplete: Math.abs(total - 100) > 0.5,
  });

  it('gives the number and what to make of it', () => {
    // 40% graded at 85 → 34 banked, 60 left, needs (93-34)/60 = 98.3%.
    const out = reachFor(at(40, 85), 93, 'A');
    expect(out.need).toBeCloseTo(98.33, 1);
    expect(out.reach).toBe('unreachable');
    expect(out.says).toMatch(/not a plan/);
  });

  it('calls a demanding but possible target hard, not impossible', () => {
    const out = reachFor(at(40, 90), 90);
    expect(out.reach).toBe('hard');
    expect(out.says).toBe('90% on everything left.');
  });

  it('calls an ordinary one ordinary', () => {
    expect(reachFor(at(50, 88), 83).reach).toBe('ordinary');
  });

  it('says when a grade is already secured', () => {
    // A negative requirement is arithmetically right and reads as nonsense.
    const out = reachFor(at(90, 95), 83);
    expect(out.need).toBeLessThan(0);
    expect(out.reach).toBe('secured');
    expect(out.says).toMatch(/Already yours/);
  });

  it('says when there is nothing left to change it', () => {
    const out = reachFor(at(100, 88), 93);
    expect(out.need).toBeNull();
    expect(out.reach).toBe('settled');
  });

  it('does not pretend to know before anything is graded', () => {
    // The arithmetic answer is "the target itself", which is true and useless.
    const out = reachFor(at(0, 0), 90);
    expect(out.reach).toBe('unknown');
    expect(out.says).toMatch(/Nothing is graded yet/);
  });

  it('counts extra credit towards the target', () => {
    const s = { ...at(50, 80), extraCredit: 3 };
    expect(reachFor(s, 90).need).toBeLessThan(reachFor(at(50, 80), 90).need!);
  });

  it('covers every band, highest first', () => {
    const all = reaches(at(50, 85));
    expect(all).toHaveLength(TARGETS.length);
    expect(all[0].label).toBe('A');
    expect(all.map((r) => r.target)).toEqual([...all.map((r) => r.target)].sort((a, b) => b - a));
  });
});

describe('the caveat that travels with the figures', () => {
  const s = (total: number): Standing => ({
    rows: [],
    earned: 40,
    counted: 50,
    remaining: total - 50,
    current: 80,
    extraCredit: 0,
    incomplete: Math.abs(total - 100) > 0.5,
  });

  it('says nothing when the weights add up', () => {
    expect(needCaveat(s(100))).toBe('');
  });

  it('says what they add to when they do not', () => {
    // A syllabus listing eight categories that total 95 is common, and every
    // figure is then a ratio of the wrong denominator.
    expect(needCaveat(s(95))).toContain('add to 95%');
    expect(needCaveat(s(95))).toMatch(/Fix the weights/);
  });
});
