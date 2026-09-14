import { describe, expect, it } from 'vitest';
import { behindOf, canPlan, creditsOf, gpaSheet, pointsIn, saidScale, topOf } from './gpasheet';
import { COMMON_LETTER, type GradeSystem } from './cutoffs';
import { COMMON_SCALE, type Taken } from './degree';
import { clock, evaluate, show, type Cells } from './sheet';
import type { Course } from './types';

/**
 * The GPA planner.
 *
 * Most of this file evaluates the sheet's own formulas through the app's own
 * engine and checks the answers, rather than checking which strings landed in
 * which cells. A planner is arithmetic somebody plans a term around; a test
 * asserting that `E5` contains the text `=B5*D5` would pass just as happily
 * with the multiplication the wrong way round.
 */

const ctx = clock(0);

const course = (code: string, credits: string): Course =>
  ({ id: code.toLowerCase(), code, title: code, credits, grading: [] }) as unknown as Course;

const THREE = [course('ECON 1020', '3'), course('PSCI 1100', '3'), course('BUS 1600', '4')];

/** The sheet's own cells, read by the engine that reads them in the app. */
function read(cells: Cells, address: string): string {
  return show(evaluate(cells, address, new Set(), ctx));
}

/** Find the row whose column A says this, so the tests do not hard-code a layout. */
function rowSaying(cells: Cells, text: string): number {
  for (let r = 1; r < 200; r += 1) {
    if ((cells[`A${r}`] ?? '') === text) return r;
  }
  throw new Error(`no row headed “${text}” — saw ${JSON.stringify(Object.keys(cells).slice(0, 12))}`);
}

/** Type a grade into a course's row, the way somebody fills the sheet in. */
function grade(cells: Cells, code: string, letter: string) {
  cells[`C${rowSaying(cells, code)}`] = letter;
}

describe('the credits of a course', () => {
  it('reads a plain number', () => {
    expect(creditsOf({ credits: '3' })).toBe(3);
    expect(creditsOf({ credits: '1.5' })).toBe(1.5);
  });

  /*
   * How this app's own courses say it, and the reason this test exists: the
   * first version took `"3"` and nothing else, so every credits cell came out
   * blank for the four courses the app ships with — and every unit test passed,
   * because they all handed it a tidy number no catalogue writes.
   */
  it('reads the wording the app’s own courses use', () => {
    expect(creditsOf({ credits: '3 credits' })).toBe(3);
    expect(creditsOf({ credits: '2 credits' })).toBe(2);
  });

  it('reads the other ways a catalogue writes a unit', () => {
    expect(creditsOf({ credits: '4 hours' })).toBe(4);
    expect(creditsOf({ credits: '3 credit hours' })).toBe(3);
    expect(creditsOf({ credits: '3 units' })).toBe(3);
    expect(creditsOf({ credits: '3 cr' })).toBe(3);
  });

  /*
   * A catalogue writes "3", "3-4" and "Variable" in one column. A range is not
   * a credit count, and picking an end of it would put a figure nobody chose
   * into a GPA.
   */
  it('refuses a range, a word, and nothing at all', () => {
    expect(creditsOf({ credits: '3-4' })).toBeNull();
    expect(creditsOf({ credits: '3-4 credits' })).toBeNull();
    expect(creditsOf({ credits: 'Variable' })).toBeNull();
    expect(creditsOf({ credits: '' })).toBeNull();
    expect(creditsOf({})).toBeNull();
  });

  /*
   * A unit it does not know is not a unit it should drop: "3 somethings" may
   * not be three credits, and the whole point of refusing a range is not
   * inventing a number.
   */
  it('refuses a number followed by something it does not recognise', () => {
    expect(creditsOf({ credits: '3 bananas' })).toBeNull();
    expect(creditsOf({ credits: '3 credits a week for two terms' })).toBeNull();
  });

  it('refuses nought, which is not a course you can weight', () => {
    expect(creditsOf({ credits: '0' })).toBeNull();
  });
});

