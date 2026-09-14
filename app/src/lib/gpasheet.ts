/**
 * The GPA planner, built from the courses and the transcript the app holds.
 *
 * `lib/gradesheet.ts` answers *what do I need on the final* for one course.
 * This is the question one level up, and the one asked while choosing whether
 * to drop something: **what is this term going to do to my GPA, and what would
 * I have to get to reach the number I need?**
 *
 * The app has every input already — `lib/termgpa.ts` projects a band from
 * them, `lib/degree.ts` computes the GPA of what is finished, `lib/cutoffs.ts`
 * turns a letter into grade points. What it has never had is a *sheet*: the
 * thing a student edits, tries a different letter in, and hands to an advisor.
 * The screens answer the question as it stands; this answers the ones that
 * begin "but what if".
 *
 * ## The scale is written into the sheet, not hidden in the formulas
 *
 * A GPA depends entirely on what an A is worth, and schools disagree — 4.0 or
 * 4.3, minus grades or not. So the letter table is a visible block at the
 * foot and every `Points` cell is a `VLOOKUP` into it. A student whose school
 * counts A+ as 4.3 edits one cell and the whole sheet follows, and anybody
 * reading it can see what the number was built on.
 *
 * Row 2 says where the scale came from — the school's own, the course's, or
 * an assumption. That is the standing rule for the whole app, and this is one
 * of the two screens whose output is a number a student plans around.
 *
 * ## It writes no grade down
 *
 * The same promise `gradesheet.ts` makes. Every `Grade` cell for this term is
 * blank, including where the app has a mark recorded, because a grade in this
 * app is something the student typed and a grade on a planner is something
 * they then read as fact. What *is* carried in is the finished transcript —
 * credits and GPA so far — because those are recorded rather than guessed, and
 * they sit in two cells the student can correct.
 *
 * ## The arithmetic, and the one line of it worth stating
 *
 * A GPA is quality points over credits, so a target is a claim about the
 * quality points the whole record must reach:
 *
 *     needed term GPA = (target × all credits − quality points so far) ÷ this term's credits
 *
 * which is written into the sheet as exactly that, in cells, out of parts each
 * of which is on the screen beside it. Nothing here is computed in TypeScript
 * and written in as a number: a planner whose answer cannot be clicked on and
 * read is an oracle, and this file would rather be a tool.
 */

import { blankSheet, colName, type CellStyle, type Sheet } from './sheet';
import { COMMON_LETTER, type GradeSystem, type Source } from './cutoffs';
import type { Course } from './types';
import { gpa as gpaOf, type Scale, type Taken } from './degree';

/** Where the fixed parts sit, one-based as the grid shows them. */
const HEAD = 4;

const BOLD: CellStyle = { bold: true };
const NUMBER: CellStyle = { num: 'plain', decimals: 2 };

export interface Planned {
  sheet: Omit<Sheet, 'id'>;
  /** How many of this term's courses had credits this app could read. */
  counted: number;
  /** Courses whose credits the app holds in a form it would not guess at. */
  unreadable: string[];
}

/** What the transcript already says, as two numbers the planner starts from. */
export interface Behind {
  credits: number;
  gpa: number;
}

/**
 * The finished transcript, as the two numbers this sheet starts from.
 *
 * `lib/degree.ts` already does the counting and already knows which grades a
 * scale cannot score — a withdrawal, a pass/fail, a typo — so this is a
 * reading of its answer rather than a second one. `null` where nothing is
 * finished, which is a first term and not a fault: the planner then starts
 * from nothing, which is true.
 */
export function behindOf(taken: readonly Taken[], scale: Scale): Behind | null {
  const had = gpaOf([...taken], scale);
  return had && had.hours > 0 ? { credits: had.hours, gpa: had.gpa } : null;
}

