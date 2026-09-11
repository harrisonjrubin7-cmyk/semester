/**
 * Tabs, because one screen at a time was never how anybody used this.
 *
 * The app is fifty-odd screens and exactly one of them is on. So the whole of
 * "I was reading the guide, let me check when it is due, now where was I" is
 * spent navigating: open the deadline, read one date, press Back twice, find
 * your place again. A browser solved this thirty years ago and everybody
 * already knows the answer — you open the second thing in a second tab and
 * both of them stay open.
 *
 * This is that, for the app's own screens. A tab holds a place in the app;
 * the strip says which places are open; picking one goes there. The page the
 * tab shows is the app itself, which is why there is no rendering here: the
 * strip is browser chrome over the single pane the app has always had.
 *
 * ## The new tab is the search page
 *
 * A tab with no screen in it yet is a new tab, and a new tab is where search
 * lives — the wordmark, the box, the shortcuts under it. That is not a visual
 * joke: it is what makes the strip worth having. Opening a tab and typing is
 * one gesture for "somewhere else, without losing this", and it is the same
 * gesture whether you know the name of what you want or not.
 *
 * ## Not `lib/tabs.ts`
 *
 * That file is about the browser's own tabs — two copies of the app open in
 * one browser, telling each other that the data changed. This is about tabs
 * *inside* the app, which is a different thing with the same name, and the
 * two are neighbours in this directory precisely so nobody has to find out
 * the hard way. `browser` because that is what this builds: the strip, the
 * new tab, and the page each one holds.
 *
 * ## Everything here is pure
 *
 * The strip is a value — the tabs and which one is on — and every change to
 * it is a function from one strip to the next. `read` and `write` are the two
 * lines that touch the browser, at the bottom, so the rules above them can be
 * tested without a DOM and cannot be quietly broken by a storage failure.
 */

import type { Screen } from './types';

export interface AppTab {
  /** Stable for the life of the tab, so React keys survive a reorder. */
  id: string;
  /** Where this tab is, or `null` while it is still a new tab. */
  screen: Screen | null;
  /** What the strip shows. The screen's name, or `NEW_TAB`. */
  title: string;
}

/** The strip: what is open, and which one of them is on. */
export interface Strip {
  tabs: AppTab[];
  at: number;
}

/** What a tab with nothing in it is called, in the strip and in the title. */
export const NEW_TAB = 'New tab';

/**
 * How many tabs the strip will hold.
 *
 * A browser lets you open two hundred and then makes them illegible, which is
 * a bargain a phone-sized strip cannot make: below about this many each tab is
 * a favicon and half a letter, and a tab you cannot read is not a tab you can
 * return to. When the strip is full the oldest one that is not on gives way —
 * the same thing a person does by hand, done without asking.
 */
export const MAX_TABS = 10;

/** Ids that are unique within a session and readable in a React tree. */
let counter = 0;
export function tabId(): string {
  counter += 1;
  return `tab-${Date.now().toString(36)}-${counter}`;
}

/** A tab with nothing in it — the search page. */
export function fresh(id: string = tabId()): AppTab {
  return { id, screen: null, title: NEW_TAB };
}

/** The strip somebody who has never opened one gets. */
export function blank(id: string = tabId()): Strip {
  return { tabs: [fresh(id)], at: 0 };
}

/** The tab that is on, which is always one of them. */
export function current(strip: Strip): AppTab {
  return strip.tabs[clamp(strip, strip.at)];
}

function clamp(strip: Strip, at: number): number {
  return Math.min(Math.max(0, at), Math.max(0, strip.tabs.length - 1));
}

/**
 * Open a new tab beside the one you are on, and go to it.
 *
 * Beside rather than at the end, which is the one detail everybody notices
 * when it is wrong: a tab opened out of this one belongs next to this one, or
 * the strip stops being in any order at all by the fourth tab.
 */
export function add(strip: Strip, id: string = tabId()): Strip {
  const room = strip.tabs.length < MAX_TABS ? strip : evict(strip);
  const at = clamp(room, room.at) + 1;
  return { tabs: [...room.tabs.slice(0, at), fresh(id), ...room.tabs.slice(at)], at };
}

