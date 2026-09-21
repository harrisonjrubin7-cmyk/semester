/**
 * A grade you have not got yet, tried on.
 *
 * The grades screen answers two questions already: where you stand, and what
 * everything left has to average for an A. Both are true and neither is the
 * question a student actually types into a calculator at midnight, which is
 * the other way round — *if I get an 88 on the final, what does that make my
 * grade?*
 *
 * Canvas calls this What-If, and it is popular enough that whole sites exist
 * only to do it for people whose school has switched it off. The arithmetic is
 * not the hard part. The hard parts are the three ways it lies.
 *
 * ## One: it must not touch the record
 *
 * A supposed score is not a mark. If it were written into `state.grades` it
 * would sync, it would feed the projection on Today, it would count toward the
 * term GPA, and a student who typed 95 into the final to cheer themselves up
 * in October would find the app agreeing with them in December. So supposing
 * is laid *over* the real scores for the length of one calculation and thrown
 * away — {@link laidOver} makes a copy, and nothing here writes anything.
 *
 * ## Two: the same arithmetic, not a second copy of it
 *
 * The number this produces sits on screen beside the real one, so the two have
 * to be computed by the same code or they will eventually disagree by a point
 * and nobody will be able to say which is right. This file does no weighting,
 * no dropping and no absence penalty: it builds a score map and hands it to
 * {@link standing}, which is the one place in the app that knows how a course
 * adds up.
 *
 * ## Three: supposing over a mark you already have
 *
 * Canvas allows it and so does this, because "what if I had done better on the
 * midterm" is a real question. But it is also the way a what-if quietly stops
 * being about the future: a screen showing 91% where the student has a 74% on
 * record, with nothing saying which rows were overwritten, is worse than no
 * feature. {@link swing} counts those rows and hands them back by name so the
 * screen can say so, every time, rather than only when it looks wrong.
 */

import { key, needFor, standing, type Extras, type Standing } from './grades';
import { letterFor, type GradeSystem } from './cutoffs';
import { interpret } from './score';
import type { Course } from './types';

/**
 * Supposed scores, in the same shape and the same keys as the real ones.
 *
 * Deliberately `Record<string, string>` rather than numbers: what the student
 * types is what {@link readScore} reads — a percentage, 17/20, or a letter —
 * and converting at the edge would mean two parsers for one field.
 */
export type Supposed = Record<string, string>;

/**
 * Real scores with the supposed ones laid over them.
 *
 * A blank supposition is not a supposition: an empty string clears the field
 * without erasing a mark that is really there, which is what makes the field
 * safe to empty. Only a non-blank entry displaces anything.
 *
 * ## Read through `interpret`, not through `readScore`
 *
 * The real field settles a letter into a number when focus leaves it — see
 * `components/ScoreField.tsx` — so `standing` has only ever been handed
 * numbers, and `readScore` in `lib/grades.ts` cannot read a letter at all by
 * design: a letter means nothing without a set of cutoffs, and that file has
 * no business knowing which course this is.
 *
 * A supposition has no blur to wait for. Typing B+ and reading the verdict is
 * the entire interaction, and a what-if that went blank until the field was
 * left would look broken to the one student who types letters because their
 * professor gives letters. So the reading happens here, through the same
 * `interpret` the field settles with — the answer is identical, it just does
 * not wait.
 *
 * Anything unreadable is left out rather than passed through. Handing
 * `standing` a string it will silently score as nothing would produce the
 * right number for the wrong reason, and {@link swing} would have no way to
 * tell that apart from an empty field.
 */
export function laidOver(
  real: Record<string, string>,
  supposed: Supposed,
  system: GradeSystem,
): Record<string, string> {
  const out = { ...real };
  for (const [k, v] of Object.entries(supposed)) {
    if (v.trim() === '') continue;
    const pct = interpret(v, system).pct;
    if (pct !== null) out[k] = String(pct);
  }
  return out;
}

export interface Swing {
  /** Where the real marks put you. */
  now: Standing;
  /** Where the supposed ones would. */
  then: Standing;
  /** The running average now, and with the supposition in. Null before anything is graded. */
  from: number | null;
  to: number | null;
  /** Letters for each, or '' where the scale in force cannot say. */
  fromLetter: string;
  toLetter: string;
  /** Rows supposed at all — blank entries are not suppositions. */
  tried: number;
  /** Rows where the supposition writes over a mark already on record, by name. */
  over: string[];
  /** Rows where what was typed could not be read as a score at all, by name. */
  unreadable: string[];
  /** Weight still unaccounted for once the supposition is in. */
  left: number;
}

/**
 * What the supposed scores would do, against what the real ones did.
 *
 * Both standings are returned rather than only the difference, because the
 * screen needs to draw them side by side and a caller that recomputed the
 * real one for itself is the drift this file exists to prevent.
 */
