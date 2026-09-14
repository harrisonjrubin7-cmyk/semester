import { describe, expect, it } from 'vitest';
import { TEMPLATES, fromTemplate } from './sheettemplates';
import { clock, evaluate, show, type Cells } from './sheet';

/**
 * The two calculators that need nothing loaded.
 *
 * `lib/gradesheet.ts` and `lib/gpasheet.ts` build better versions out of the
 * student's own syllabus and transcript. These are for when neither is there —
 * a syllabus written in prose, a term the app does not hold, a borrowed laptop.
 *
 * Every test here fills the template in and evaluates it through the engine
 * that evaluates it in the app. A template is formulas typed into a literal,
 * with row numbers written by hand, and the failure mode is a reference off by
 * one that still parses: it answers, and the answer is nonsense.
 */

const ctx = clock(0);

function sheetOf(id: string): Cells {
  const template = TEMPLATES.find((t) => t.id === id);
  if (!template) throw new Error(`no template ${id} — saw ${TEMPLATES.map((t) => t.id).join(', ')}`);
  return { ...fromTemplate(template, '').cells };
}

const read = (cells: Cells, at: string) => show(evaluate(cells, at, new Set(), ctx));

/** The row whose column A says this, so a shifted layout fails loudly. */
function rowSaying(cells: Cells, text: string): number {
  for (let r = 1; r < 60; r += 1) if ((cells[`A${r}`] ?? '') === text) return r;
  throw new Error(`no row headed “${text}”`);
}

describe('the blank grade calculator', () => {
  it('is on the shelf', () => {
    expect(TEMPLATES.map((t) => t.id)).toContain('grades');
  });

  it('says nothing until something is typed, rather than nought', () => {
    const cells = sheetOf('grades');
    expect(read(cells, 'D2')).toBe('');
    expect(read(cells, `D${rowSaying(cells, 'Weighted so far')}`)).toBe('');
  });

  it('weights a score', () => {
    const cells = sheetOf('grades');
    cells.B2 = '20';
    cells.C2 = '85';
    // 20% of the course, scored 85 → 17 points of the hundred.
    expect(read(cells, 'D2')).toBe('17');
  });

  it('adds the weights up, so a syllabus that does not reach 100 shows it', () => {
    const cells = sheetOf('grades');
    cells.B2 = '20';
    cells.B3 = '30';
    expect(read(cells, `B${rowSaying(cells, 'In all')}`)).toBe('50');
  });

  /*
   * The figure people actually want in week eight: the average over the parts
   * that have been marked, not out of a course three-quarters unmarked. 17 + 27
   * points over the 50% that has been scored is 88.
   */
  it('averages over the parts that have a mark, not over the whole course', () => {
    const cells = sheetOf('grades');
    cells.B2 = '20';
    cells.C2 = '85';
    cells.B3 = '30';
    cells.C3 = '90';
    cells.B4 = '50';
    expect(read(cells, `D${rowSaying(cells, 'Weighted so far')}`)).toBe('88');
  });
});

describe('the blank GPA planner', () => {
  it('is on the shelf', () => {
    expect(TEMPLATES.map((t) => t.id)).toContain('gpa');
  });

  /*
   * The row numbers in this template are written by hand, so the lookups are
   * checked against the table they claim to read rather than assumed to land
   * on it — an off-by-one here still parses and still answers.
   */
  it('looks a grade up in the table it ships with', () => {
    const cells = sheetOf('gpa');
    cells.B2 = '3';
    cells.C2 = 'A';
    expect(read(cells, 'D2')).toBe('4');
    expect(read(cells, 'E2')).toBe('12');
  });

  it('gives a letter that is not in the table no points, rather than the nearest', () => {
    const cells = sheetOf('gpa');
    cells.B2 = '3';
    cells.C2 = 'W';
    expect(read(cells, 'D2')).toBe('');
  });

  it('divides by the credits that have a grade, not by the credits typed', () => {
    const cells = sheetOf('gpa');
    cells.B2 = '3';
    cells.C2 = 'A';
    cells.B3 = '4';
    expect(read(cells, `B${rowSaying(cells, 'This term')}`)).toBe('7');
    expect(read(cells, `F${rowSaying(cells, 'This term')}`)).toBe('3');
    expect(read(cells, `B${rowSaying(cells, 'Term GPA so far')}`)).toBe('4');
  });

  it('folds in what came before', () => {
    const cells = sheetOf('gpa');
    cells.B2 = '3';
    cells.C2 = 'A';
    cells[`B${rowSaying(cells, 'Credits before this term')}`] = '30';
    cells[`B${rowSaying(cells, 'GPA before this term')}`] = '3.5';
    // (105 + 12) / 33
    expect(read(cells, `B${rowSaying(cells, 'GPA in all')}`)).toBe('3.54545454545');
  });

  it('is the term on its own for a first-year, rather than empty', () => {
    const cells = sheetOf('gpa');
    cells.B2 = '3';
    cells.C2 = 'A';
    expect(read(cells, `B${rowSaying(cells, 'GPA in all')}`)).toBe('4');
  });

  it('says nothing at all before anything is typed', () => {
    const cells = sheetOf('gpa');
    expect(read(cells, `B${rowSaying(cells, 'Term GPA so far')}`)).toBe('');
    expect(read(cells, `B${rowSaying(cells, 'GPA in all')}`)).toBe('');
  });
});

it('every template still computes without an error anywhere in it', () => {
  for (const template of TEMPLATES) {
    const cells = { ...fromTemplate(template, '').cells };
    for (const at of Object.keys(cells)) {
      const got = read(cells, at);
      expect(`${template.id}:${at} ${got}`).not.toMatch(/#[A-Z]+[!?]/);
    }
  }
});
