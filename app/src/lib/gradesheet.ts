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
import { readWeight } from './grades';
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

  const rows = course.grading.map((row) => ({ ...row, ...readWeight(row.pct) }));
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
  put(1, HEAD, 'Weight');
  put(2, HEAD, 'Your score');
  put(3, HEAD, 'Counts for');
  put(4, HEAD, 'The syllabus says');

  let at = HEAD + 1;
  const firstMain = at;
  for (const row of main) {
    put(0, at, row.what);
    // A weight nobody could read stays empty. The syllabus's wording is in
    // column E either way, so the student can type the number in themselves
    // and see what it was read from.
    if (row.weight !== null) put(1, at, `${row.weight}%`);
    put(3, at, `=IF(C${at}="","",C${at}*B${at})`);
    put(4, at, row.pct);
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
      put(0, at, row.what);
      if (row.weight !== null) put(1, at, `${row.weight}%`);
      put(3, at, `=IF(C${at}="","",C${at}*B${at})`);
      put(4, at, row.pct);
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
    `=IF(ROUND(B${at},4)=1,"Adds to 100% — the sums below are exact.",` +
      `"These do not add to 100%, so everything below is indicative.")`,
  );

  at += 1;
  const doneRow = at;
  put(0, at, 'Graded so far');
  // The weight of the components that actually have a score in them. ">=0"
  // rather than "<>" so a blank cell is not counted as a zero-scoring one.
  put(1, at, `=SUMIF(${S},">=0",${W})`);
  put(4, at, 'How much of the course has a score against it.');

  at += 1;
  const earnedRow = at;
  put(0, at, 'Earned so far');
  put(1, at, extraD ? `=SUM(${D})+SUM(${extraD})` : `=SUM(${D})`);
  put(4, at, 'Your scores times their weights.');

  at += 1;
  put(0, at, 'Average so far');
  put(1, at, `=IF(B${doneRow}=0,"",B${earnedRow}/B${doneRow})`);
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
      `(B${targetRow}-B${earnedRow})/B${leftRow}))`,
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

/** Whether a course states enough for the calculator to be worth offering. */
export function canBuild(course: Course): boolean {
  return course.grading.some((row) => !readWeight(row.pct).extra && readWeight(row.pct).weight !== null);
}
