/**
 * Everything the app can open, as one list of icons — what the grid button in
 * the header opens onto.
 *
 * The app has fifty-odd screens and, until now, three ways to reach one you
 * could not name: the tab bar, which holds five of them; search, which needs
 * you to already know the word; and the directory on Progress, which is a
 * screen you have to leave the one you are on to get to. The third is the gap
 * this fills. Somebody reading a study guide who wants the practice paper had
 * to go to Progress, find the tile, open the shelf, come back — and by then
 * the guide they were reading is two Backs away.
 *
 * A launcher over the screen costs nothing you were looking at, which is the
 * same argument `components/Command.tsx` makes for search being an overlay
 * rather than a screen. That is deliberate: this is search's other half. One
 * finds a screen by its name, the other by its picture and its place, and
 * both hand you back the page you were on if you change your mind.
 *
 * ## Nothing here decides anything
 *
 * The membership is the registry's, gated by the school; the order inside a
 * shelf is whatever the student dragged their launcher tiles into; the words
 * are `saysFor`'s, so a school that calls its registrar YES gets YES here as
 * well. This file only puts the shelves in a row, which is why it is twenty
 * lines: a second opinion about which screens exist is exactly the thing that
 * goes stale.
 *
 * ## Why there is no "favourites" row on top
 *
 * The launcher this borrows from opens with the six apps you use most, and
 * that was the first thing tried here. It is wrong for the same reason the
 * directory on Progress does not put "Lately" above its tiles: a grid earns
 * its keep by position — Data is bottom-right and stays bottom-right, so the
 * second time you look for it you point rather than read — and a row on top
 * whose length changes with the week moves every icon under it. A shelf you
 * have arranged yourself is the favourites row, and it holds still.
 */

import { readOrder, tilesFor } from './launcher';
import { GROUPS, type Destination, type Group } from './nav';
import type { Capabilities } from './school';

export interface AppShelf {
  group: Group;
  apps: Destination[];
}

/**
 * The shelves, in order, each holding every screen this school offers on it.
 *
 * `saved` is the `groupOrder` look key — the arrangement dragged on the
 * launcher's folders. Passing it through means the two grids cannot disagree
 * about where a student put something.
 */
export function appShelves(caps: Capabilities, saved: string | undefined): AppShelf[] {
  const order = readOrder(saved);
  return GROUPS.map((group) => ({ group, apps: tilesFor(group, caps, order) })).filter(
    (shelf) => shelf.apps.length > 0,
  );
}

/** How many screens that came to, for the line under the heading. */
export function appCount(shelves: AppShelf[]): number {
  return shelves.reduce((n, shelf) => n + shelf.apps.length, 0);
}
