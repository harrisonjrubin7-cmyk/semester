import { describe, expect, it } from 'vitest';
import { canBuild, gradeSheet } from './gradesheet';
import { display, evaluate, type Cells } from './sheet';
import type { Course } from './types';

/** A course shaped like the ones the app ships, with weights that add to 100. */
const course = (grading: { what: string; pct: string }[]): Course => ({
  id: 'econ',
  code: 'ECON 1020',
  name: 'Principles of Macroeconomics',
  prof: 'Dr. Stromme',
  email: '',
  meets: 'MWF',
  room: '',
  credits: '3',
  source: 'Econ1020_2026_Fall.pdf',
  grading,
});

const plain = course([
  { what: 'Problem sets', pct: '20%' },
  { what: 'Midterms', pct: '50%' },
  { what: 'Final exam', pct: '30%' },
]);

/** Find the row a label sits on, so the tests do not hard-code the layout. */
function rowOf(cells: Cells, label: string): number {
  for (let r = 1; r < 60; r += 1) if (cells[`A${r}`] === label) return r;
  throw new Error(`no row labelled ${label}`);
}
const at = (cells: Cells, label: string) => evaluate(cells, `B${rowOf(cells, label)}`);

describe('the grade calculator', () => {
  it('takes its weights from the syllabus and nowhere else', () => {
    const { sheet, counted } = gradeSheet(plain);
    expect(counted).toBe(3);
    expect(sheet.cells.A5).toBe('Problem sets');
    // Whole percentage points, not fractions: a student reading "Weights add
    // to 1" does not recognise it as a whole course.
    expect(sheet.cells.B5).toBe('20');
    expect(sheet.cells.B6).toBe('50');
    expect(sheet.cells.B7).toBe('30');
    // The syllabus's own wording travels with each row.
    expect(sheet.cells.E5).toBe('20%');
  });

  it('writes no score down', () => {
    const { sheet } = gradeSheet(plain);
    for (let r = 5; r < 9; r += 1) expect(sheet.cells[`C${r}`]).toBeUndefined();
  });

  it('says in the sheet where the weights came from', () => {
    const { sheet } = gradeSheet(plain);
    expect(sheet.cells.A2).toContain('from the syllabus');
    expect(sheet.cells.A2).toContain('nothing here is a grade your university has given you');
  });

  it('adds the weights up and confirms they make a whole course', () => {
    const { sheet } = gradeSheet(plain);
    expect(at(sheet.cells, 'Weights add to')).toBe(100);
    expect(display(sheet.cells, `E${rowOf(sheet.cells, 'Weights add to')}`)).toContain('exact');
  });

  it('says plainly when the syllabus does not add to 100', () => {
    const { sheet } = gradeSheet(
      course([
        { what: 'Essays', pct: '40%' },
        { what: 'Exam', pct: '40%' },
      ]),
    );
    expect(display(sheet.cells, `E${rowOf(sheet.cells, 'Weights add to')}`)).toContain('indicative');
  });

  it('leaves every total blank until a score is typed', () => {
    const { sheet } = gradeSheet(plain);
    expect(at(sheet.cells, 'Graded so far')).toBe(0);
    expect(at(sheet.cells, 'Average so far')).toBe('');
    expect(at(sheet.cells, 'You need to average')).toBe('');
  });

  it('answers what you need on the final', () => {
    const { sheet } = gradeSheet(plain);
    const cells = { ...sheet.cells };
    // 85 on the problem sets, 78 on the midterms, final not sat.
    cells[`C${rowOf(cells, 'Problem sets')}`] = '85';
    cells[`C${rowOf(cells, 'Midterms')}`] = '78';
    cells[`B${rowOf(cells, 'If you want')}`] = '85';

    expect(at(cells, 'Graded so far')).toBe(70);
    expect(at(cells, 'Earned so far')).toBeCloseTo(85 * 0.2 + 78 * 0.5, 10);
    expect(at(cells, 'Average so far')).toBeCloseTo(80, 10);
    expect(at(cells, 'Still to be graded')).toBe(30);
    // (85 − 56) / 0.3 = 96.67 on the final.
    expect(Number(at(cells, 'You need to average'))).toBeCloseTo(96.6667, 3);
  });

  it('says a target is out of reach rather than capping it at full marks', () => {
    const { sheet } = gradeSheet(plain);
    const cells = { ...sheet.cells };
    cells[`C${rowOf(cells, 'Problem sets')}`] = '40';
    cells[`C${rowOf(cells, 'Midterms')}`] = '50';
    cells[`B${rowOf(cells, 'If you want')}`] = '90';
    expect(Number(at(cells, 'You need to average'))).toBeGreaterThan(100);
    expect(display(cells, `E${rowOf(cells, 'You need to average')}`)).toContain('out of reach');
  });

  it('says when the grade is already settled', () => {
    const { sheet } = gradeSheet(plain);
    const cells = { ...sheet.cells };
    for (const what of ['Problem sets', 'Midterms', 'Final exam']) {
      cells[`C${rowOf(cells, what)}`] = '88';
    }
    cells[`B${rowOf(cells, 'If you want')}`] = '85';
    expect(at(cells, 'You need to average')).toBe('Nothing left to be graded.');
  });

  it('keeps extra credit out of the total weight but counts what it earns', () => {
    const { sheet } = gradeSheet(
      course([
        { what: 'Problem sets', pct: '20%' },
        { what: 'Exams', pct: '80%' },
        { what: 'Top Hat participation', pct: '+3% EC' },
      ]),
    );
    const cells = { ...sheet.cells };
    expect(at(cells, 'Weights add to')).toBe(100);

    cells[`C${rowOf(cells, 'Problem sets')}`] = '90';
    cells[`C${rowOf(cells, 'Exams')}`] = '80';
    cells[`C${rowOf(cells, 'Top Hat participation')}`] = '100';
    // 90×0.2 + 80×0.8 = 82, plus the full 3 points of extra credit.
    expect(at(cells, 'Earned so far')).toBeCloseTo(85, 10);
  });

  it('leaves a weight it could not read blank, with the wording beside it', () => {
    const { sheet, unreadable } = gradeSheet(
      course([
        { what: 'Exams', pct: '70%' },
        { what: 'Participation', pct: 'at the instructor’s discretion' },
      ]),
    );
    expect(unreadable).toEqual(['Participation']);
    const row = rowOf(sheet.cells, 'Participation');
    expect(sheet.cells[`B${row}`]).toBeUndefined();
    expect(sheet.cells[`E${row}`]).toBe('at the instructor’s discretion');
  });

  it('carries a recorded grade across as the student’s own, uncounted', () => {
    const { sheet } = gradeSheet(plain, 'B+');
    const row = rowOf(sheet.cells, 'Recorded on Courses');
    expect(sheet.cells[`B${row}`]).toBe('B+');
    expect(sheet.cells[`E${row}`]).toContain('Not counted');
    // And it stays out of the arithmetic.
    expect(at(sheet.cells, 'Earned so far')).toBe(0);
  });

  it('is filed against the course and titled after it', () => {
    const { sheet } = gradeSheet(plain);
    expect(sheet.courseId).toBe('econ');
    expect(sheet.title).toBe('ECON 1020 — what do I need?');
  });

  it('is not offered for a course whose weights cannot be read', () => {
    expect(canBuild(plain)).toBe(true);
    expect(canBuild(course([{ what: 'Everything', pct: 'see syllabus' }]))).toBe(false);
    expect(canBuild(course([{ what: 'Bonus', pct: '+5% EC' }]))).toBe(false);
  });
});