describe('the scale it builds on', () => {
  it('takes the bands that say what they are worth', () => {
    expect(pointsIn(COMMON_LETTER).map((b) => b.label)).toContain('A');
    expect(pointsIn(COMMON_LETTER).find((b) => b.label === 'A')?.gpa).toBe(4);
  });

  /*
   * A percentage scale states cutoffs and no points. A row in the table with
   * an empty Points cell is a letter that silently scores nothing, so those
   * are left out — and a scale with none of them cannot build a planner.
   */
  it('leaves out a band with no points, and refuses a scale of nothing but those', () => {
    const percent: GradeSystem = { kind: 'percent', scale: [{ label: 'A', min: 90 }] };
    expect(pointsIn(percent)).toEqual([]);
    expect(canPlan(THREE, percent)).toBe(false);
  });

  it('will not plan with no courses either', () => {
    expect(canPlan([], COMMON_LETTER)).toBe(false);
  });

  it('knows what the top of the scale is worth, for the sentence about reach', () => {
    expect(topOf(COMMON_LETTER)).toBe(4);
    expect(topOf({ kind: 'letter', scale: [{ label: 'A+', gpa: 4.3 }] })).toBe(4.3);
  });

  it('says where the scale came from, differently for each', () => {
    expect(saidScale('school')).toContain('school');
    expect(saidScale('assumed')).toContain('assumed');
    expect(saidScale('course')).toContain('course');
  });
});

describe('what it writes down about this term', () => {
  const { sheet } = gpaSheet(THREE, COMMON_LETTER, 'assumed');
  const cells = sheet.cells;

  it('lists every course', () => {
    for (const c of THREE) expect(rowSaying(cells, c.code)).toBeGreaterThan(0);
  });

  /*
   * The promise `gradesheet.ts` makes too: a grade in this app is something
   * the student typed, and a grade on a planner is something they then read as
   * fact.
   */
  it('writes no grade in', () => {
    for (const c of THREE) expect(cells[`C${rowSaying(cells, c.code)}`]).toBeUndefined();
  });

  it('leaves a course whose credits it cannot read listed, with the cell blank', () => {
    const odd = gpaSheet([course('ART 1000', 'Variable')], COMMON_LETTER, 'assumed');
    const at = rowSaying(odd.sheet.cells, 'ART 1000');
    expect(odd.sheet.cells[`B${at}`]).toBeUndefined();
    expect(odd.unreadable).toEqual(['ART 1000']);
    expect(odd.counted).toBe(0);
  });
});

