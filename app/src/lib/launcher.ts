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

import { destinationsFor, GROUPS, type Group } from './nav';
import type { Capabilities } from './school';
import type { Destination } from './nav';
import type { Screen } from './types';

/** A saved arrangement: for each shelf, the screens on it, in order. */
export type ShelfOrder = Partial<Record<Group, Screen[]>>;

const SHELF_SEP = '|';
const NAME_SEP = ':';
const ITEM_SEP = ',';

/** Parse the look key. Anything unrecognised is dropped rather than trusted. */
export function readOrder(saved: string | undefined): ShelfOrder {
  const out: ShelfOrder = {};
  if (!saved) return out;
  for (const chunk of saved.split(SHELF_SEP)) {
    const at = chunk.indexOf(NAME_SEP);
    if (at < 0) continue;
    const name = chunk.slice(0, at) as Group;
    if (!GROUPS.includes(name)) continue;
    const screens = chunk
      .slice(at + 1)
      .split(ITEM_SEP)
      .map((s) => s.trim())
      .filter(Boolean) as Screen[];
    if (screens.length > 0) out[name] = screens;
  }
  return out;
}

/** Back to a look key. Empty shelves are left out rather than written blank. */
export function writeOrder(order: ShelfOrder): string {
  return GROUPS.filter((g) => (order[g]?.length ?? 0) > 0)
    .map((g) => `${g}${NAME_SEP}${order[g]!.join(ITEM_SEP)}`)
    .join(SHELF_SEP);
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
  const wanted = order[group] ?? [];
  const byScreen = new Map(real.map((d) => [d.screen, d]));

  const first: Destination[] = [];
  for (const screen of wanted) {
    const d = byScreen.get(screen);
    // Named twice, or named and not on this shelf any more: skip it. The
    // `delete` is what stops a duplicate name repeating the tile.
    if (!d) continue;
    first.push(d);
    byScreen.delete(screen);
  }
  return [...first, ...real.filter((d) => byScreen.has(d.screen))];
}

/**
 * Drop `moved` onto `onto`: it takes that position and everything shifts.
 *
 * Insert-at rather than swap. Swapping two tiles is easy to implement and
 * wrong to use — dragging the last tile onto the first should put it first,
 * not exchange two things at opposite ends of the grid and leave the rest
 * where they were.
 */
export function reorder<T>(list: T[], moved: T, onto: T): T[] {
  if (moved === onto) return list;
  const from = list.indexOf(moved);
  const to = list.indexOf(onto);
  if (from < 0 || to < 0) return list;
  const out = list.filter((x) => x !== moved);
  out.splice(to, 0, moved);
  return out;
}

/**
 * The arrangement after a drag, ready to be written back to the look.
 *
 * The whole shelf is written down, not just the pair that moved — a partial
 * order would leave the rest at the mercy of a registry edit, which is the
 * one thing a person who has arranged their tiles does not expect.
 */
export function afterDrag(
  group: Group,
  caps: Capabilities,
  order: ShelfOrder,
  moved: Screen,
  onto: Screen,
): ShelfOrder {
  const screens = tilesFor(group, caps, order).map((d) => d.screen);
  return { ...order, [group]: reorder(screens, moved, onto) };
}