describe('a syllabus written in points', () => {
  const pts = course([
    { what: 'Problem sets', pct: '50 pts' },
    { what: 'Final', pct: '150 pts' },
  ]);

  it('is offered a calculator, which it was not', () => {
    // "50 pts" states a weight as plainly as "20%" does — against a
    // denominator the syllabus expects you to add up yourself.
    expect(canBuild(pts)).toBe(true);
  });

  it('converts the points to their share of the course', () => {
    const { sheet, counted } = gradeSheet(pts);
    expect(sheet.cells.B5).toBe('25');
    expect(sheet.cells.B6).toBe('75');
    expect(counted).toBe(2);
    expect(at(sheet.cells, 'Weights add to')).toBe(100);
  });

  it('keeps the syllabus’s own wording beside each row', () => {
    const { sheet } = gradeSheet(pts);
    expect(sheet.cells.E5).toBe('50 pts');
  });

  it('answers the question, in points as in percentages', () => {
    const { sheet } = gradeSheet(pts);
    const cells = { ...sheet.cells };
    cells[`C${rowOf(cells, 'Problem sets')}`] = '90';
    cells[`B${rowOf(cells, 'If you want')}`] = '85';
    // 90 on a quarter of the course is 22.5 earned; 62.5 needed over the
    // remaining 75 points is 83.33 on the final.
    expect(at(cells, 'Earned so far')).toBeCloseTo(22.5, 10);
    expect(Number(at(cells, 'You need to average'))).toBeCloseTo(83.333, 3);
  });

  it('leaves a mixed syllabus’s percentages alone', () => {
    // Percentages and points in one syllabus are two denominators, and
    // guessing at how they relate would produce a confident wrong number.
    const mixed = course([
      { what: 'Essays', pct: '40%' },
      { what: 'Lab', pct: '30 pts' },
    ]);
    const { sheet, unreadable } = gradeSheet(mixed);
    expect(sheet.cells.B5).toBe('40');
    expect(sheet.cells[`B${rowOf(sheet.cells, 'Lab')}`]).toBeUndefined();
    expect(unreadable).toEqual(['Lab']);
  });

  it('is still not offered to a syllabus that states nothing', () => {
    expect(canBuild(course([{ what: 'Everything', pct: 'at the instructor’s discretion' }]))).toBe(false);
  });
});

