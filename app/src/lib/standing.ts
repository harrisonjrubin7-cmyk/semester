/**
 * Where a deadline stands: ahead of you, missed, or finished.
 *
 * The app had a blind spot shaped exactly like the thing that hurts. Every
 * list ran through `upcomingItems`, which drops anything whose date has gone
 * by — so a paper you did not hand in did not appear as a problem, it simply
 * stopped existing at midnight. The only trace was a number quietly going
 * down. Meanwhile ticking something off did nothing visible to its row: you
 * had to open the deadline to find out whether you had already dealt with it,
 * which is the exact question a list is supposed to answer at a glance.
 *
 * So there are three standings, and every list can say which one it is
 * showing. Done wins over overdue — something handed in late is finished, not
 * still bleeding. And "today" is never overdue, however late in the day it is:
 * deadlines have times, this app dates them to the day, and it would be a lie
 * to call something missed while the person could still be typing it.
 */

import { overdueLine as toneOverdue, type Tone } from './tone';
import type { CourseId, DatedItem } from './types';

export type Standing = 'ahead' | 'overdue' | 'done';

export type DoneMap = Record<string, boolean>;

export function standingOf(item: DatedItem, done: DoneMap): Standing {
  if (done[item.id]) return 'done';
  return item.isPast ? 'overdue' : 'ahead';
}

export interface Split {
  /** Still to come, soonest first. Includes ones you have already ticked. */
  ahead: DatedItem[];
  /** Past and not ticked, most recently missed first. */
  overdue: DatedItem[];
  /** Ticked, whenever it was due, most recent first. */
  done: DatedItem[];
}

/**
 * Sort order differs by standing on purpose. Ahead reads forwards — the next
 * thing is the thing you act on. Overdue and Done read backwards, because the
 * most recent miss is the one still worth chasing and the oldest finished
 * thing is the one you care least about.
 */
export function split(items: DatedItem[], done: DoneMap): Split {
  const byDate = [...items].sort((a, b) => a.date.getTime() - b.date.getTime());
  const ahead: DatedItem[] = [];
  const overdue: DatedItem[] = [];
  const finished: DatedItem[] = [];
  for (const i of byDate) {
    const where = standingOf(i, done);
    if (where === 'done') finished.push(i);
    else if (where === 'overdue') overdue.push(i);
    else ahead.push(i);
  }
  overdue.reverse();
  finished.reverse();
  return { ahead, overdue, done: finished };
}

/** How many deadlines have gone by unticked. The number worth a warning. */
export function overdueCount(items: DatedItem[], done: DoneMap): number {
  return items.reduce((n, i) => n + (standingOf(i, done) === 'overdue' ? 1 : 0), 0);
}

/**
 * The deadlines that are actually this student's.
 *
 * The app ships with a whole semester in it, and until somebody answers the
 * standing question at the top of every screen — *these are mine* or *not
 * mine* — those four courses belong to nobody. `state.sample` is exactly that
 * question still being open: `components/SampleMark.tsx` draws it, and either
 * answer closes it for good, one by copying the courses into the student's own
 * library and the other by removing them.
 *
 * Counting their deadlines as missed work in the meantime is how a first run
 * greets somebody with *"14 deadlines went by without being ticked off"* — in
 * warning colour, at the top of the first screen, about a term they have never
 * seen and have not been asked whether they want. `lib/you.ts` draws the line
 * this is on the wrong side of: late is named because a missed deadline is
 * worth naming, "not to shame anyone with a red number".
 *
 * ## It filters rather than hiding
 *
 * A student who has imported their own syllabus alongside the sample and
 * genuinely missed one of *its* deadlines still gets warned, because that one
 * is theirs. Only the unclaimed courses drop out, and they stop dropping out
 * the moment the question is answered — adopting the sample copies those
 * courses into `state.courses`, so the same rule that excluded them then
 * includes them, with nothing to special-case.
 *
 * ## Which courses are unclaimed, without asking the store for the seed
 *
 * The catalogue is `sample ? [...seed, ...own] : own` — see `state/store.tsx`.
 * So while the question is open, the unclaimed courses are precisely the ones
 * in the catalogue that are not in the student's own library, and the seed
 * never has to be passed around to say so. When it is closed, everything in
 * the catalogue is theirs and this is the identity.
 */
export function claimed<T extends { c: CourseId }>(
  items: T[],
  own: Iterable<CourseId>,
  sample: boolean,
): T[] {
  if (!sample) return items;
  const mine = new Set(own);
  return items.filter((i) => mine.has(i.c));
}

/** "2 days late" — said plainly, because softening it helps nobody. */
export function lateBy(item: DatedItem): string {
  const days = -item.daysAway;
  if (days <= 0) return 'due today';
  if (days === 1) return '1 day late';
  if (days < 14) return `${days} days late`;
  const weeks = Math.round(days / 7);
  return `${weeks} weeks late`;
}

/**
 * The line above the overdue list. It names the worst one rather than only
 * counting, because "4 overdue" is a number and "the ECON problem set, 6 days
 * late" is a thing you can go and do.
 */
export function overdueLine(
  overdue: DatedItem[],
  code: (item: DatedItem) => string,
  tone: Tone = 'direct',
): string {
  if (overdue.length === 0) return toneOverdue('', 0, tone);
  const worst = overdue[overdue.length - 1];
  // The oldest, named. Built here because only this file knows how to say
  // "6 days late"; the frame around it is `lib/tone.ts`.
  return toneOverdue(`${code(worst)} ${worst.title} is ${lateBy(worst)}`, overdue.length - 1, tone);
}

/** The count badge next to a filter chip — blank rather than a zero. */
export function badge(n: number): string {
  return n > 0 ? ` ${n}` : '';
}
