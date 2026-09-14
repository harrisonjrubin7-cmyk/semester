import { useSyncExternalStore } from 'react';
import {
  forget,
  read,
  rename,
  savedAt,
  shift,
  toggle,
  write,
  type Bookmark,
} from './bookmarks';
import { known } from './browser.hook';
import type { Action } from '../state/shape';
import type { Screen } from './types';

/**
 * The bookmarks, as one fact the whole app shares.
 *
 * The same shape as `browser.hook.ts` and for the same reason: they are drawn
 * in four places that cannot see each other — the bar under the workspace's
 * search field, the star in that field, the new tab page, and the strip inside
 * the search overlay a phone uses — and a copy in each would be four rows
 * disagreeing about whether the page in front of you is saved.
 *
 * Module state rather than the store, because this is not account data.
 * `lib/bookmarks.ts` says why at length.
 */

let held: Bookmark[] | null = null;
const listeners = new Set<() => void>();

/** The list, read from the device the first time anything asks. */
export function marks(): Bookmark[] {
  if (!held) {
    try {
      held = read(known);
    } catch {
      // A private window with site data off. Bookmarks last the session, which
      // is the app as it was before any of this existed.
      held = [];
    }
  }
  return held;
}

function put(next: Bookmark[]): void {
  if (next === held) return;
  held = next;
  write(next);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The bar, live. Re-renders only what is watching it. */
export function useMarks(): Bookmark[] {
  return useSyncExternalStore(subscribe, marks, marks);
}

/** Save this place, or drop it if it is already saved. Answers with which. */
export function star(place: { screen: Screen; title: string; place: Action[] }): boolean {
  const was = savedAt(marks(), place.screen, place.place) !== null;
  put(toggle(marks(), place));
  return !was;
}

/** Whether this place is saved — what the star is drawn from. */
export function isSaved(screen: Screen | null, place: Action[]): boolean {
  return screen !== null && savedAt(marks(), screen, place) !== null;
}

/** Forget one. */
export function dropMark(id: string): void {
  put(forget(marks(), id));
}

/** Rename one. An empty name is refused — see `rename` in `lib/bookmarks.ts`. */
export function renameMark(id: string, title: string): void {
  put(rename(marks(), id, title));
}

/** Move one along the bar. */
export function shiftMark(id: string, by: number): void {
  put(shift(marks(), id, by));
}

/** For tests: forget what was read, so the next read goes to the device. */
export function forgetMarks(): void {
  held = null;
  for (const listener of listeners) listener();
}
