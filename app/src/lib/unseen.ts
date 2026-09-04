/**
 * The screens you have never opened.
 *
 * The app has forty-two places in it. A student uses six. The other
 * thirty-six are not hidden — they are in the directory, they are in search,
 * they each have a sentence saying what they are for — and they are still
 * invisible, because nobody reads a directory of forty-two things looking for
 * one they do not know exists.
 *
 * The fix is not another list. It is a short, honest count and three
 * suggestions: *you have opened nine of these; here are three you have not.*
 * Which is a different sentence from a marketing one, because it is true and
 * it is about them.
 *
 * ## It stops when there is nothing to say
 *
 * Once a student has opened most of the app this says nothing at all. A
 * permanent "discover more" panel is chrome, and chrome is what people learn
 * to look past — including on the day it finally has something worth saying.
 */

import { DESTINATIONS, type Destination } from './nav';
import type { Screen } from './types';

export type Visited = Record<string, boolean>;

/**
 * Screens that are not worth suggesting.
 *
 * Not because they are unimportant — because arriving at them cold means
 * nothing. An empty note editor, a course detail with no course chosen, and a
 * search box are all reached *through* something, and offered on their own
 * they are a dead end with a heading.
 */
const REACHED_THROUGH: Screen[] = ['note', 'edit', 'search', 'notifs', 'settings'];

/** Below this the suggestions stop: they have seen the app. */
export const ENOUGH_SEEN = 0.6;

/** How many to offer at once. Three is a glance; six is another directory. */
export const OFFER = 3;

/** Every place that can sensibly be suggested. */
export function offerable(): Destination[] {
  return DESTINATIONS.filter((d) => !REACHED_THROUGH.includes(d.screen));
}

export function unseen(visited: Visited | undefined): Destination[] {
  return offerable().filter((d) => !visited?.[d.screen]);
}

/** How much of the app they have been to, 0 to 1. */
export function seenShare(visited: Visited | undefined): number {
  const all = offerable();
  if (all.length === 0) return 1;
  return (all.length - unseen(visited).length) / all.length;
}

/**
 * Three to offer, or none.
 *
 * Rotated by the day rather than shuffled: a panel that shows three different
 * things every time the screen re-renders is a panel nobody can point at
 * twice, and a fixed three are three the student learns to ignore together.
 * The same day gives the same three, and tomorrow gives the next three along.
 */
export function offer(visited: Visited | undefined, dayIndex: number): Destination[] {
  const left = unseen(visited);
  if (left.length === 0) return [];
  if (seenShare(visited) >= ENOUGH_SEEN) return [];

  const start = ((dayIndex % left.length) + left.length) % left.length;
  const out: Destination[] = [];
  for (let i = 0; i < Math.min(OFFER, left.length); i += 1) {
    out.push(left[(start + i) % left.length]);
  }
  return out;
}

/** Days since the epoch, in local time — what `offer` rotates on. */
export function dayOf(now: Date): number {
  return Math.floor(
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86_400_000,
  );
}

/** "You have opened 9 of the 37 places in the app." Empty once that stops mattering. */
export function seenLine(visited: Visited | undefined): string {
  const all = offerable().length;
  const been = all - unseen(visited).length;
  if (been === 0 || seenShare(visited) >= ENOUGH_SEEN) return '';
  return `You have opened ${been} of the ${all} places in here.`;
}