/** Drop the oldest tab that is not the one being used. */
function evict(strip: Strip): Strip {
  const at = clamp(strip, strip.at);
  const drop = strip.tabs.findIndex((_, i) => i !== at);
  if (drop === -1) return strip;
  return { tabs: strip.tabs.filter((_, i) => i !== drop), at: drop < at ? at - 1 : at };
}

/**
 * Close one, and land where a browser lands: on its right-hand neighbour.
 *
 * Closing the last tab leaves a new tab rather than an empty strip. An app
 * with no tabs open would have to invent a screen to show, and the screen it
 * would invent is the search page — so it is simpler and less surprising to
 * say the strip always holds at least one tab.
 */
export function close(strip: Strip, which: number): Strip {
  if (which < 0 || which >= strip.tabs.length) return strip;
  const tabs = strip.tabs.filter((_, i) => i !== which);
  if (tabs.length === 0) return blank();
  const at = clamp(strip, strip.at);
  const next = which < at ? at - 1 : at;
  return { tabs, at: Math.min(next, tabs.length - 1) };
}

/** Go to a tab. Out-of-range is clamped rather than thrown: it is a click. */
export function select(strip: Strip, which: number): Strip {
  return { ...strip, at: clamp(strip, which) };
}

/**
 * The tab you are on is now showing this screen.
 *
 * Called on every navigation the strip is open for, and again when it opens,
 * so a tab records where the app actually is rather than where it was sent.
 * Same screen, same strip — reference-equal, so this can be called from an
 * effect without looping.
 */
export function visit(strip: Strip, screen: Screen, title: string): Strip {
  const at = clamp(strip, strip.at);
  const tab = strip.tabs[at];
  if (!tab || (tab.screen === screen && tab.title === title)) return strip;
  const tabs = [...strip.tabs];
  tabs[at] = { ...tab, screen, title };
  return { tabs, at };
}

/** Open a screen in a tab of its own — the middle-click, as a button. */
export function openBeside(
  strip: Strip,
  screen: Screen,
  title: string,
  id: string = tabId(),
): Strip {
  return visit(add(strip, id), screen, title);
}

/** Where the strip is kept between sessions. */
export const TABS_KEY = 'semester.tabs.v1';

/**
 * A stored strip, read back.
 *
 * Anything malformed becomes a blank strip rather than an exception or a
 * half-read one: the worst case for a wrong answer here is somebody losing a
 * row of tabs, and the worst case for throwing is a search box that will not
 * open. `known` is asked about every screen, so a tab pointing at something
 * this build no longer has — a screen removed, a school without that
 * capability — is dropped instead of becoming a dead click.
 */
export function load(raw: string | null, known: (screen: string) => boolean): Strip {
  try {
    if (!raw) return blank();
    const saved = JSON.parse(raw) as { tabs?: unknown; at?: unknown };
    const list = Array.isArray(saved.tabs) ? saved.tabs : [];
    const tabs: AppTab[] = [];
    for (const entry of list) {
      const tab = entry as Partial<AppTab>;
      if (typeof tab?.id !== 'string') continue;
      if (tab.screen === null || tab.screen === undefined) {
        tabs.push({ id: tab.id, screen: null, title: NEW_TAB });
        continue;
      }
      if (typeof tab.screen !== 'string' || !known(tab.screen)) continue;
      tabs.push({
        id: tab.id,
        screen: tab.screen as Screen,
        title: typeof tab.title === 'string' && tab.title ? tab.title : tab.screen,
      });
    }
    if (tabs.length === 0) return blank();
    const at = typeof saved.at === 'number' ? saved.at : 0;
    const strip = { tabs: tabs.slice(0, MAX_TABS), at: 0 };
    return { ...strip, at: clamp(strip, at) };
  } catch {
    return blank();
  }
}

export function dump(strip: Strip): string {
  return JSON.stringify({ tabs: strip.tabs, at: clamp(strip, strip.at) });
}

export function read(known: (screen: string) => boolean): Strip {
  try {
    return load(localStorage.getItem(TABS_KEY), known);
  } catch {
    return blank();
  }
}

export function write(strip: Strip): void {
  try {
    localStorage.setItem(TABS_KEY, dump(strip));
  } catch {
    // A full store costs you the strip tomorrow, not the one on screen.
  }
}
