import { useSyncExternalStore } from 'react';
import {
  MAX_TABS,
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
  pin,
  read,
  rearrange,
  renameGroup,
  select,
  tidy,
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
/*
 * The tabs closed this visit, most recent last.
 *
 * Bounded on its own rather than by `MAX_TABS`: this is a short undo for a
 * mis-click, not a second strip, and it was ten when the cap was ten.
 */
const REOPENABLE = 10;
const closed: {tab: AppTab; at: number}[]=[];
const listeners = new Set<() => void>();
/*
 * The place the strip was last followed to.
 *
 * Here rather than in the component that does the following, because it is a
 * fact about this visit — like the strip itself and the closed-tab list above
 * — rather than about whatever happens to be rendering. `forgetStrip` clears
 * it with them.
 *
 * It was a ref in `TabsFollow`, and the browser shell used to draw the app in
 * one parent while its home screen was up and another once it was not, so
 * going anywhere from the home remounted that component and the ref came back
 * null. The navigation that caused the remount then looked like the session's
 * first look, which is the one moment `TabsFollow` is allowed to ignore a
 * navigation: two tabs open and nothing you did from the home was recorded.
 *
 * That shell is gone (`SIMPLIFY-AUDIT.md` E4, `workspace` survives) and with
 * it the remount that exposed this, so the bug is no longer reachable. The
 * state stays here anyway, and the distinction is the reason why: where a
 * session was last followed to is a fact about the visit, like the strip and
 * the closed-tab list above it, and it was only ever in a component by
 * accident. A ref would work today and cost a tab its place the next time
 * anything remounts the strip's subtree.
 */
let followed: string | null = null;

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

/**
 * The place the app was last followed to, or null before anything has been.
 *
 * Null means "the strip has not looked yet this visit", which is the state
 * the adoption rule in `TabsFollow` turns on — not "the component mounted",
 * which is a different and much commoner event. See `followed` above.
 */
export function lastFollowed(): string | null {
  return followed;
}

/** Remember that the strip has now been followed to this place. */
export function follow(key: string): void {
  followed = key;
}

/** Remember what this tab searched for, so it can be come back to. */
export function recordSearch(query: string): void {
  put(asked(strip(), query));
}

/** A new tab, beside the one you are on, and you are now on it. */
export function openTab(): boolean {
  if(strip().tabs.length>=MAX_TABS)return false;
  put(add(strip()));
  return true;
}

/**
 * Open a place in a tab of its own, without leaving the one you are on.
 *
 * The new tab inherits the search it came out of, when it came out of one:
 * following a result and then wanting the rest of the list is the commonest
 * thing anybody does with a page of results, and the tab you landed in is
 * where you are when you want it.
 */
export function openInNew(screen: Screen, title: string, place: Action[], query = ''): boolean {
  if(strip().tabs.length>=MAX_TABS)return false;
  put(openBeside(strip(), screen, title, place));
  if (query) put(asked(strip(), query));
  return true;
}

/** Go to a tab. Returns the tab you are now on, for the caller to open. */
export function pickTab(which: number): AppTab {
  put(select(strip(), which));
  return here();
}

/** Close one. Returns the tab that is now on — its neighbour, or a new tab. */
export function closeTab(which: number): AppTab {
  const before=strip();
  if(before.tabs[which]){closed.push({tab:before.tabs[which],at:which});if(closed.length>REOPENABLE)closed.shift();}
  put(close(before, which));
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

/** Keep a tab at the front of the strip, as its glyph. Or let it go. */
export function pinTab(which: number, pinned: boolean): void {
  put(pin(strip(), which, pinned));
}

/**
 * The strip, as a drag left it.
 *
 * `order` is the ids as drawn and `moved` is the tab the finger had; what the
 * new position means for its group is `rearrange` in `lib/browser.ts`.
 */
export function moveTab(order: string[], moved: string): void {
  put(rearrange(strip(), order, moved));
}

/**
 * A new tab, in a group that already exists. False when there was no room.
 *
 * Two steps rather than one: `add` puts it beside the tab you are on, which
 * may be anywhere, and `joinGroup` moves it to the end of the group's run. The
 * strip holds its own invariants through both, so there is no moment where a
 * group is two runs with something else between them.
 *
 * The cap is checked here rather than left to `add`, which answers a full
 * strip by handing back the strip it was given. That is the right answer for
 * `add` and the wrong one for these two steps together: the second would then
 * move the tab *you are on* into the group, so asking for a new tab at the cap
 * would have swallowed the page in front of you into somebody else's run.
 */
export function openTabIn(id: string): boolean {
  if (strip().tabs.length >= MAX_TABS) return false;
  put(add(strip()));
  put(joinGroup(strip(), strip().at, id));
  return true;
}

/** Close every tab in a group. Returns the tab now on, or null — as above. */
export function shutGroup(id: string): AppTab | null {
  const was = here().id;
  put(closeGroup(strip(), id));
  return here().id === was ? null : here();
}

/** Last closed tab from this visit, including its original per-tab workspace identity. */
export function lastClosed(): AppTab | undefined { return closed.at(-1)?.tab; }
export function reopenClosed(): AppTab | null {
  const current=strip();
  if(!closed.length || current.tabs.length>=MAX_TABS)return null;
  const entry=closed.pop()!;
  const at=Math.min(entry.at,current.tabs.length);
  /* Spread the strip rather than rebuilding it: it carries the groups too,
     and a reopened tab must not take them down with it.

     Through `tidy`, because putting a tab back at the index it left from is
     the one insertion that can land in the middle of somebody else's run —
     the strip has moved on since. And because the group it remembers being in
     may have gone with the last of its other tabs, which makes it a tab
     pointing at a name no group answers to. `tidy` is where both of those are
     already answered, and it keeps you on the tab you were on. */
  put(tidy({...current,tabs:[...current.tabs.slice(0,at),entry.tab,...current.tabs.slice(at)],at}));
  return here();
}

/**
 * For tests: forget everything read from the device.
 *
 * Cut on main as an export nothing read; `browser-recovery.test.ts` reads it
 * again, and it now clears the closed-tab history too — that history is
 * module state, so without this one test's closes are visible to the next.
 */
export function forgetStrip(): void {
  held = null;
  closed.length = 0;
  followed = null;
}
