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
    expect(sheet.cells.B5).toBe('20%');
    expect(sheet.cells.B6).toBe('50%');
    expect(sheet.cells.B7).toBe('30%');
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
    expect(at(sheet.cells, 'Weights add to')).toBeCloseTo(1, 10);
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

    expect(at(cells, 'Graded so far')).toBeCloseTo(0.7, 10);
    expect(at(cells, 'Earned so far')).toBeCloseTo(85 * 0.2 + 78 * 0.5, 10);
    expect(at(cells, 'Average so far')).toBeCloseTo(56 / 0.7, 10);
    expect(at(cells, 'Still to be graded')).toBeCloseTo(0.3, 10);
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
    expect(at(cells, 'Weights add to')).toBeCloseTo(1, 10);

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
