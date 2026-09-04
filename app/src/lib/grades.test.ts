import { describe, expect, it } from 'vitest';
import { TARGETS, key, needCaveat, needFor, reachFor, reaches, readScore, readWeight, standing } from './grades';
import type { Standing } from './grades';
import type { Course } from './types';

const course = (grading: { what: string; pct: string }[]) =>
  ({ id: 'econ', grading } as unknown as Course);

describe('readWeight', () => {
  it('reads a plain percentage', () => {
    expect(readWeight('20%')).toEqual({ weight: 20, extra: false, points: null });
  });

  it('takes the midpoint of a range', () => {
    expect(readWeight('25–30%').weight).toBe(27.5);
  });

  it('marks extra credit as extra rather than part of the hundred', () => {
    expect(readWeight('+3% EC')).toEqual({ weight: 3, extra: true, points: null });
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
    pointsOff: 0,
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
    pointsOff: 0,
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

describe('a category scored from its pieces', () => {
  const course = {
    id: 'core',
    grading: [
      { what: 'Quizzes', pct: '40%' },
      { what: 'Final', pct: '60%' },
    ],
  } as unknown as Course;

  it('averages the pieces after the syllabus strikes the lowest out', () => {
    // Eight quizzes with the lowest two dropped is what CORE 2500 says, and
    // a student entering a category average is entering a number their course
    // does not use.
    const s = standing(course, {}, {
      pieces: { [key('core', 0)]: '54, 68, 88, 92, 96' },
      drops: { [key('core', 0)]: 2 },
    });
    expect(s.rows[0].score).toBeCloseTo(92, 5);
  });

  it('is the plain average with no rule', () => {
    const s = standing(course, {}, { pieces: { [key('core', 0)]: '80, 90' } });
    expect(s.rows[0].score).toBe(85);
  });

  it('falls back to the single box when no pieces are entered', () => {
    const s = standing(course, { [key('core', 0)]: '77' }, {});
    expect(s.rows[0].score).toBe(77);
  });

  it('prefers the pieces over the box when both are there', () => {
    // The pieces are the more specific answer, and leaving a stale box value
    // winning would be a figure nobody could account for.
    const s = standing(course, { [key('core', 0)]: '77' }, {
      pieces: { [key('core', 0)]: '90, 90' },
    });
    expect(s.rows[0].score).toBe(90);
  });
});

describe('absences, in the projection', () => {
  const course = { id: 'core', grading: [{ what: 'Exams', pct: '100%' }] } as unknown as Course;

  it('comes off the finished grade, not out of the weighting', () => {
    const clean = standing(course, { [key('core', 0)]: '88' });
    const docked = standing(course, { [key('core', 0)]: '88' }, { pointsOff: 10 });
    expect(clean.current).toBe(88);
    expect(docked.current).toBe(78);
    expect(docked.pointsOff).toBe(10);
  });

  it('never takes a grade below zero', () => {
    const s = standing(course, { [key('core', 0)]: '30' }, { pointsOff: 50 });
    expect(s.current).toBe(0);
  });

  it('raises what you need on everything left', () => {
    // Leaving the penalty out here would tell somebody three absences over
    // the allowance that they need 78% when they need 108%.
    const two = { id: 'x', grading: [{ what: 'A', pct: '50%' }, { what: 'B', pct: '50%' }] } as unknown as Course;
    const clean = standing(two, { [key('x', 0)]: '90' });
    const docked = standing(two, { [key('x', 0)]: '90' }, { pointsOff: 10 });
    expect(needFor(docked, 85)! - needFor(clean, 85)!).toBeCloseTo(20, 5);
  });
});

describe('attendance as a graded category', () => {
  const course = { id: 'bus', grading: [{ what: 'Exams', pct: '90%' }] } as unknown as Course;

  it('joins the rows, weighted and counted like any other line', () => {
    const s = standing(course, { [key('bus', 0)]: '80' }, {
      attendance: { worth: 10, rate: 100 },
    });
    expect(s.rows.map((r) => r.what)).toContain('Attendance');
    expect(s.counted).toBe(100);
    expect(s.current).toBeCloseTo(82, 5);
  });

  it('counts towards the weight but not the average until it is marked', () => {
    const s = standing(course, { [key('bus', 0)]: '80' }, {
      attendance: { worth: 10, rate: null },
    });
    expect(s.counted).toBe(90);
    expect(s.current).toBe(80);
  });

  it('adds no row when the syllabus does not grade it', () => {
    const s = standing(course, {}, { attendance: { worth: 0, rate: 100 } });
    expect(s.rows.map((r) => r.what)).not.toContain('Attendance');
  });
});

describe('a syllabus that states points rather than percentages', () => {
  // CORE 2500, as its syllabus actually words it. Until this, every weight
  // read as null and the whole screen said "nothing graded yet" for a course
  // whose grading was completely specified.
  const core = {
    id: 'core',
    grading: [
      { what: 'Eight quizzes, 10 pts each', pct: '80 pts' },
      { what: 'Thirteen reflections, 10 pts', pct: '130 pts' },
      { what: 'Final reflection', pct: '20 pts' },
    ],
  } as unknown as Course;

  it('reads the points off the row', () => {
    expect(readWeight('80 pts').points).toBe(80);
    expect(readWeight('20 points').points).toBe(20);
    expect(readWeight('40%').points).toBeNull();
  });

  it('weighs each row against the total the syllabus adds up to', () => {
    const s = standing(core, {});
    // 80 + 130 + 20 = 230.
    expect(s.rows[0].weight).toBeCloseTo((80 / 230) * 100, 5);
    expect(s.rows[1].weight).toBeCloseTo((130 / 230) * 100, 5);
    expect(s.rows.reduce((n, r) => n + (r.weight ?? 0), 0)).toBeCloseTo(100, 5);
  });

  it('stops calling a fully specified course incomplete', () => {
    expect(standing(core, {}).incomplete).toBe(false);
    expect(needCaveat(standing(core, {}))).toBe('');
  });

  it('projects a real grade from it', () => {
    const s = standing(core, { [key('core', 0)]: '90', [key('core', 1)]: '80' });
    expect(s.current).toBeCloseTo((0.9 * 80 + 0.8 * 130) / 210 * 100, 5);
  });

  it('leaves a mixed syllabus alone rather than guessing', () => {
    // "40%" and "20 pts" are two statements about two different denominators.
    // Relating them would be a confident wrong number; the points row stays
    // unweighted, which the screen already marks and explains.
    const mixed = {
      id: 'x',
      grading: [
        { what: 'Exams', pct: '40%' },
        { what: 'Labs', pct: '20 pts' },
      ],
    } as unknown as Course;
    const s = standing(mixed, {});
    expect(s.rows[0].weight).toBe(40);
    expect(s.rows[1].weight).toBeNull();
  });

  it('is null all round when a course states neither', () => {
    const vague = { id: 'y', grading: [{ what: 'Participation', pct: 'as announced' }] } as unknown as Course;
    expect(standing(vague, {}).rows[0].weight).toBeNull();
  });
});
