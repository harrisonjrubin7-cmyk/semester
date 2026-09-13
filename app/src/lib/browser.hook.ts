import { useSyncExternalStore } from 'react';
import {
  add,
  asked,
  blank,
  close,
  current,
  openBeside,
  read,
  select,
  visit,
  write,
  type AppTab,
  type Strip,
} from './browser';
import { screenName } from './nav';
import type { Action } from '../state/shape';
import type { Screen } from './types';

/**
 * The strip, as one fact the whole app shares.
 *
 * It is read in two places that cannot see each other — the bar above the
 * header and the search overlay — and written by a third, the navigation
 * itself. A copy in each would be two strips disagreeing about which tab is
 * on, which is the one thing a tab strip cannot get wrong.
 *
 * Module state rather than the store, for the same reason `folds.hook.ts` is:
 * this is not account data. The store syncs to the cloud and is what a backup
 * contains; which places you happen to have open on this laptop is neither,
 * and a strip restored onto a phone from a desktop's backup would be a row of
 * tabs nobody opened.
 */

let held: Strip | null = null;
const listeners = new Set<() => void>();

/**
 * A screen this build still has.
 *
 * `screenName` answers with the id itself for anything it cannot name, and
 * `nav.test.ts` holds that every real screen is named by one of its three
 * registries — so this is the same question asked cheaply. It matters at the
 * one place a stale name can arrive: a strip saved by an older build.
 */
export const known = (screen: string) => screenName(screen as Screen) !== screen;

/** The strip, read from the device the first time anything asks. */
export function strip(): Strip {
  if (!held) {
    try {
      held = read(known);
    } catch {
      // A private window with site data off. Tabs last the session, which is
      // the app as it was before any of this existed.
      held = blank();
    }
  }
  return held;
}

function put(next: Strip): void {
  if (next === held) return;
  held = next;
  write(next);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The strip, live. Re-renders only what is watching it. */
export function useStrip(): Strip {
  return useSyncExternalStore(subscribe, strip, strip);
}

/** The tab that is on. */
export function here(): AppTab {
  return current(strip());
}

/** The tab you are on is now showing this place. */
export function record(screen: Screen, title: string, place: Action[]): void {
  put(visit(strip(), screen, title, place));
}

/** Remember what this tab searched for, so it can be come back to. */
export function recordSearch(query: string): void {
  put(asked(strip(), query));
}

/** A new tab, beside the one you are on, and you are now on it. */
export function openTab(): void {
  put(add(strip()));
}

/**
 * Open a place in a tab of its own, without leaving the one you are on.
 *
 * The new tab inherits the search it came out of, when it came out of one:
 * following a result and then wanting the rest of the list is the commonest
 * thing anybody does with a page of results, and the tab you landed in is
 * where you are when you want it.
 */
export function openInNew(screen: Screen, title: string, place: Action[], query = ''): void {
  put(openBeside(strip(), screen, title, place));
  if (query) put(asked(strip(), query));
}

/** Go to a tab. Returns the tab you are now on, for the caller to open. */
export function pickTab(which: number): AppTab {
  put(select(strip(), which));
  return here();
}

/** Close one. Returns the tab that is now on — its neighbour, or a new tab. */
export function closeTab(which: number): AppTab {
  put(close(strip(), which));
  return here();
}

/** For tests: forget everything read from the device. */
export function forgetStrip(): void {
  held = null;
}