/**
 * The credits of a course, where that is a number.
 *
 * `Course.credits` is free text, because a catalogue writes "3", "3 credits",
 * "3-4" and "Variable" in the same column — and this app's own courses say
 * **"3 credits"**, which the first version of this function rejected. Every
 * credits cell came out blank for exactly the data the app ships with, and no
 * unit test saw it because they all passed a tidy `"3"`. Found by opening the
 * sheet.
 *
 * So a unit after the number is read and dropped. A *range* is still refused,
 * and so is a word: "3-4" is not a credit count, and picking an end of it
 * would put a figure nobody chose into a GPA. Those come through blank with
 * the course still listed, for the student to type.
 */
export function creditsOf(course: { credits?: string }): number | null {
  const text = (course.credits ?? '').trim();
  if (!text) return null;
  const m = /^(\d+(?:\.\d+)?)\s*(?:credits?|credit\s+hours?|hours?|hrs?|units?|cr\.?)?$/i.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * The letter-to-points table a scale states.
 *
 * Only the bands that say what they are worth. A percentage scale states
 * cutoffs and no points, and a row in the table with an empty Points cell is a
 * letter that silently scores nothing — so those are left out, and a scale
 * with none at all cannot build a planner. See `counted`.
 */
export function pointsIn(system: GradeSystem): { label: string; gpa: number }[] {
  return (system.scale ?? [])
    .filter((b): b is { label: string; min?: number; gpa: number } => typeof b.gpa === 'number')
    .map((b) => ({ label: b.label, gpa: b.gpa }));
}

/** What the highest band is worth, for the sentence that says a target is out of reach. */
export function topOf(system: GradeSystem): number {
  const points = pointsIn(system).map((b) => b.gpa);
  return points.length ? Math.max(...points) : (system.gpaMax ?? 4);
}

/** Whether there is enough to build a planner from. */
export function canPlan(courses: readonly Course[], system: GradeSystem): boolean {
  return courses.length > 0 && pointsIn(system).length > 0;
}

/** The line under the title saying where the numbers came from. */
export function saidScale(source: Source): string {
  if (source === 'course') return 'Grade points are the ones entered for the course.';
  if (source === 'school') return 'Grade points are your school’s own published scale.';
  return 'Grade points are the common American scale, assumed — correct them below and everything follows.';
}

/**
 * The planner.
 *
 * `behind` is the finished transcript as two numbers, passed in rather than
 * read here so this stays a pure function of its arguments — the same shape
 * `gradeSheet` uses for the grade it carries across.
 */
export function gpaSheet(
  courses: readonly Course[],
  system: GradeSystem = COMMON_LETTER,
  source: Source = 'assumed',
  behind: Behind | null = null,
): Planned {
  const cells: Record<string, string> = {};
  const styles: Record<string, CellStyle> = {};
  const put = (col: number, row: number, value: string, look?: CellStyle) => {
    const at = `${colName(col)}${row}`;
    cells[at] = value;
    if (look) styles[at] = look;
  };

  const bands = pointsIn(system);
  const unreadable = courses.filter((c) => creditsOf(c) === null).map((c) => c.code);
  const counted = courses.length - unreadable.length;

  put(0, 1, 'GPA planner', BOLD);
  put(
    0,
    2,
    `${saidScale(source)} No grade below is one your university has given you — ` +
      'this term is yours to fill in.',
  );

  put(0, HEAD, 'Course', BOLD);
  put(1, HEAD, 'Credits', BOLD);
  put(2, HEAD, 'Grade', BOLD);
  put(3, HEAD, 'Points', BOLD);
  put(4, HEAD, 'Quality points', BOLD);
  /*
   * The denominator, as a column somebody can see.
   *
   * A GPA is quality points over credits, and while a term is being filled in
   * those are two different sets of credits: the ones taken, and the ones that
   * have a grade yet. Dividing by the first is what a naive sheet does and it
   * is badly wrong — one A in a ten-credit term reads 1.2 rather than 4.0, a
   * number that starts at nought and climbs as the term is typed in.
   *
   * It could have been hidden inside the Term GPA formula. It is a column
   * instead, because the whole claim this file makes is that the arithmetic
   * can be read rather than trusted, and *which credits this was divided by*
   * is the part of a GPA people actually get wrong.
   */
  put(5, HEAD, 'Credits counted', BOLD);

  /*
   * Every row this sheet uses, worked out once before a cell is written.
   *
   * Because the scale block has to be *placed* before the rows above it can be
   * written — each `Points` cell looks into it — and the first version guessed
   * at how far down it would land. It guessed short by one, so the scale was
   * written over the planning rows: the label `GPA needed on what is left`
   * became `Grade`, and the answer the whole sheet exists to give was gone.
   * Derived rather than guessed, and every offset below is a gap somebody
   * chose rather than a coincidence that happened to fit.
   */
  const first = HEAD + 1;
  const totals = first + courses.length;
  const termGpa = totals + 1;
  const toCome = termGpa + 1;
  const behindAt = toCome + 2;
  const bothAt = behindAt + 5;
  const askAt = bothAt + 4;
  const scaleTop = askAt + 6;
  const scaleFrom = `$A$${scaleTop + 1}`;
  const scaleTo = `$B$${scaleTop + bands.length}`;

  courses.forEach((course, i) => {
    const on = first + i;
    const credits = creditsOf(course);
    put(0, on, course.code);
    if (credits !== null) put(1, on, String(credits));
    /*
     * Exact match, said out loud.
     *
     * This engine's `VLOOKUP` is exact when the fourth argument is left off;
     * Excel's is *approximate*, over a table this one does not sort. So the
     * sheet that works here would quietly answer with the wrong letter's
     * points once exported, which is the whole failure mode this app checks
     * its files for.
     */
    put(3, on, `=IFERROR(VLOOKUP(C${on},${scaleFrom}:${scaleTo},2,FALSE),"")`);
    put(4, on, `=IF(OR(B${on}="",D${on}=""),"",B${on}*D${on})`, NUMBER);
    put(5, on, `=IF(OR(B${on}="",D${on}=""),"",B${on})`);
  });

  const last = first + courses.length - 1;
  put(0, totals, 'This term', BOLD);
  put(1, totals, `=SUM(B${first}:B${last})`, BOLD);
  put(4, totals, `=SUM(E${first}:E${last})`, { ...BOLD, ...NUMBER });
  put(5, totals, `=SUM(F${first}:F${last})`, BOLD);

  put(0, termGpa, 'Term GPA so far', BOLD);
  // Over the credits that have a grade, not the credits taken — see the note
  // on the Credits counted column.
  put(1, termGpa, `=IF(F${totals}=0,"",E${totals}/F${totals})`, { ...BOLD, ...NUMBER });

  put(0, toCome, 'Credits still to come');
  put(1, toCome, `=B${totals}-F${totals}`);

  // ── What is already on the transcript ──────────────────────────────────
  put(0, behindAt, 'Before this term', BOLD);
  put(0, behindAt + 1, 'Credits so far');
  if (behind && behind.credits > 0) put(1, behindAt + 1, String(behind.credits));
  put(0, behindAt + 2, 'GPA so far');
  if (behind && behind.credits > 0) put(1, behindAt + 2, String(behind.gpa));
  put(0, behindAt + 3, 'Quality points so far');
  /*
   * Nought rather than blank where the transcript is empty.
   *
   * A first-year student has no record, and every cell below adds this one in.
   * Blank would make the whole lower half of the sheet empty for exactly the
   * person whose first term it is — and nought is true: no credits have earned
   * no quality points.
   */
  put(
    1,
    behindAt + 3,
    `=IF(OR(B${behindAt + 1}="",B${behindAt + 2}=""),0,B${behindAt + 1}*B${behindAt + 2})`,
    NUMBER,
  );
  const priorCredits = `IF(B${behindAt + 1}="",0,B${behindAt + 1})`;
  const priorQuality = `B${behindAt + 3}`;

  // ── Where it stands right now ──────────────────────────────────────────
  put(0, bothAt, 'Where you stand right now', BOLD);
  put(0, bothAt + 1, 'Credits graded in all');
  // The graded ones again: this is the GPA a transcript would print today, and
  // a course still being taken is not on a transcript.
  put(1, bothAt + 1, `=F${totals}+${priorCredits}`);
  put(0, bothAt + 2, 'GPA in all', BOLD);
  put(
    1,
    bothAt + 2,
    `=IF(B${bothAt + 1}=0,"",(E${totals}+${priorQuality})/B${bothAt + 1})`,
    { ...BOLD, ...NUMBER },
  );

  // ── The question the sheet is for ──────────────────────────────────────
  const top = topOf(system);
  put(0, askAt, 'What would I need?', BOLD);
  put(0, askAt + 1, 'Aiming at, overall');
  put(0, askAt + 2, 'Credits it counts over');
  /*
   * The end of the term, not today: a target is a claim about where the record
   * lands once everything being taken has been graded. So this is every credit
   * behind plus every credit this term, including the ones not yet marked —
   * which is the one place in this sheet the *taken* credits are the right
   * denominator rather than the graded ones.
   */
  put(1, askAt + 2, `=B${totals}+${priorCredits}`);
  put(0, askAt + 3, 'GPA needed on what is left', BOLD);
  /*
   * A target is a claim about quality points: the whole record must reach
   * `target × credits`. Take off what is already banked — the transcript, and
   * whatever this term has already been graded — and what is left is what the
   * remaining credits have to earn.
   *
   * Written out of cells rather than as one long expression, because every
   * part of it is a number somebody may want to argue with, and an answer you
   * cannot take apart is an answer you have to trust.
   */
  put(
    1,
    askAt + 3,
    `=IF(OR(B${askAt + 1}="",B${toCome}=0),"",` +
      `(B${askAt + 1}*B${askAt + 2}-${priorQuality}-E${totals})/B${toCome})`,
    { ...BOLD, ...NUMBER },
  );
  put(0, askAt + 4, 'Is that possible?');
  /*
   * A planner that prints "you need a 4.7" and stops has answered
   * arithmetically and not usefully. Three cases, and the middle one is the
   * one worth having: a target already reached whatever the rest does.
   */
  put(
    1,
    askAt + 4,
    `=IF(B${askAt + 1}="","",` +
      /*
       * A term with every course graded has no number to give — there are no
       * credits left to divide by. Going blank there answers a question with
       * silence, on the row somebody read for reassurance, so it says why and
       * points at the figure that *is* the answer.
       */
      `IF(B${toCome}=0,"Every course this term is graded — “GPA in all” above is where you landed.",` +
      `IF(B${askAt + 3}="","",` +
      `IF(B${askAt + 3}>${top},"No — that is above ${top}, the highest this scale goes.",` +
      `IF(B${askAt + 3}<=0,"Already there, whatever the rest of this term does.",` +
      `"Yes — that is the average to aim at on what is left.")))))`,
  );

  // ── The scale every Points cell reads ──────────────────────────────────
  put(0, scaleTop, 'Grade', BOLD);
  put(1, scaleTop, 'Points', BOLD);
  bands.forEach((band, i) => {
    put(0, scaleTop + 1 + i, band.label);
    put(1, scaleTop + 1 + i, String(band.gpa));
  });
  put(
    0,
    scaleTop + bands.length + 2,
    'Every Points cell above looks a letter up in this table. Change a number here and the whole sheet follows.',
  );

  const rows = scaleTop + bands.length + 3;
  return {
    sheet: {
      ...blankSheet('GPA planner'),
      cells,
      styles,
      rows: Math.max(rows, 24),
      cols: 7,
    },
    counted,
    unreadable,
  };
}
