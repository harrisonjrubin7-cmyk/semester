import { useSyncExternalStore } from 'react';
import {
  add,
  asked,
  blank,
  close,
  closeGroup,
  collapse,
  current,
  dissolve,
  joinGroup,
  leaveGroup,
  makeGroup,
  openBeside,
  read,
  renameGroup,
  select,
  toneGroup,
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

/*
 * The groups.
 *
 * One line each, for the same reason the tab operations above are one line
 * each: the rules are in `lib/browser.ts` where they can be tested without a
 * DOM, and this is the wire between them and a menu. The four that can change
 * which tab is on — collapsing the group you are working in, closing a group
 * whole — hand back the tab the app should now be showing, because a tab's
 * page *is* the app and revealing one is going to it.
 */

/** Put a tab in a group of its own. */
export function groupTab(which: number, name = ''): void {
  put(makeGroup(strip(), which, name));
}

/** Move a tab into a group that already exists. */
export function joinTabGroup(which: number, id: string): void {
  put(joinGroup(strip(), which, id));
}

/** Take a tab out of whatever group it is in. */
export function leaveTabGroup(which: number): void {
  put(leaveGroup(strip(), which));
}

/** Name a group, or clear its name. */
export function nameGroup(id: string, name: string): void {
  put(renameGroup(strip(), id, name));
}

/** Recolour a group. */
export function colourGroup(id: string, tone: number): void {
  put(toneGroup(strip(), id, tone));
}

/**
 * Fold a group down to its name, or open it.
 *
 * Answers with the tab the app should now be showing, or `null` when that did
 * not change — folding the group you are working in moves you out of it, and
 * folding one you are not in moves nothing. The caller opens what it is
 * handed, so `null` has to mean "nothing to open" rather than "here, again":
 * re-dispatching the place you are already in is a navigation, and in the
 * search overlay a navigation closes the overlay you were folding from.
 */
export function foldGroup(id: string, shut: boolean): AppTab | null {
  const was = here().id;
  put(collapse(strip(), id, shut));
  return here().id === was ? null : here();
}

/** Undo the grouping, keeping every tab open. */
export function dissolveGroup(id: string): void {
  put(dissolve(strip(), id));
}

/**
 * A new tab, in a group that already exists.
 *
 * Two steps rather than one: `add` puts it beside the tab you are on, which
 * may be anywhere, and `joinGroup` moves it to the end of the group's run. The
 * strip holds its own invariants through both, so there is no moment where a
 * group is two runs with something else between them.
 */
export function openTabIn(id: string): void {
  put(add(strip()));
  put(joinGroup(strip(), strip().at, id));
}

/** Close every tab in a group. Returns the tab now on, or null — as above. */
export function shutGroup(id: string): AppTab | null {
  const was = here().id;
  put(closeGroup(strip(), id));
  return here().id === was ? null : here();
}

