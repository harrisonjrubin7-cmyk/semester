/**
 * A study plan that can be missed.
 *
 * `lib/revise.ts` ranks every unit and `planFor` fills the minutes somebody
 * says they have tonight. Both are computed fresh on every render, which makes
 * them honest and makes them incapable of one thing: **nothing in this app can
 * be missed.** A plan that exists only while the screen is open cannot be
 * behind, so the evening somebody does not study leaves no trace, and the next
 * evening's plan is the same four units with the same reasons — as though the
 * skipped night had not happened.
 *
 * That is the gap this closes. A plan committed to days is a plan with a
 * yesterday, and a yesterday is what makes "you missed two sittings, here is
 * where they go" a sentence the app can say.
 *
 * ## The hard part is not moving them
 *
 * Moving a missed sitting to tomorrow is four lines. The reason study
 * schedulers are abandoned is what happens on the *fourth* missed night: three
 * sittings land on Thursday, Thursday now says four hours, and a plan that
 * says four hours on a Thursday is a plan that gets deleted. Every backlog
 * feature fails the same way — it conserves work that a person has already
 * decided not to do, and presents the total as an obligation.
 *
 * So rescheduling here has a ceiling and it is allowed to give up. `moveOn`
 * fills the days ahead up to `dayMinutes` and no further, and returns what
 * would not fit as `dropped` rather than stacking it. The screen says so:
 * *two of these will not fit before Thursday.* That sentence is the feature.
 * An app that quietly doubles tomorrow is lying about the same thing the
 * mastery percentage was lying about — it is reporting a plan nobody made.
 *
 * ## Days are ISO strings, not timestamps
 *
 * `on` is `YYYY-MM-DD` in the student's own local time, from `dateToIso`. A
 * session is a thing that happens on a day, not at an instant: stored as a
 * timestamp it moves across midnight when somebody flies to Nashville from
 * London, and "yesterday's sitting" becomes today's. `lib/date.ts` made the
 * same choice for the calendar's day key and for the same reason.
 */

import { dateToIso, shiftIso } from './date';
import { A_SITTING } from './review';
import { SECONDS_PER_CARD, type Stretch } from './revise';

/** One sitting: a unit, a length, and the day it is meant to happen on. */
export interface Session {
  /** Stable across a move, so a moved sitting is the same sitting. */
  id: string;
  courseId: string;
  /** Index into the live guide's units — what `startDrill` takes. */
  index: number;
  /**
   * The unit's name and the course's code, copied rather than looked up.
   *
   * A guide is re-merged from its module plus whatever the student has added,
   * so a unit's index is stable and its name is not guaranteed to be. Copying
   * means a plan drawn after an import still reads as words rather than as
   * "Unit 7", and a unit that has genuinely gone leaves a row that says what
   * it was instead of a blank.
   */
  name: string;
  code: string;
  minutes: number;
  /** The day it is planned for, `YYYY-MM-DD`, local. */
  on: string;
  /**
   * How many cards the sitting was sized for — its planned questions.
   *
   * Carried rather than re-derived from `minutes`, for the reason
   * `lib/revise.ts` carries `cardsToDo`: minutes are rounded, and a sitting
   * that says "nine minutes" and then wants forty cards answered before it
   * will call itself finished is lying about one of the two numbers.
   *
   * It is what `doneAt` is measured against. Absent on a sitting laid down
   * before this field existed, and those are left alone — see `progressOf`.
   */
  cards?: number;
  /**
   * When it was opened, epoch ms. Absent until somebody starts it.
   *
   * Separate from `doneAt` because they are separate facts, and the app spent
   * a release with only the second one: opening a sitting stamped it finished,
   * so a row you tapped and backed out of counted as an evening's study. See
   * `progressOf`.
   */
  startedAt?: number;
  /** Cards actually answered in it. The real work, counted as it happens. */
  answered?: number;
  /** When it was finished, epoch ms. Absent while it is still outstanding. */
  doneAt?: number;
  /**
   * How many times this sitting has already been moved.
   *
   * Kept because it is the only number that says a plan is not working. A
   * sitting moved four times is not a scheduling problem, and the screen that
   * shows it should be able to stop pretending otherwise.
   */
  moved?: number;
}

/** How long a sitting may be. Longer than this is two sittings. */
export const LONGEST = 45;

/** The default ceiling for one day's study, in minutes. */
export const DAY_MINUTES = 90;

/** How far ahead a plan is laid down. A fortnight of evenings is a term's worth of intent. */
export const HORIZON_DAYS = 14;

/**
 * The four things a sitting can be, which used to be two.
 *
 * `planned` and `done` were the whole vocabulary, and the screen moved a
 * sitting from one to the other the moment its row was tapped — so the plan's
 * only measurement was *did you open this*, which is not studying. The two in
 * the middle are the ones that make the other two mean anything: `started` is
 * a sitting opened and not worked, and `partly` is one with real answers in it
 * and more to go.
 *
 * Read off the record rather than stored, so there is one definition of each
 * and no state to fall out of step with the counts it is drawn from.
 */