describe('the arithmetic, run through the app’s own engine', () => {
  /** A filled-in planner: A, B+ and A− over 3, 3 and 4 credits. */
  function filled(behind: { credits: number; gpa: number } | null = null): Cells {
    const { sheet } = gpaSheet(THREE, COMMON_LETTER, 'assumed', behind);
    const cells = { ...sheet.cells };
    grade(cells, 'ECON 1020', 'A');
    grade(cells, 'PSCI 1100', 'B+');
    grade(cells, 'BUS 1600', 'A−');
    return cells;
  }

  it('looks each letter up and scores it', () => {
    const cells = filled();
    expect(read(cells, `D${rowSaying(cells, 'ECON 1020')}`)).toBe('4');
    expect(read(cells, `D${rowSaying(cells, 'PSCI 1100')}`)).toBe('3.3');
    expect(read(cells, `D${rowSaying(cells, 'BUS 1600')}`)).toBe('3.7');
  });

  it('adds the credits up', () => {
    const cells = filled();
    expect(read(cells, `B${rowSaying(cells, 'This term')}`)).toBe('10');
  });

  /*
   * 4×3 + 3.3×3 + 3.7×4 = 36.7 over 10 credits. Worked out by hand here on
   * purpose: a test that recomputed it the way the sheet does would agree with
   * the sheet however wrong both were.
   */
  it('works the term GPA out, and it is the figure done by hand', () => {
    const cells = filled();
    expect(read(cells, `E${rowSaying(cells, 'This term')}`)).toBe('36.7');
    expect(read(cells, `B${rowSaying(cells, 'Term GPA so far')}`)).toBe('3.67');
  });

  it('says nothing rather than nought where no grade is in yet', () => {
    const { sheet } = gpaSheet(THREE, COMMON_LETTER, 'assumed');
    expect(read(sheet.cells, `B${rowSaying(sheet.cells, 'Term GPA so far')}`)).toBe('');
  });

  it('leaves a course out of the total until it is graded', () => {
    const { sheet } = gpaSheet(THREE, COMMON_LETTER, 'assumed');
    const cells = { ...sheet.cells };
    grade(cells, 'ECON 1020', 'A');
    // 4 × 3 credits, and nothing from the other two.
    expect(read(cells, `E${rowSaying(cells, 'This term')}`)).toBe('12');
  });

  /*
   * The error this design was corrected for. A GPA is quality points over the
   * credits that *have* a grade, and dividing by the credits taken makes one A
   * in a ten-credit term read 1.2 — a figure that starts at nought and climbs
   * as the term is typed in, on the sheet somebody plans around.
   */
  it('divides by the credits that have a grade, not by the credits taken', () => {
    const { sheet } = gpaSheet(THREE, COMMON_LETTER, 'assumed');
    const cells = { ...sheet.cells };
    grade(cells, 'ECON 1020', 'A');
    expect(read(cells, `B${rowSaying(cells, 'This term')}`)).toBe('10');
    expect(read(cells, `F${rowSaying(cells, 'This term')}`)).toBe('3');
    expect(read(cells, `B${rowSaying(cells, 'Term GPA so far')}`)).toBe('4');
  });

  it('counts down what is still to come', () => {
    const { sheet } = gpaSheet(THREE, COMMON_LETTER, 'assumed');
    const cells = { ...sheet.cells };
    grade(cells, 'ECON 1020', 'A');
    expect(read(cells, `B${rowSaying(cells, 'Credits still to come')}`)).toBe('7');
  });
});

describe('what was already on the transcript', () => {
  /*
   * A first-year student has no record, and every cell below adds this one in.
   * Blank would empty the whole lower half of the sheet for exactly the person
   * whose first term it is — and nought is true.
   */
  it('counts as nought quality points when there is none', () => {
    const { sheet } = gpaSheet(THREE, COMMON_LETTER, 'assumed', null);
    const cells = sheet.cells;
    expect(read(cells, `B${rowSaying(cells, 'Quality points so far')}`)).toBe('0');
  });

  it('carries the credits and the GPA in where there is a record', () => {
    const { sheet } = gpaSheet(THREE, COMMON_LETTER, 'assumed', { credits: 30, gpa: 3.5 });
    const cells = sheet.cells;
    expect(cells[`B${rowSaying(cells, 'Credits so far')}`]).toBe('30');
    expect(read(cells, `B${rowSaying(cells, 'Quality points so far')}`)).toBe('105');
  });

  it('folds the two together once this term is graded', () => {
    const { sheet } = gpaSheet(THREE, COMMON_LETTER, 'assumed', { credits: 30, gpa: 3.5 });
    const cells = { ...sheet.cells };
    grade(cells, 'ECON 1020', 'A');
    grade(cells, 'PSCI 1100', 'B+');
    grade(cells, 'BUS 1600', 'A−');
    expect(read(cells, `B${rowSaying(cells, 'Credits graded in all')}`)).toBe('40');
    // (105 + 36.7) / 40 = 3.5425
    expect(read(cells, `B${rowSaying(cells, 'GPA in all')}`)).toBe('3.5425');
  });

  /*
   * "Where you stand right now" is the GPA a transcript would print today, so
   * a course still being taken is not in it — neither its credits nor its
   * absence of a grade.
   */
  it('counts only what is graded, so an ungraded course does not drag it down', () => {
    const { sheet } = gpaSheet(THREE, COMMON_LETTER, 'assumed', { credits: 30, gpa: 3.5 });
    const cells = { ...sheet.cells };
    grade(cells, 'ECON 1020', 'A');
    expect(read(cells, `B${rowSaying(cells, 'Credits graded in all')}`)).toBe('33');
    // (105 + 12) / 33, to the twelve significant figures `show` keeps.
    expect(read(cells, `B${rowSaying(cells, 'GPA in all')}`)).toBe('3.54545454545');
  });

  it('is the term GPA on its own where there is no record behind it', () => {
    const { sheet } = gpaSheet(THREE, COMMON_LETTER, 'assumed', null);
    const cells = { ...sheet.cells };
    grade(cells, 'ECON 1020', 'A');
    grade(cells, 'PSCI 1100', 'B+');
    grade(cells, 'BUS 1600', 'A−');
    expect(read(cells, `B${rowSaying(cells, 'GPA in all')}`)).toBe('3.67');
  });
});

