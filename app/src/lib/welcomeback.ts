/**
 * Welcome back, after a real break.
 *
 * `lib/since.ts` already says what moved while you were not looking, and says
 * it in one line. That is the right size for an evening away. It is the wrong
 * size for a week off sick, or for coming back after reading week: the line
 * reports what *arrived*, and what somebody back from a break needs first is
 * what *went by* — the deadlines that fell while the app was closed and that
 * nobody has said anything about since.
 *
 * So after `AWAY_DAYS` calendar days this answers four questions, in order:
 *
 * 1. **How long.** In days, counted the way `sinceLabel` counts them.
 * 2. **What needs confirming.** Deadlines that fell inside the gap and are
 *    not ticked. The app cannot know whether they were handed in — a paper
 *    submitted from a library computer never touched this phone — so it asks
 *    rather than calling them missed. That is the difference between a
 *    recovery screen and a telling-off.
 * 3. **What is ahead.** The next seven days, undone.
 * 4. **One place to start.** The soonest thing ahead if there is one,
 *    otherwise the most recent thing that went by. One, not a list: the list
 *    is the rest of Today.
 *
 * What carries forward — courses, notes, plans — needs no computing: nothing
 * in the app expires while it is closed, and the card says so in words rather
 * than by counting things the student already knows they have.
 *
 * Derived every time, never stored, like every other reading of the
 * catalogue. The only input that is not already state is `lastSeen`, which
 * `lib/since.ts` owns.
 */

import { daysBetween } from './date';
import type { DatedItem } from './types';

/** Calendar days away before the card replaces the one-line change report. */
export const AWAY_DAYS = 5;

/** How far ahead "this week" looks, in days. */
export const AHEAD_DAYS = 7;

/** How many of each list the card names before it says "and N more". */
export const NAMED = 3;

export interface WelcomeBack {
  /** Calendar days since the app was last opened on this device. */
  days: number;
  /** Deadlines that fell during the gap and are not ticked, oldest first. */
  toConfirm: DatedItem[];
  /** Undone deadlines in the next `AHEAD_DAYS`, soonest first. */
  ahead: DatedItem[];
  /** The one suggested place to start, or null when nothing is outstanding. */
  restart: DatedItem | null;
}

/**
 * The welcome-back reading, or null when there is nothing to welcome back
 * from — a first run (no mark), or a gap shorter than `AWAY_DAYS`.
 *
 * `items` is `datedItems(catalog, now)`, already sorted soonest first.
 */
export function welcomeBack(
  items: DatedItem[],
  done: Record<string, boolean>,
  lastSeen: number,
  now: Date,
): WelcomeBack | null {
  if (lastSeen <= 0) return null;
  const was = new Date(lastSeen);
  const days = daysBetween(was, now);
  if (days < AWAY_DAYS) return null;

  // Against the due *instant*, not the day: a 9am deadline on the day they
  // were last here at 5pm had already gone by while they were here, so it is
  // not something that happened during the absence (Codex review on #854).
  // An untimed deadline is due at the end of its day — `dueAt` is `24 * 60`
  // for those — so one due the day they left, after they left, still counts.
  const open = items.filter((i) => !done[i.id]);
  const toConfirm = open.filter((i) => i.isPast && dueInstant(i) > lastSeen);
  const ahead = open.filter((i) => !i.isPast && i.daysAway <= AHEAD_DAYS);
  const restart = ahead[0] ?? toConfirm[toConfirm.length - 1] ?? null;
  return { days, toConfirm, ahead, restart };
}

/** When a deadline falls due: its day plus its clock, or the end of the day. */
export function dueInstant(i: Pick<DatedItem, 'date' | 'dueAt'>): number {
  return i.date.getTime() + i.dueAt * 60_000;
}

/** "3 deadlines went by while you were away" — or empty when none did. */
export function confirmLine(w: WelcomeBack): string {
  const n = w.toConfirm.length;
  if (n === 0) return '';
  return `${n} ${n === 1 ? 'deadline' : 'deadlines'} went by while you were away. Tick any you handed in; the rest are still yours to sort out.`;
}

/** "2 due in the next week" — or empty when the week is clear. */
export function aheadLine(w: WelcomeBack): string {
  const n = w.ahead.length;
  if (n === 0) return 'Nothing is due in the next week.';
  return `${n} due in the next week.`;
}

/** The first `NAMED` titles and how many more, for a compact list. */
export function named(list: DatedItem[]): { shown: DatedItem[]; more: number } {
  return { shown: list.slice(0, NAMED), more: Math.max(0, list.length - NAMED) };
}