export function swing(
  course: Course,
  real: Record<string, string>,
  supposed: Supposed,
  extras: Extras,
  system: GradeSystem,
): Swing {
  const now = standing(course, real, extras);
  const then = standing(course, laidOver(real, supposed, system), extras);

  const over: string[] = [];
  const unreadable: string[] = [];
  let tried = 0;
  course.grading.forEach((g, i) => {
    const typed = supposed[key(course.id, i)] ?? '';
    if (typed.trim() === '') return;
    tried += 1;
    if (interpret(typed, system).pct === null) unreadable.push(g.what);
    // Against the row as `standing` read it, not against the raw string: a
    // category scored from its individual pieces has a mark on record even
    // though the single box is empty, and supposing over *that* is the case
    // most worth naming.
    else if (now.rows[i]?.score !== null && now.rows[i]?.score !== undefined) over.push(g.what);
  });

  return {
    now,
    then,
    from: now.current,
    to: then.current,
    fromLetter: letterFor(now.current, system),
    toLetter: letterFor(then.current, system),
    tried,
    over,
    unreadable,
    left: then.remaining,
  };
}

/** Nothing typed, nothing to say. Keeps the caller from drawing an empty verdict. */
export function supposing(s: Swing): boolean {
  return s.tried > 0;
}

/**
 * The supposition, in a sentence.
 *
 * States the number it would make and, where there is weight left over, says
 * so in the same breath — because "that would make it 87%" about a course
 * with a third of the grade still unplayed is a sentence somebody will quote
 * back at themselves in December.
 */
export function swingLine(s: Swing): string {
  if (!supposing(s)) return '';
  if (s.to === null) return 'Nothing here can be weighted yet, so there is no number to move.';

  const to = `${Math.round(s.to)}%${s.toLetter ? ` · ${s.toLetter}` : ''}`;
  const settled = s.left <= 0.5;

  if (s.from === null) {
    return settled
      ? `That would finish the course at ${to}.`
      : `That would put you at ${to}, with ${Math.round(s.left)}% still to play for.`;
  }

  const move = s.to - s.from;
  const where = settled ? `finish the course at ${to}` : `put you at ${to}`;
  const rest = settled ? '' : `, with ${Math.round(s.left)}% still to play for`;

  // A rounded point either way is not a move worth announcing; saying "up 0%"
  // is how a figure stops being read.
  if (Math.abs(move) < 0.5) return `That would ${where}${rest} — where you already are.`;
  const dir = move > 0 ? 'up' : 'down';
  return `That would ${where}${rest} — ${dir} ${Math.abs(Math.round(move))} from ${Math.round(s.from)}%.`;
}

/**
 * What the supposition leaves the *rest* needing, for one target.
 *
 * The chained answer, and the one a plain what-if cannot give: having tried
 * 88 on the midterm, the question is no longer "what is my grade" but "what
 * does that leave the final needing". `needFor` against the supposed standing
 * rather than the real one is the whole of it.
 *
 * Null where there is nothing left to play for — the supposition finished the
 * course, and {@link swingLine} has already said the number.
 */
export function thenNeeds(s: Swing, target: number): number | null {
  if (!supposing(s)) return null;
  return needFor(s.then, target);
}

/**
 * The same, said out loud, against a named target.
 *
 * Kept to one sentence and one number. The reach verdicts — settled, hard,
 * unreachable — belong to `reachFor` in `lib/grades.ts` and are already drawn
 * above this on the screen for the *real* standing; repeating that whole
 * ladder for a hypothetical would give a supposition more furniture than the
 * facts have.
 */
export function thenNeedsLine(s: Swing, target: number, label: string): string {
  const need = thenNeeds(s, target);
  if (need === null) return '';
  if (need <= 0) return `${label} would already be yours.`;
  if (need > 100) return `${label} would no longer be reachable.`;
  return `${label} would then need ${Math.round(need)}% on everything left.`;
}

/**
 * How long there is to earn it, where the app knows.
 *
 * The one thing a grade calculator on a website cannot say, and the reason
 * this is worth building here rather than linking out to one: the app holds
 * the exam countdown and the student's own work windows, so a supposition
 * about the final can be answered with how far away the final is.
 *
 * Takes the days and the hours rather than the catalogue, for the reason the
 * rest of `lib/` gives — this file stays free of the course data, and the
 * screen, which already has both, hands them over.
 *
 * Says nothing at all where either is unknown. A sentence about "0 hours" in
 * a student who has never set a work window would be a statement about the
 * settings screen wearing the clothes of a warning about their degree.
 */
export function runwayLine(daysAway: number | null, hoursAWeek: number | null): string {
  if (daysAway === null || !Number.isFinite(daysAway)) return '';
  const when =
    daysAway <= 0 ? 'The next test is today' : daysAway === 1 ? 'The next test is tomorrow' : `The next test is ${Math.round(daysAway)} days away`;
  if (hoursAWeek === null || !(hoursAWeek > 0)) return `${when}.`;
  // Whole hours: the windows are set to the quarter-hour at best, and a
  // decimal here would claim a precision the fortnight does not have.
  const hours = Math.round((daysAway / 7) * hoursAWeek);
  if (hours <= 0) return `${when}.`;
  return `${when} — about ${hours} ${hours === 1 ? 'hour' : 'hours'} of study time between now and then, by your own windows.`;
}