describe('what would I need', () => {
  const planner = (
    behind: { credits: number; gpa: number } | null,
    target: string,
    graded: [string, string][] = [],
  ): Cells => {
    const { sheet } = gpaSheet(THREE, COMMON_LETTER, 'assumed', behind);
    const cells = { ...sheet.cells };
    for (const [code, letter] of graded) grade(cells, code, letter);
    cells[`B${rowSaying(cells, 'Aiming at, overall')}`] = target;
    return cells;
  };

  it('counts the target over the whole term, ungraded credits included', () => {
    const cells = planner({ credits: 30, gpa: 3.5 }, '3.6');
    expect(read(cells, `B${rowSaying(cells, 'Credits it counts over')}`)).toBe('40');
  });

  /*
   * 30 credits at 3.5 is 105 quality points. A 3.6 over 40 credits is 144. So
   * this term's 10 credits must earn 39, which is 3.9. Done by hand, because a
   * test that recomputed it the way the sheet does would agree with the sheet
   * however wrong both were.
   */
  it('works out what the rest of the term has to average', () => {
    const cells = planner({ credits: 30, gpa: 3.5 }, '3.6');
    expect(read(cells, `B${rowSaying(cells, 'GPA needed on what is left')}`)).toBe('3.9');
  });

  /*
   * The half that a simpler formula gets wrong. With ECON already banked at
   * 4.0 over 3 credits, 144 − 105 − 12 = 27 quality points are left to earn
   * over the remaining 7 credits, which is 3.857… — not the 3.9 the whole term
   * needed before any of it was graded.
   */
  it('takes account of what this term has already earned', () => {
    const cells = planner({ credits: 30, gpa: 3.5 }, '3.6', [['ECON 1020', 'A']]);
    expect(read(cells, `B${rowSaying(cells, 'GPA needed on what is left')}`)).toBe('3.85714285714');
  });

  it('says so when that is above what the scale can give', () => {
    const cells = planner({ credits: 30, gpa: 2.0 }, '3.9');
    expect(read(cells, `B${rowSaying(cells, 'Is that possible?')}`)).toContain('above 4');
  });

  /*
   * The case worth having. A student well above their target does not need a
   * number, they need to be told they can stop worrying about it.
   */
  it('says a target already reached is already reached', () => {
    const cells = planner({ credits: 30, gpa: 3.9 }, '2.0');
    expect(read(cells, `B${rowSaying(cells, 'Is that possible?')}`)).toContain('Already there');
  });

  it('and otherwise says the figure is the one to aim at', () => {
    const cells = planner({ credits: 30, gpa: 3.5 }, '3.6');
    expect(read(cells, `B${rowSaying(cells, 'Is that possible?')}`)).toContain('aim at');
  });

  it('says nothing at all until a target is typed', () => {
    const { sheet } = gpaSheet(THREE, COMMON_LETTER, 'assumed', { credits: 30, gpa: 3.5 });
    expect(read(sheet.cells, `B${rowSaying(sheet.cells, 'GPA needed on what is left')}`)).toBe('');
    expect(read(sheet.cells, `B${rowSaying(sheet.cells, 'Is that possible?')}`)).toBe('');
  });

  /*
   * A term with every course graded has nothing left to ask about. Dividing by
   * the nought credits remaining would be `#DIV/0!` on the row somebody reads
   * for reassurance.
   */
  it('gives no figure once the whole term is graded, rather than dividing by none', () => {
    const cells = planner({ credits: 30, gpa: 3.5 }, '3.6', [
      ['ECON 1020', 'A'],
      ['PSCI 1100', 'B+'],
      ['BUS 1600', 'A−'],
    ]);
    expect(read(cells, `B${rowSaying(cells, 'GPA needed on what is left')}`)).toBe('');
  });

  /*
   * And says why. Going blank on both rows answers a question with silence, on
   * the line somebody read for reassurance — so the one that can still speak
   * points at the figure that is the answer.
   */
  it('says why, and where to look instead', () => {
    const cells = planner({ credits: 30, gpa: 3.5 }, '3.6', [
      ['ECON 1020', 'A'],
      ['PSCI 1100', 'B+'],
      ['BUS 1600', 'A−'],
    ]);
    expect(read(cells, `B${rowSaying(cells, 'Is that possible?')}`)).toContain('GPA in all');
  });
});

