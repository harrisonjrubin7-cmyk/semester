/**
 * A course's own grade calculator, built from its own syllabus.
 *
 * The question this exists to answer is the one every student asks in week
 * eleven and no part of this app could answer: **what do I need on the final?**
 * Until now that sum happened in a spreadsheet somebody built by hand, from
 * weights they re-typed off the syllabus, which is two chances to get it wrong
 * before the arithmetic even starts.
 *
 * So the weights come from the course the app already holds — `Course.grading`,
 * lifted from the syllabus by `lib/parse.ts` and read by `lib/grades.ts` — and
 * the sheet is a real sheet, in the ordinary list, that the student can edit,
 * add rows to, and export as .xlsx like any other.
 *
 * ## What it will not do
 *
 * **It writes no score down.** Every "Your score" cell is blank, including for
 * components the app has a grade recorded against, because a grade in this app
 * is something the student typed and a grade on a calculator sheet is something
 * they would then hand to a scholarship form. The one exception is the current
 * grade the student has already entered on the Courses screen, which is carried
 * across labelled as theirs — see `carry`.
 *
 * **It states where the weights came from**, in the sheet, in cell A2, in the
 * syllabus's own wording. A weight this app could not read comes through as
 * blank with the syllabus's phrasing beside it rather than as a number somebody
 * chose. That is the standing rule for the whole app and it matters most here:
 * this is the one screen whose output is a number a student plans around.
 *
 * ## The arithmetic
 *
 * Everything is a formula in the cell, never a value computed here and written
 * in as text. Two reasons. A student who changes a score sees every total move,
 * which is the entire point of a calculator. And a formula can be checked —
 * clicked on, read, argued with — where a number cannot, which is the
 * difference between a tool and an oracle.
 */

import { blankSheet, colName, type Sheet } from './sheet';
import { asWeights, readWeight } from './grades';
import type { Course } from './types';

/** Where the fixed parts of the sheet sit, one-based as the grid shows them. */
const HEAD = 4;

export interface Built {
  sheet: Omit<Sheet, 'id'>;
  /** How many weighted components were readable — zero means nothing to build. */
  counted: number;
  /** Components whose weight the syllabus states in a way we would not guess at. */
  unreadable: string[];
}

/**
 * The calculator for one course.
 *
 * `carry` is the overall grade the student has already recorded for this course
 * on the Courses screen, if any — passed in rather than read, so this stays a
 * pure function of its arguments and so the caller decides whether carrying it
 * across is wanted.
 */