/*
 * Caught by a second review pass, on the points support added just above.
 * Rounding each weight on its own put the total either side of 100 by a
 * hundredth, which the sheet then reported as weights that do not add up.
 */
describe('weights that do not divide evenly', () => {
  const of = (n: number) =>
    gradeSheet(course(Array.from({ length: n }, (_, i) => ({ what: `C${i}`, pct: '1 pt' })))).sheet;

  it('adds to exactly 100 when three components split it', () => {
    const sheet = of(3);
    expect(at(sheet.cells, 'Weights add to')).toBe(100);
    expect([sheet.cells.B5, sheet.cells.B6, sheet.cells.B7]).toEqual(['33.34', '33.33', '33.33']);
  });

  it('adds to exactly 100 when seven do, which rounded the other way', () => {
    // Seven at 14.2857 reached 100.03, and asking for 100 then needed more
    // than full marks and read as out of reach.
    expect(at(of(7).cells, 'Weights add to')).toBe(100);
  });

  it('adds to exactly 100 across a range of awkward splits', () => {
    // Through `display`, which is what the student reads: summing exact
    // two-place values still accumulates a float tail, and the sheet rounds it
    // away at twelve significant figures exactly as it does everywhere else.
    for (const n of [3, 6, 7, 9, 11, 13]) {
      const cells = of(n).cells;
      expect(display(cells, `B${rowOf(cells, 'Weights add to')}`)).toBe('100');
      expect(display(cells, `E${rowOf(cells, 'Weights add to')}`)).toContain('exact');
    }
  });

  it('asks for exactly 100 on the last component, not more', () => {
    const cells = { ...of(3).cells };
    cells[`C${rowOf(cells, 'C0')}`] = '100';
    cells[`C${rowOf(cells, 'C1')}`] = '100';
    cells[`B${rowOf(cells, 'If you want')}`] = '100';
    expect(Number(at(cells, 'You need to average'))).toBeCloseTo(100, 6);
    expect(display(cells, `E${rowOf(cells, 'You need to average')}`)).not.toContain('out of reach');
  });

  it('leaves weights that already divide cleanly alone', () => {
    const clean = gradeSheet(
      course([{ what: 'A', pct: '50 pts' }, { what: 'B', pct: '150 pts' }]),
    ).sheet;
    expect([clean.cells.B5, clean.cells.B6]).toEqual(['25', '75']);
  });
});
