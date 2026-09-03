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

import type { DatedItem } from './types';

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
export function overdueLine(overdue: DatedItem[], code: (item: DatedItem) => string): string {
  if (overdue.length === 0) return 'Nothing missed. Keep it that way.';
  const worst = overdue[overdue.length - 1];
  const rest = overdue.length - 1;
  const one = `${code(worst)} ${worst.title} is ${lateBy(worst)}`;
  if (rest === 0) return `${one}.`;
  return `${one}, and ${rest} other${rest === 1 ? '' : 's'} went by.`;
}

/** The count badge next to a filter chip — blank rather than a zero. */
export function badge(n: number): string {
  return n > 0 ? ` ${n}` : '';
}
