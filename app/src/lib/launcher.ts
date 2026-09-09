/**
 * The launcher's order, and the folder overlay's.
 *
 * The directory has always been in registry order, which is the order somebody
 * wrote the screens down in. That is a fine default and a poor permanent
 * answer: the six screens a particular student opens every week are not the
 * six that happened to be typed first, and until now there was no way to say
 * so.
 *
 * So the tiles inside a shelf can be dragged, and the order is a look key —
 * `groupOrder`, which the "still absent" list in the handoff names. A look key
 * rather than a new slice of state because that is what the restructure's
 * first rule allows, and because it is the right home for it: this is a
 * preference about arrangement, it belongs with corners and density, and it
 * travels with the rest of the look.
 *
 * ## Stored as a string, because that is what a look key is
 *
 * `Look` holds strings and one number. Rather than widen it to hold a map,
 * the order is serialised — `Semester:home,brief|Courses:courses,import` —
 * and parsed back through the registry on the way in. Nothing downstream ever
 * sees the string.
 *
 * ## The registry is the authority, always
 *
 * A saved order is a *preference over* the registry, never a replacement for
 * it. A screen the school gate has switched off does not come back because it
 * is named in an old order; a screen added to the app since the order was
 * saved appears at the end rather than not at all; a name that is no longer a
 * screen is dropped. That is what keeps a stale order harmless — the worst it
 * can do is arrange things oddly, never hide one.
 */

import { arranged, readLists, writeLists } from './arrange';
import { destinationsFor, GROUPS, type Group } from './nav';
import type { Capabilities } from './school';
import type { Destination } from './nav';
import type { Screen } from './types';

/** A saved arrangement: for each shelf, the screens on it, in order. */
export type ShelfOrder = Partial<Record<Group, Screen[]>>;

/**
 * Parse the look key. Anything unrecognised is dropped rather than trusted.
 *
 * The string itself is `lib/arrange.ts`'s — the home screen keeps its pages
 * the same way — and what is added here is the one thing that is this file's
 * business: a name in it has to be a shelf the app actually has.
 */
export function readOrder(saved: string | undefined): ShelfOrder {
  const out: ShelfOrder = {};
  for (const [name, screens] of Object.entries(readLists(saved))) {
    if (!GROUPS.includes(name as Group)) continue;
    out[name as Group] = screens as Screen[];
  }
  return out;
}

/** Back to a look key. Empty shelves are left out rather than written blank. */
export function writeOrder(order: ShelfOrder): string {
  return writeLists(
    Object.fromEntries(GROUPS.filter((g) => (order[g]?.length ?? 0) > 0).map((g) => [g, order[g]!])),
  );
}

/**
 * The tiles on one shelf, arranged.
 *
 * The registry decides membership and the saved order decides sequence, in
 * that order of authority: everything the shelf actually has, with the ones
 * named in the saved order first and in that order, and the rest after in
 * registry order.
 */
export function tilesFor(group: Group, caps: Capabilities, order: ShelfOrder): Destination[] {
  const real = destinationsFor(group, caps);
  const byScreen = new Map(real.map((d) => [d.screen, d]));
  return arranged(
    real.map((d) => d.screen),
    order[group] ?? [],
  ).map((screen) => byScreen.get(screen)!);
}