export type Progress = 'planned' | 'started' | 'partly' | 'done';

/** What a sitting is, from what has actually happened in it. */
export function progressOf(s: Session): Progress {
  if (s.doneAt) return 'done';
  if ((s.answered ?? 0) > 0) return 'partly';
  if (s.startedAt) return 'started';
  return 'planned';
}

/**
 * Whether answering one more card finishes the sitting.
 *
 * The rule is the planned questions and nothing else: a sitting sized for
 * twelve cards is finished by the twelfth answer. A sitting with no `cards` on
 * it — laid down before the field existed — can never be finished this way,
 * and that is deliberate. Stamping those done from a count they were never
 * sized against would be inventing a history, which is the thing this whole
 * change is about not doing; they finish when their deck runs out instead.
 */
export function finishes(s: Session, answered: number): boolean {
  return s.cards !== undefined && s.cards > 0 && answered >= s.cards;
}

/** Minutes already planned for a day, finished sittings included. */
export function minutesOn(sessions: Session[], day: string): number {
  return sessions.filter((s) => s.on === day).reduce((n, s) => n + s.minutes, 0);
}

/**
 * The sittings that were meant to have happened and did not.
 *
 * Strictly before today. A sitting planned for *today* is not missed — the
 * evening is not over, and an app that calls it missed at nine in the morning
 * has told its first lie before breakfast.
 */
export function missed(sessions: Session[], today: string): Session[] {
  return sessions.filter((s) => !s.doneAt && s.on < today);
}

/** The sittings planned for one day and not yet done. */
export function onDay(sessions: Session[], day: string): Session[] {
  return sessions.filter((s) => s.on === day && !s.doneAt);
}

/** Every day a plan touches, in order, from today forward. */
export function daysOf(sessions: Session[], from: string): string[] {
  const days = [...new Set(sessions.filter((s) => s.on >= from).map((s) => s.on))];
  return days.sort();
}

/**
 * Take the ranking round by round, one unit per course per round.
 *
 * `planFor` does this for a single evening and the argument is the same over a
 * fortnight: an evening spent entirely inside one course is a course-shaped
 * evening, and ranking across the whole catalogue is pointless if the filling
 * then undoes it. Measured before this existed — a fresh install's first plan
 * put eight consecutive PSCI sittings on tonight and nothing else, because the
 * ranking is a sort and a sort groups.
 *
 * Not shared with `planFor`, which interleaves *and* fills a budget *and*
 * trims the last stretch to the minutes left. Pulling the rounds out of it
 * would leave that function holding two of its three jobs and reading worse;
 * this is eight lines and says what it is.
 */
function roundRobin(ranked: Stretch[]): Stretch[] {
  const rest = [...ranked];
  const out: Stretch[] = [];
  while (rest.length > 0) {
    const served = new Set<string>();
    for (let i = 0; i < rest.length; ) {
      if (served.has(rest[i].courseId)) {
        i += 1;
        continue;
      }
      served.add(rest[i].courseId);
      out.push(rest[i]);
      rest.splice(i, 1);
    }
  }
  return out;
}

/**
 * Lay a ranked list of units across the days ahead.
 *
 * Round by round across courses — see `roundRobin` — so an evening holds four
 * courses rather than one course four times. The ordering *within* a course is
 * still the ranking's.
 *
 * A stretch longer than `LONGEST` is not split. Splitting a unit produces two
 * sittings that are each half a thing, and the half that is left is the half
 * nobody does; the ceiling on the *day* is what keeps an evening honest.
 */
export function layOut(
  ranked: Stretch[],
  opts: { from: string; days?: number; dayMinutes?: number; existing?: Session[] },
): Session[] {
  const days = opts.days ?? HORIZON_DAYS;
  const ceiling = opts.dayMinutes ?? DAY_MINUTES;
  const planned: Session[] = [...(opts.existing ?? [])];
  const made: Session[] = [];

  let day = 0;
  for (const [n, stretch] of roundRobin(ranked).entries()) {
    const minutes = Math.min(stretch.minutes, LONGEST);
    // Find the first day from `day` forward with room. Walking forward rather
    // than restarting at zero keeps the ranking's order across days: the best
    // unit is on the first evening, not scattered wherever it happened to fit.
    let placed = false;
    for (let step = day; step < days; step += 1) {
      const on = shiftIso(opts.from, step);
      if (minutesOn(planned, on) + minutes > ceiling) continue;
      const session: Session = {
        id: `${stretch.courseId}-${stretch.index}-${on}-${n}`,
        courseId: stretch.courseId,
        index: stretch.index,
        name: stretch.name,
        code: stretch.code,
        minutes,
        // Sized from the minutes this sitting actually got, not from the
        // stretch's own count: `minutes` is trimmed to `LONGEST` above, and a
        // sitting cut to forty-five minutes that still asks for the full
        // ninety minutes of cards is a sitting nobody can finish. Never more
        // than the stretch has, and never more than one run will hand over —
        // `A_SITTING` caps a deck at twenty-five, so a target above it could
        // only be reached by going again, and a sitting you cannot finish in
        // the run it opens is the old bug with the sign flipped.
        cards: Math.max(
          1,
          Math.min(stretch.cardsToDo, Math.round((minutes * 60) / SECONDS_PER_CARD), A_SITTING),
        ),
        on,
      };
      planned.push(session);
      made.push(session);
      day = step;
      placed = true;
      break;
    }
    // Nothing fits anywhere in the horizon: the plan is full, and a plan that
    // is full is finished. Carrying on would only ever find the same answer.
    if (!placed) break;
  }
  return made;
}

