import { describe, expect, it } from 'vitest';
import { COMMON_LETTER, type GradeSystem } from './cutoffs';
import { standing } from './grades';
import { landingAt, moveLine, moves, termGpa, termLine, missingLine, type Sitting } from './termgpa';
import type { Course, CourseId } from './types';

/** A course with one 50% category graded and one still to come. */
function course(id: string, code: string, credits: string): Course {
  return {
    id: id as CourseId,
    code,
    name: code,
    prof: '',
    email: '',
    meets: '',
    room: '',
    credits,
    source: '',
    grading: [
      { what: 'Midterm', pct: '50%' },
      { what: 'Final', pct: '50%' },
    ],
  } as Course;
}

function sitting(
  id: string,
  code: string,
  credits: string,
  scores: Record<string, string>,
  system: GradeSystem = COMMON_LETTER,
): Sitting {
  const c = course(id, code, credits);
  return {
    courseId: c.id,
    code,
    credits,
    standing: standing(c, scores),
    scores: Object.values(scores).map(Number).filter(Number.isFinite),
    system,
  };
}

describe('landingAt', () => {
  it('treats a letter as a cliff and never rounds up to it', () => {
    // The whole reason percentages are not rounded before the scale reads
    // them: a tenth of a point is a whole grade point here.
    expect(landingAt(89.94, COMMON_LETTER)).toEqual({ pct: 89.94, letter: 'B+', points: 3.3 });
    expect(landingAt(90, COMMON_LETTER)).toEqual({ pct: 90, letter: 'A−', points: 3.7 });
  });

  it('says nothing rather than guessing when the scale states no points', () => {
    const noPoints: GradeSystem = { kind: 'custom', scale: [{ label: 'Pass', min: 60 }] };
    expect(landingAt(75, noPoints)).toEqual({ pct: 75, letter: 'Pass', points: null });
  });
});

describe('termGpa', () => {
  it('weighs each course by its credit hours', () => {
    // 95 in a 3-hour course (A, 4.0) and 85 in a 1-hour one (B, 3.0).
    // Both halves graded, so the band has nothing left to move.
    const t = termGpa([
      sitting('a', 'A 100', '3 credits', { 'a:0': '95', 'a:1': '95' }),
      sitting('b', 'B 200', '1 credit', { 'b:0': '85', 'b:1': '85' }),
    ]);
    expect(t.hours).toBe(4);
    expect(t.gpa?.mid).toBe(3.75);
    expect(t.gpa?.low).toBe(3.75);
    expect(t.gpa?.high).toBe(3.75);
  });

  it('carries the projection band through into the GPA', () => {
    // Half the grade is in at 91; the rest can move it either way, so the
    // band must be wider than a point.
    const t = termGpa([sitting('a', 'A 100', '3 credits', { 'a:0': '91' })]);
    expect(t.gpa!.low).toBeLessThan(t.gpa!.mid);
    expect(t.gpa!.high).toBeGreaterThan(t.gpa!.mid);
  });

  it('leaves a course out and says which fix it needs', () => {
    const t = termGpa([
      sitting('a', 'A 100', '3 credits', { 'a:0': '95' }),
      sitting('b', 'B 200', '3 credits', {}),
      sitting('c', 'C 300', 'TR 9:30', { 'c:0': '88' }),
    ]);
    expect(t.counted.map((c) => c.code)).toEqual(['A 100']);
    expect(t.courses[1].missing).toBe('ungraded');
    expect(t.courses[2].missing).toBe('hours');
    expect(missingLine(t.courses[1])).toContain('nothing graded yet');
    expect(missingLine(t.courses[2])).toContain('credit hours');
  });

  it('will not compute a GPA off a scale with no grade points', () => {
    const noPoints: GradeSystem = { kind: 'custom', scale: [{ label: 'Pass', min: 60 }] };
    const t = termGpa([sitting('a', 'A 100', '3 credits', { 'a:0': '95' }, noPoints)]);
    expect(t.courses[0].missing).toBe('points');
    expect(t.gpa).toBeNull();
    expect(termLine(t)).toContain('needs at least one of each');
  });

  it('says nothing at all about an empty term', () => {
    const t = termGpa([]);
    expect(t.gpa).toBeNull();
    expect(t.cumulative).toBeNull();
    expect(termLine(t)).toContain('No courses');
  });

  it('folds the term into the record already banked', () => {
    // 30 hours at 3.5 (105 points), plus 3 hours of a straight A.
    const t = termGpa([sitting('a', 'A 100', '3 credits', { 'a:0': '95', 'a:1': '95' })], {
      points: 105,
      hours: 30,
    });
    expect(t.cumulative?.before).toBe(3.5);
    expect(t.cumulative?.hours).toBe(33);
    expect(t.cumulative?.after.mid).toBeCloseTo((105 + 12) / 33, 3);
    // The term pulls it up, and the band is narrower than the term's own
    // because thirty hours are already fixed.
    expect(t.cumulative!.after.mid).toBeGreaterThan(3.5);
  });

  it('has no cumulative line for somebody with nothing behind them', () => {
    const t = termGpa([sitting('a', 'A 100', '3 credits', { 'a:0': '95' })], { points: 0, hours: 0 });
    expect(t.cumulative).toBeNull();
  });
});