/**
 * The scale is a block in the sheet, and every Points cell reads it. A student
 * whose school counts A+ as 4.3 edits one cell and the whole sheet follows —
 * which is only true if the lookups really do point at it.
 */
describe('the scale block', () => {
  it('is written out, letter by letter', () => {
    const { sheet } = gpaSheet(THREE, COMMON_LETTER, 'assumed');
    const at = rowSaying(sheet.cells, 'Grade');
    expect(sheet.cells[`B${at}`]).toBe('Points');
    expect(sheet.cells[`A${at + 1}`]).toBe('A');
    expect(sheet.cells[`B${at + 1}`]).toBe('4');
  });

  it('is what the sheet actually reads, so editing it moves everything', () => {
    const { sheet } = gpaSheet(THREE, COMMON_LETTER, 'assumed');
    const cells = { ...sheet.cells };
    grade(cells, 'ECON 1020', 'A');
    expect(read(cells, `B${rowSaying(cells, 'Term GPA so far')}`)).toBe('4');
    // An A is worth 3 at this imaginary school.
    cells[`B${rowSaying(cells, 'Grade') + 1}`] = '3';
    expect(read(cells, `B${rowSaying(cells, 'Term GPA so far')}`)).toBe('3');
  });

  /*
   * This engine's VLOOKUP is exact when the fourth argument is left off;
   * Excel's is approximate, over a table this sheet does not sort. The sheet
   * that worked here would answer with the wrong letter's points once
   * exported, so the argument is written out.
   */
  it('looks up exactly, said out loud for Excel’s sake', () => {
    const { sheet } = gpaSheet(THREE, COMMON_LETTER, 'assumed');
    const at = rowSaying(sheet.cells, 'ECON 1020');
    expect(sheet.cells[`D${at}`]).toContain(',2,FALSE)');
  });

  it('gives a letter that is not on the scale no points, rather than the nearest', () => {
    const { sheet } = gpaSheet(THREE, COMMON_LETTER, 'assumed');
    const cells = { ...sheet.cells };
    grade(cells, 'ECON 1020', 'W');
    expect(read(cells, `D${rowSaying(cells, 'ECON 1020')}`)).toBe('');
    expect(read(cells, `E${rowSaying(cells, 'ECON 1020')}`)).toBe('');
  });
});

describe('reading the transcript into the two numbers it starts from', () => {
  const taken = (over: Partial<Taken>): Taken => ({
    id: 'x', code: 'X', title: 'X', term: 'Fall', hours: 3, grade: 'A', current: false, ...over,
  });

  it('counts what is finished', () => {
    const got = behindOf([taken({ grade: 'A', hours: 3 }), taken({ grade: 'B', hours: 3 })], COMMON_SCALE);
    expect(got).toEqual({ credits: 6, gpa: 3.5 });
  });

  it('answers with nothing for a first term, which is not a fault', () => {
    expect(behindOf([], COMMON_SCALE)).toBeNull();
    expect(behindOf([taken({ current: true })], COMMON_SCALE)).toBeNull();
  });

  it('leaves out a grade the scale cannot score, rather than calling it nought', () => {
    const got = behindOf([taken({ grade: 'A', hours: 3 }), taken({ grade: 'W', hours: 3 })], COMMON_SCALE);
    expect(got).toEqual({ credits: 3, gpa: 4 });
  });
});