export function gradeSheet(course: Course, carry: string = ''): Built {
  const cells: Record<string, string> = {};
  const put = (col: number, row: number, value: string) => {
    cells[`${colName(col)}${row}`] = value;
  };

  /*
   * Points, where that is what the syllabus used.
   *
   * "Problem sets — 50 pts" states a weight as plainly as "20%" does; it just
   * states it against a denominator the syllabus expects you to add up
   * yourself. `asWeights` does that adding, and only when *no* row states a
   * percentage — a syllabus mixing the two is talking about two different
   * denominators, and guessing at how they relate would produce a confident
   * wrong number. Without this the calculator was simply never offered to a
   * points-based course, which is a common enough way to write a syllabus.
   */
  const read = course.grading.map((row) => readWeight(row.pct));
  const rows = course.grading.map((row, i) => ({
    ...row,
    ...read[i],
    weight: shareOut(asWeights(read))[i],
  }));
  const main = rows.filter((r) => !r.extra);
  const bonus = rows.filter((r) => r.extra);
  const unreadable = rows.filter((r) => r.weight === null).map((r) => r.what);

  put(0, 1, `${course.code} — what do I need?`);
  put(
    0,
    2,
    'Weights are from the syllabus, in its own words. Scores are yours to fill in — ' +
      'nothing here is a grade your university has given you.',
  );

  put(0, HEAD, 'Component');
  put(1, HEAD, 'Weight (%)');
  put(2, HEAD, 'Your score');
  put(3, HEAD, 'Points earned');
  put(4, HEAD, 'The syllabus says');

  /*
   * One component's row, written the same way whether it is weighted or extra
   * credit — they were two copies until the weights changed from fractions to
   * whole points and only one copy changed with them.
   *
   * A weight nobody could read stays empty. The syllabus's wording is in
   * column E either way, so the student can type the number in themselves and
   * see what it was read from.
   */
  const component = (row: { what: string; pct: string; weight: number | null }, on: number) => {
    put(0, on, row.what);
    if (row.weight !== null) put(1, on, String(row.weight));
    put(3, on, `=IF(C${on}="","",C${on}*B${on}/100)`);
    put(4, on, row.pct);
  };

  let at = HEAD + 1;
  const firstMain = at;
  for (const row of main) {
    component(row, at);
    at += 1;
  }
  const lastMain = at - 1;

  let firstBonus = 0;
  let lastBonus = 0;
  if (bonus.length > 0) {
    at += 1;
    put(0, at, 'Extra credit');
    put(4, at, 'Counted on top, and left out of the total weight below.');
    at += 1;
    firstBonus = at;
    for (const row of bonus) {
      component(row, at);
      at += 1;
    }
    lastBonus = at - 1;
  }

  const W = `B${firstMain}:B${lastMain}`;
  const S = `C${firstMain}:C${lastMain}`;
  const D = `D${firstMain}:D${lastMain}`;
  const extraD = firstBonus ? `D${firstBonus}:D${lastBonus}` : '';

  at += 1;
  const totalRow = at;
  put(0, at, 'Weights add to');
  put(1, at, `=SUM(${W})`);
  put(
    4,
    at,
    `=IF(ROUND(B${at},4)=100,"Adds to 100 — the sums below are exact.",` +
      `"These do not add to 100, so everything below is indicative.")`,
  );

  at += 1;
  const doneRow = at;
  put(0, at, 'Graded so far');
  // The weight of the components that actually have a score in them. ">=0"
  // rather than "<>" so a blank cell is not counted as a zero-scoring one.
  put(1, at, `=SUMIF(${S},">=0",${W})`);
  put(4, at, 'How many of the course’s 100 points have a score against them.');

  at += 1;
  const earnedRow = at;
  put(0, at, 'Earned so far');
  put(1, at, extraD ? `=SUM(${D})+SUM(${extraD})` : `=SUM(${D})`);
  put(4, at, 'Your scores times their weights, out of 100 for the course.');

  at += 1;
  put(0, at, 'Average so far');
  put(1, at, `=IF(B${doneRow}=0,"",B${earnedRow}/B${doneRow}*100)`);
  put(4, at, 'What you are averaging across what has been graded.');

  at += 2;
  const targetRow = at;
  put(0, at, 'If you want');
  put(1, at, '');
  put(4, at, 'Type the course grade you are aiming for, as a number — 90 for an A-.');

  at += 1;
  const leftRow = at;
  put(0, at, 'Still to be graded');
  put(1, at, `=B${totalRow}-B${doneRow}`);
  put(4, at, 'The weight of everything with no score yet.');

  at += 1;
  put(0, at, 'You need to average');
  /*
   * The answer, and the three ways it can have no answer — each said rather
   * than resolved to a number.
   *
   * No target typed is blank, not zero. Nothing left to be graded is "the
   * grade is settled", not a division by zero. And a figure over 100 is left
   * standing rather than capped: a student who needs 112% on the final needs
   * to know that, and a sheet that quietly showed 100 would be telling them
   * the opposite of the truth.
   */
  put(
    1,
    at,
    `=IF(B${targetRow}="","",IF(B${leftRow}<=0,"Nothing left to be graded.",` +
      `(B${targetRow}-B${earnedRow})/B${leftRow}*100))`,
  );
  put(
    4,
    at,
    `=IF(B${at}="","",IF(B${at}>100,"More than full marks — this target is out of reach.",` +
      `IF(B${at}<=0,"Already there, whatever happens.","Across everything not yet graded.")))`,
  );

  if (carry.trim()) {
    at += 2;
    put(0, at, 'Recorded on Courses');
    put(1, at, carry.trim());
    put(4, at, 'The grade you entered yourself. Not counted above.');
  }

  const sheet = blankSheet(`${course.code} — what do I need?`, course.id);
  return {
    sheet: {
      ...sheet,
      cells,
      // Room for the table plus somewhere to work underneath it.
      rows: Math.max(at + 4, sheet.rows),
      cols: Math.max(5, sheet.cols),
    },
    counted: main.filter((r) => r.weight !== null).length,
    unreadable,
  };
}

/**
 * Weights rounded to two places whose total is still exactly what it was.
 *
 * Points divide badly. Three components of one point each are 33.333… per
 * cent, and rounding each on its own gives 33.33 three times — a course that
 * adds up to 99.99, so the sheet calls its own weights "indicative" when they
 * are exact. Seven of them round the other way and reach 100.03, and asking
 * for 100 then needs more than full marks and is reported as out of reach.
 * Both from an error in the third decimal place.
 *
 * So the rounding is shared out rather than done row by row: every weight goes
 * *down* to two places, and the pennies left over go to the rows that lost
 * most in the rounding. Three thirds come out 33.34, 33.33, 33.33 — which add
 * to 100, which is what the syllabus said.
 */
function shareOut(weights: (number | null)[]): (number | null)[] {
  const real = weights.filter((w): w is number => w !== null);
  if (real.length === 0) return weights;

  const target = Math.round(real.reduce((n, w) => n + w, 0) * 100) / 100;
  const down = weights.map((w) => (w === null ? null : Math.floor(w * 100) / 100));
  const short = Math.round(target * 100 - down.reduce((n: number, w) => n + (w ?? 0) * 100, 0));
  if (short <= 0) return down;

  // The rows that lost most to the floor get the pennies back, biggest first.
  const order = weights
    .map((w, i) => ({ i, lost: w === null ? -1 : w * 100 - Math.floor(w * 100) }))
    .filter((row) => row.lost >= 0)
    .sort((a, b) => b.lost - a.lost);
  const out = [...down];
  for (let n = 0; n < short && n < order.length; n += 1) {
    const at = order[n].i;
    out[at] = Math.round(out[at]! * 100 + 1) / 100;
  }
  return out;
}

/**
 * Whether a course states enough for the calculator to be worth offering.
 *
 * Through the same `asWeights` the sheet itself uses, so a course whose
 * syllabus is written in points is offered one — it was not, and the two
 * answers disagreeing would have been worse than either.
 */
export function canBuild(course: Course): boolean {
  const read = course.grading.map((row) => readWeight(row.pct));
  const weights = asWeights(read);
  return read.some((row, i) => !row.extra && weights[i] !== null);
}
