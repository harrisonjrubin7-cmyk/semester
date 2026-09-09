/**
 * What the calendar's second axis actually selects.
 *
 * The screen has two axes and says so at the top of `screens/Calendar.tsx`:
 * the **view** is the grain, the **source** is what is on it, and keeping them
 * independent is what makes "just my classes, for the whole semester" and
 * "every single thing happening today" both one tap away.
 *
 * The source axis worked in two of the four views.
 *
 *  - **Day** read it, and its four buckets are the ones written down here.
 *  - **Month** read it too, from its own copy of the same three conditions.
 *  - **Week** did not read it at all. Choosing "Due" left every class on the
 *    grid; choosing "Campus" left the grid unchanged and showed no campus
 *    event, because none is drawn there. The chips moved and nothing did.
 *  - **Semester** read it for deadlines and campus and had no branch for
 *    classes, so the exact combination the file's own comment advertises —
 *    classes, whole semester — produced "Nothing from this source across the
 *    whole semester", about a term with four courses meeting all week.
 *
 * Two views agreeing by having each written the conditions out is how the
 * third and fourth came to disagree. So the rule is one thing, here, and each
 * view asks it.
 *
 * ## The three buckets, and why a thing is in the one it is in
 *
 * Taken from what Day already did, because that view was right and the point
 * is to stop the four disagreeing rather than to re-litigate them:
 *
 *  - **classes** — the timetable: what a syllabus says meets, plus the
 *    appointments and standing commitments you added. Yours are here rather
 *    than under deadlines because they are hours in a day, not work to hand in.
 *  - **deadlines** — what is due: the syllabus's dated obligations and your own
 *    tasks.
 *  - **campus** — what is on: the campus calendar and anything a connected
 *    calendar feed says.
 */

export type CalSource = 'all' | 'classes' | 'deadlines' | 'campus';

export interface Shows {
  /** Classes from the syllabi, your appointments, your standing commitments. */
  classes: boolean;
  /** Syllabus deadlines and your own tasks. */
  deadlines: boolean;
  /** Campus events and connected calendar feeds. */
  campus: boolean;
}

export function shows(source: CalSource): Shows {
  return {
    classes: source === 'all' || source === 'classes',
    deadlines: source === 'all' || source === 'deadlines',
    campus: source === 'all' || source === 'campus',
  };
}

/**
 * What the current source is called, in a sentence.
 *
 * For the empty states, which used to say "this source" — a phrase that
 * describes the control rather than the thing, and leaves somebody who has
 * forgotten which chip is lit no better off.
 */
export function sourceName(source: CalSource): string {
  return source === 'all'
    ? 'anything'
    : source === 'classes'
      ? 'classes or anything you have added to a day'
      : source === 'deadlines'
        ? 'deadlines or your own tasks'
        : 'campus events';
}

/**
 * Whether a block an hour grid drew belongs under this source.
 *
 * The grids build their blocks from the catalogue and from what you have
 * added, and the two arrive mixed: `from` says which record a block can be
 * moved by, and it is also the only thing that says what a block *is*. A block
 * with no record behind it came from a syllabus's meeting pattern or from a
 * standing commitment — the timetable either way, which is the classes bucket.
 *
 * Here rather than in the view because the week grid and the day rail have to
 * agree, and the way they came to disagree in the first place was each having
 * its own copy of the question.
 */
export function keepBlock(from: { kind: 'appointment' | 'item' } | undefined, on: Shows): boolean {
  if (!from) return on.classes;
  return from.kind === 'item' ? on.deadlines : on.classes;
}
