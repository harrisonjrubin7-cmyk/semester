/**
 * The screens you have never opened.
 *
 * The app has sixty places in it. A student uses six. The other fifty-four
 * are not hidden — they are in the directory, they are in search, they each
 * have a sentence saying what they are for — and they are still invisible,
 * because nobody reads a directory of sixty things looking for one they do
 * not know exists. The gap has widened with every screen added since this was
 * written, which is the argument for this panel rather than against it.
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

import type { Destination } from './nav';
import type { Screen } from './types';

export type Visited = Record<string, boolean>;

/**
 * Screens that are not worth suggesting.
 *
 * Not because they are unimportant — because arriving at them cold means
 * nothing. An empty note editor and a course detail with no course chosen are
 * reached *through* something, and offered on their own they are a dead end
 * with a heading.
 */
const REACHED_THROUGH: Screen[] = ['note', 'edit', 'notifs', 'settings'];

/** Below this the suggestions stop: they have seen the app. */
export const ENOUGH_SEEN = 0.6;

/** How many to offer at once. Three is a glance; six is another directory. */
export const OFFER = 3;

/**
 * Every place that can sensibly be suggested, out of the pool it is given.
 *
 * The pool is a parameter because the registry is not the answer on any real
 * screen. `DESTINATIONS` is every place the app has ever had, before the
 * school gate, the role gate or `lib/reveal.ts` have said anything — so a
 * panel reading it offers a meal plan at a university with no meal plan, a
 * degree audit to somebody teaching the course, and the screens the directory
 * two panels above is holding back. It did all three.
 *
 * ## It has no default, and this file cannot reach the registry
 *
 * It had one: `pool: Destination[] = DESTINATIONS`, kept so the tests below
 * could go on asking their own question. The twenty-first pass named the cost
 * in its own To do and three passes carried it — **the one caller passed a
 * pool, and a second would have got the ungated registry by saying nothing.**
 * A default that is wrong for every real caller is a trap with a friendly
 * face: the call that springs it is the shortest one, and it looks right.
 *
 * So the pool is required, and `DESTINATIONS` is no longer imported here at
 * all. That is the stronger half. A required parameter can be satisfied by
 * passing the registry; a module that cannot name it has to be given a pool
 * by somebody who knows which one. The tests pass `DESTINATIONS` explicitly
 * and say why, which is the sentence the default used to swallow.
 */
export function offerable(pool: Destination[]): Destination[] {
  return pool.filter((d) => !REACHED_THROUGH.includes(d.screen));
}

export function unseen(visited: Visited | undefined, pool: Destination[]): Destination[] {
  return offerable(pool).filter((d) => !visited?.[d.screen]);
}

/** How much of the app they have been to, 0 to 1. */
export function seenShare(visited: Visited | undefined, pool: Destination[]): number {
  const all = offerable(pool);
  if (all.length === 0) return 1;
  return (all.length - unseen(visited, pool).length) / all.length;
}

/**
 * Three to offer, or none.
 *
 * Rotated by the day rather than shuffled: a panel that shows three different
 * things every time the screen re-renders is a panel nobody can point at
 * twice, and a fixed three are three the student learns to ignore together.
 * The same day gives the same three, and tomorrow gives the next three along.
 */
export function offer(
  visited: Visited | undefined,
  dayIndex: number,
  pool: Destination[],
): Destination[] {
  const left = unseen(visited, pool);
  if (left.length === 0) return [];
  if (seenShare(visited, pool) >= ENOUGH_SEEN) return [];

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
export function seenLine(visited: Visited | undefined, pool: Destination[]): string {
  const all = offerable(pool).length;
  const been = all - unseen(visited, pool).length;
  if (been === 0 || seenShare(visited, pool) >= ENOUGH_SEEN) return '';
  return `You have opened ${been} of the ${all} places in here.`;
}
