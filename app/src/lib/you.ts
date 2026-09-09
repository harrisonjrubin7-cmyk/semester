/**
 * Where you stand — counted, not felt.
 *
 * The Progress screen's first tab used to be three facts and a chart: four
 * numbers across the top, a bar per course, and the medians from `pace.ts`.
 * Every one of them was true and none of them answered the question somebody
 * opens that tab to ask, which is *am I keeping up*. Four courses and eleven
 * credits is the shape of the semester, not a report on it, and it reads the
 * same in week one as in week fourteen.
 *
 * What follows is the arithmetic behind an answer. It is deliberately small
 * and deliberately here rather than in the screen, for the reason the rest of
 * this codebase gives: a number rendered inline is a number nothing can test
 * and nothing else can quote, and the app has already been bitten by two
 * screens disagreeing about one fact.
 *
 * ## Three rules it keeps
 *
 * **Only this term's deadlines count.** `state.done` is keyed by item id and
 * survives the course it belonged to — removing a course leaves its ticks
 * behind, by design, so re-importing the syllabus finds them again. Counting
 * the map's own length therefore produced a "Done" that could exceed the
 * number of deadlines in the app, and did, for anybody who had ever removed a
 * course. Everything here is counted against the catalogue in front of you.
 *
 * **Nothing is a score.** There is no streak, no percentage of you, and no
 * comparison with anybody. Late is late because a missed deadline is worth
 * naming, not to shame anyone with a red number.
 *
 * **A figure that rests on nothing is not shown.** `through` is null until the
 * deadlines describe a span, and the caller drops the row rather than drawing
 * an empty bar at zero.
 */

import { split, type DoneMap } from './standing';
import type { DatedItem } from './types';

/**
 * How far through the term the deadlines say we are, 0–1, or null.
 *
 * The app has no term start and end — the one place a term's shape is written
 * down is the spread of its own deadlines. First to last is a proxy and is
 * named as one wherever it is shown ("of the term's deadlines"), rather than
 * claimed as a calendar.
 *
 * Lived in `softtop.ts` as a private function, which meant the soft shell's
 * header and this screen would have been two answers to one question the
 * moment either was touched.
 */
export function termProgress(items: DatedItem[], now: Date): number | null {
  const times = items.map((i) => i.date.getTime()).filter((t) => !Number.isNaN(t));
  if (times.length < 2) return null;
  const first = Math.min(...times);
  const last = Math.max(...times);
  if (last <= first) return null;
  return Math.max(0, Math.min(1, (now.getTime() - first) / (last - first)));
}

/** The next seven days, as a fraction you can act on. */
export interface Week {
  /** Deadlines dated inside the window, ticked or not. */
  due: number;
  /** How many of those are already ticked. */
  done: number;
}

/**
 * What the coming week is actually carrying.
 *
 * Today counts. A deadline due at 11:59 tonight is this week's work however
 * many hours are left of it, and dropping it because its date has technically
 * arrived is how a planner tells you a quiet week before the evening you lose.
 */
export function weekAhead(items: DatedItem[], done: DoneMap, days = 7): Week {
  const inside = items.filter((i) => i.daysAway >= 0 && i.daysAway < days);
  return {
    due: inside.length,
    done: inside.filter((i) => done[i.id]).length,
  };
}

/** Everything the headline says, in one object so nothing is computed twice. */
export interface Where {
  courses: number;
  /** Summed from the syllabi that state credits. Zero means none of them did. */
  credits: number;
  /** Still to come and not ticked. The number that means "left to do". */
  ahead: number;
  /** Ticked, whenever it was due — this term's, not every tick ever made. */
  done: number;
  /** Past its date and still not ticked. */
  late: number;
  /** Every deadline in the catalogue. */
  total: number;
  /** 0–1 through the term's own span, or null when it has no span yet. */
  through: number | null;
  week: Week;
}

export function whereYouStand(input: {
  courses: { credits?: string }[];
  items: DatedItem[];
  done: DoneMap;
  now: Date;
}): Where {
  const { courses, items, done, now } = input;
  const parts = split(items, done);
  // Ahead-and-ticked is neither ahead nor late: it is done early, and the
  // person who did it should see it in the column that says so.
  const ahead = parts.ahead.filter((i) => !done[i.id]).length;
  return {
    courses: courses.length,
    credits: courses.reduce((sum, c) => sum + (parseFloat(c.credits ?? '') || 0), 0),
    ahead,
    done: parts.done.length,
    late: parts.overdue.length,
    total: items.length,
    through: termProgress(items, now),
    week: weekAhead(items, done),
  };
}

/**
 * "Three of seven done" — or the honest sentence when there is nothing due.
 *
 * Here rather than in the screen because it is the one line most likely to be
 * copied into a brief or a notification, and a second copy would drift.
 */
export function weekLine(week: Week): string {
  if (week.due === 0) return 'Nothing falls in the next seven days.';
  if (week.done === week.due)
    return week.due === 1 ? 'The one thing due this week is done.' : `All ${week.due} done.`;
  return `${week.done} of ${week.due} done.`;
}
