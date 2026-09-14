/**
 * Bookmarks: the places worth keeping, after the tab holding one is closed.
 *
 * A tab is where you are; a bookmark is where you keep going back to. The
 * strip next door (`lib/browser.ts`) made the first of those cheap, and in
 * doing so made the second one obvious — the ECON study guide, the essay
 * brief, the deadline you are counting down to are all opened twenty times a
 * term, and every one of those twenty times was two or three navigations from
 * wherever the app happened to be. Ten tabs is not the answer to that: a tab
 * kept open for a fortnight so it can be found again is a bookmark somebody is
 * keeping by hand, at the cost of the strip being unreadable.
 *
 * ## A bookmark is a place, which is the same thing a tab holds
 *
 * Not a screen — "Course" is not worth saving, ECON 1020 is — so a bookmark
 * carries the actions that open it, exactly as a tab does, and opening one is
 * replaying them. That is also why the two files are neighbours and why the
 * store is checked the same way: a place is *dispatched*, so what comes back
 * off the device goes through `placeAction` before anything is done with it.
 *
 * ## Kept on the device, like the strip
 *
 * The same argument `browser.hook.ts` makes for tabs, one step weaker and
 * still decisive: the store syncs to the cloud and is what a backup contains,
 * and these are neither a record of the term nor something a phone restored
 * from a laptop's backup should be handed. What is here is a shortcut you made
 * on this machine, and it lives where the strip lives. Nothing is lost if it
 * goes: every bookmark is a place in the app that search can still reach.
 *
 * ## Everything here is pure
 *
 * As next door: the list is a value, every change is a function from one list
 * to the next, and `read` and `write` are the two lines that touch the
 * browser. `bookmarks.test.ts` never opens a DOM.
 */

import { placeAction, sameplace, type AppTab } from './browser';
import type { Action } from '../state/shape';
import type { Screen } from './types';

export interface Bookmark {
  /** Stable for the life of the bookmark, so React keys survive a rename. */
  id: string;
  /** What the chip says. The name of the thing when it was saved, or yours. */
  title: string;
  /** Which screen it lands on — what the chip draws its glyph from. */
  screen: Screen;
  /** The actions that put the app back there. See `place` on `AppTab`. */
  place: Action[];
}

/** Where the bookmarks are kept between sessions. */
export const MARKS_KEY = 'semester.bookmarks.v1';

/**
 * How long a bookmark's name may be.
 *
 * It is drawn as a chip in a row, and a chip is ellipsised past about this
 * anyway — so the limit is on what is stored rather than on what is shown,
 * which is the difference between a name that is cut off on screen and a name
 * that is cut off for good.
 */
export const MARK_NAME = 40;

/**
 * How many will be read back off the device.
 *
 * There is no limit on saving: a bookmark is something a person made on
 * purpose, and an app that silently drops the oldest one to make room for a
 * new one is an app that loses your work while telling you it saved it. The
 * bar scrolls instead. This is the other end — a store that has been
 * corrupted, or written by something that was not this app, is not allowed to
 * hand the strip ten thousand chips to draw.
 */
export const MAX_MARKS = 200;

/** Ids unique within a session and obvious in a store. */
let counter = 0;
export function markId(): string {
  counter += 1;
  return `mark-${Date.now().toString(36)}-${counter}`;
}

/**
 * The bookmark for this place, if there is one.
 *
 * By place and not by title: two bookmarks of ECON 1020 under two names are
 * two ways to the same screen, and the star has to be able to say whether the
 * page in front of you is saved. Renaming one never makes it a different
 * bookmark, which is what somebody renaming it expects.
 */
export function savedAt(list: Bookmark[], screen: Screen, place: Action[]): Bookmark | null {
  return list.find((m) => m.screen === screen && sameplace(m.place, place)) ?? null;
}

/** Whether a tab is something that can be saved: a page, rather than a new tab. */
export function savable(tab: AppTab | null | undefined): boolean {
  return Boolean(tab?.screen && tab.place.length > 0);
}

/**
 * Save a place. Already saved is left alone rather than doubled.
 *
 * New ones go on the end, which is where a browser puts them and is the only
 * order that does not move the chip somebody was about to click.
 */