/** What a reschedule did, so the screen can say it rather than imply it. */
export interface Moved {
  /** The sittings as they now stand — moved ones with a new `on` and a bumped `moved`. */
  sessions: Session[];
  /** How many were moved. */
  count: number;
  /** The ones there was no room for, which are **removed** rather than stacked. */
  dropped: Session[];
}

/**
 * Every missed sitting moved forward, in one action, with a ceiling.
 *
 * The one action is the requirement and the ceiling is the honesty. Missed
 * sittings are placed on the first day from today with room under
 * `dayMinutes`, oldest first — oldest because the oldest is the one furthest
 * from the material, not because it is owed.
 *
 * What will not fit inside the horizon is **dropped**, and dropped means
 * removed from the plan. That is deliberate and it is the whole argument of
 * this module: a backlog that is conserved is a backlog that grows, and the
 * work is not lost in any sense that matters — the cards are still there, the
 * unit is still ranked, and tomorrow's plan will pick it up if it is still the
 * most valuable thing to do. What is thrown away is the *obligation*, which is
 * the part that was never real.
 *
 * Returns the whole list rather than a patch, so the caller cannot apply half
 * of it.
 */
export function moveOn(
  sessions: Session[],
  opts: { today: string; days?: number; dayMinutes?: number },
): Moved {
  const days = opts.days ?? HORIZON_DAYS;
  const ceiling = opts.dayMinutes ?? DAY_MINUTES;
  const late = missed(sessions, opts.today).sort((a, b) => a.on.localeCompare(b.on));
  if (late.length === 0) return { sessions, count: 0, dropped: [] };

  const lateIds = new Set(late.map((s) => s.id));
  // Everything that is not late, kept exactly as it is. A reschedule must not
  // move a sitting somebody has not missed — that is a different feature and
  // it is the one that makes people stop trusting the plan.
  const kept = sessions.filter((s) => !lateIds.has(s.id));
  const dropped: Session[] = [];
  const moved: Session[] = [];

  for (const session of late) {
    let placed = false;
    for (let step = 0; step < days; step += 1) {
      const on = shiftIso(opts.today, step);
      if (minutesOn([...kept, ...moved], on) + session.minutes > ceiling) continue;
      moved.push({ ...session, on, moved: (session.moved ?? 0) + 1 });
      placed = true;
      break;
    }
    if (!placed) dropped.push(session);
  }

  return {
    sessions: [...kept, ...moved].sort((a, b) => a.on.localeCompare(b.on)),
    count: moved.length,
    dropped,
  };
}

/**
 * What the button should say before it is pressed.
 *
 * Written from the same `moveOn` the button calls, rather than from a second
 * count taken another way. Two instruments measuring one thing is how this
 * repository has produced most of its wrong numbers, and a preview that
 * disagrees with the action is worse than no preview: it is a promise.
 */
export function willMove(sessions: Session[], opts: { today: string; days?: number; dayMinutes?: number }): string {
  const { count, dropped } = moveOn(sessions, opts);
  if (count === 0 && dropped.length === 0) return 'Nothing has been missed.';
  const one = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  if (dropped.length === 0) return `Move ${one(count, 'sitting')} to the next evening with room.`;
  if (count === 0) return `${one(dropped.length, 'sitting')} will not fit — they come off the plan.`;
  return `Move ${one(count, 'sitting')}. ${one(dropped.length, 'sitting')} will not fit and come off the plan.`;
}

/**
 * Drop everything that has gone by, done or not.
 *
 * The other half of not conserving a backlog: a plan a fortnight old is not a
 * plan, and leaving finished sittings in the list forever turns a week's view
 * into a filing cabinet. Called when a plan is laid down again.
 */
export function onlyFrom(sessions: Session[], day: string): Session[] {
  return sessions.filter((s) => s.on >= day);
}

/** Today, as the key a session is stored under. */
export function today(now: Date): string {
  return dateToIso(now);
}