describe('termLine', () => {
  it('leads with the band rather than the middle', () => {
    const t = termGpa([sitting('a', 'A 100', '3 credits', { 'a:0': '91' })]);
    const line = termLine(t);
    expect(line.indexOf('Somewhere between')).toBe(0);
    expect(line).toContain('if the rest goes like the graded part');
  });

  it('says when the band is wide instead of leaving it to be noticed', () => {
    expect(termLine(termGpa([sitting('a', 'A 100', '3 credits', { 'a:0': '91' })]))).toContain(
      'wide band',
    );
  });
});

describe('moves', () => {
  const systems = { a: COMMON_LETTER, b: COMMON_LETTER };

  it('ranks the step by what it is worth to the term', () => {
    // Two courses heading for a B+; the step is worth more in the 4-hour one.
    const t = termGpa([
      sitting('a', 'A 100', '4 credits', { 'a:0': '88' }),
      sitting('b', 'B 200', '1 credit', { 'b:0': '88' }),
    ]);
    const list = moves(t, systems);
    expect(list[0].code).toBe('A 100');
    expect(list[0].gain).toBeGreaterThan(list[1].gain);
  });

  it('names the step and what the rest has to average for it', () => {
    const t = termGpa([sitting('a', 'A 100', '3 credits', { 'a:0': '88' })]);
    const [m] = moves(t, systems);
    expect(m.from).toBe('B+');
    expect(m.to).toBe('A−');
    // Half the grade is in at 88; 90 overall needs 92 on the other half.
    expect(m.need).toBe(92);
    expect(moveLine(m)).toContain('92% on everything left');
  });

  it('shows an unreachable step as unreachable rather than hiding it', () => {
    // 10 on the first half of the grade: even a D− needs 110 on the rest.
    const t = termGpa([sitting('a', 'A 100', '3 credits', { 'a:0': '10' })]);
    const [m] = moves(t, systems);
    expect(m.to).toBe('D−');
    expect(m.reach).toBe('unreachable');
    // Shown rather than hidden: knowing a grade is out of range is what stops
    // the hours going there.
    expect(moveLine(m)).toContain('out of reach');
  });

  it('offers no step to a course already at the top of its scale', () => {
    const t = termGpa([sitting('a', 'A 100', '3 credits', { 'a:0': '99', 'a:1': '99' })]);
    expect(moves(t, systems)).toEqual([]);
  });

  it('is empty when there is no term GPA to move', () => {
    expect(moves(termGpa([]), systems)).toEqual([]);
  });
});