export function keep(
  list: Bookmark[],
  mark: { screen: Screen; title: string; place: Action[] },
  id: string = markId(),
): Bookmark[] {
  if (mark.place.length === 0) return list;
  if (savedAt(list, mark.screen, mark.place)) return list;
  return [
    ...list,
    {
      id,
      screen: mark.screen,
      title: (mark.title || mark.screen).slice(0, MARK_NAME),
      place: mark.place,
    },
  ];
}

/** Forget one. */
export function forget(list: Bookmark[], id: string): Bookmark[] {
  return list.some((m) => m.id === id) ? list.filter((m) => m.id !== id) : list;
}

/**
 * Rename one.
 *
 * An empty name is refused rather than stored: the chip would be a blank
 * rectangle, and the way to say "I do not want this" is to remove it.
 */
export function rename(list: Bookmark[], id: string, title: string): Bookmark[] {
  const name = title.trim().slice(0, MARK_NAME);
  if (!name) return list;
  return list.map((m) => (m.id === id ? { ...m, title: name } : m));
}

/** The star: saved becomes not saved, and the other way about. */
export function toggle(
  list: Bookmark[],
  mark: { screen: Screen; title: string; place: Action[] },
  id: string = markId(),
): Bookmark[] {
  const already = savedAt(list, mark.screen, mark.place);
  return already ? forget(list, already.id) : keep(list, mark, id);
}

/**
 * Move one along the bar, by one place.
 *
 * The row is the order they were saved in, and the one thing anybody wants to
 * do to that is put the three they use daily at the front. A pair of arrows in
 * the chip's own menu rather than a drag: the bar is a scrolling row of small
 * targets, half of it under the pointer's own tooltip, and a drag that lands
 * one place out is a bookmark somebody has to find again.
 */
export function shift(list: Bookmark[], id: string, by: number): Bookmark[] {
  const from = list.findIndex((m) => m.id === id);
  if (from === -1) return list;
  const to = Math.min(Math.max(0, from + by), list.length - 1);
  if (to === from) return list;
  const out = [...list];
  const [moved] = out.splice(from, 1);
  out.splice(to, 0, moved);
  return out;
}

/**
 * The bookmarks off the device, read back.
 *
 * The same rules the strip is read under, for the same reasons: anything
 * malformed is dropped rather than repaired or thrown over, `known` is asked
 * about every screen so a bookmark of something this build no longer has
 * cannot become a dead chip, and every action in a place goes through
 * `placeAction` before it is kept — a list edited by hand in devtools must not
 * be a way to make the app do anything the reducer can do.
 *
 * A bookmark whose place did not survive is dropped outright, which is where
 * this differs from a tab: a tab that loses its place still has a screen you
 * were on and can land you there, and a bookmark that loses its place is a
 * chip labelled ECON 1020 that opens the courses list.
 */
export function load(raw: string | null, known: (screen: string) => boolean): Bookmark[] {
  try {
    if (!raw) return [];
    const saved = JSON.parse(raw) as { marks?: unknown };
    const list = Array.isArray(saved.marks) ? saved.marks : [];
    const out: Bookmark[] = [];
    for (const entry of list) {
      if (out.length >= MAX_MARKS) break;
      const mark = entry as Partial<Bookmark>;
      if (typeof mark?.id !== 'string' || !mark.id) continue;
      if (typeof mark.screen !== 'string' || !known(mark.screen)) continue;
      const place = Array.isArray(mark.place)
        ? mark.place.map(placeAction).filter((a): a is Action => a !== null)
        : [];
      if (place.length === 0) continue;
      out.push({
        id: mark.id,
        screen: mark.screen as Screen,
        title:
          typeof mark.title === 'string' && mark.title.trim()
            ? mark.title.slice(0, MARK_NAME)
            : mark.screen,
        place,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function dump(list: Bookmark[]): string {
  return JSON.stringify({ marks: list });
}

export function read(known: (screen: string) => boolean): Bookmark[] {
  try {
    return load(localStorage.getItem(MARKS_KEY), known);
  } catch {
    return [];
  }
}

export function write(list: Bookmark[]): void {
  try {
    localStorage.setItem(MARKS_KEY, dump(list));
  } catch {
    // A full store costs tomorrow's bar, not the one on screen. `lib/keep.ts`
    // is where the app's own data answers this question properly; a row of
    // shortcuts is not data of that kind.
  }
}
