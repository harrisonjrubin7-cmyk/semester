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

import type { CourseId, Screen, StudyMode } from './types';
import type { Action } from '../state/shape';

export interface AppTab {
  /** Stable for the life of the tab, so React keys survive a reorder. */
  id: string;
  /** Where this tab is, or `null` while it is still a new tab. */
  screen: Screen | null;
  /** What the strip shows. The screen's name, or `NEW_TAB`. */
  title: string;
  /**
   * What puts the app back exactly here.
   *
   * The screen alone is not a place. "Course" is not a tab worth having;
   * "ECON 1020" is — and the difference is one id. So a tab keeps the actions
   * that opened it (`actionsFor` in `lib/openhit.ts` makes them, `placeFor`
   * below makes them for wherever the app already is) and replays them when
   * it is picked. They are plain objects, so a tab survives being written to
   * the device and read back next week.
   */
  place: Action[];
  /**
   * The search this tab last made, if it made one.
   *
   * A tab that searched and then followed a result is still a tab that
   * searched: opening the box again shows the results it was showing, the way
   * Back does in a browser, rather than a blank page and a query to retype.
   * Cleared by emptying the box, and never carried into a new tab — a tab
   * nobody has typed in has nothing to remember.
   */
  query?: string;
}

/**
 * The one action that stands for "just go there".
 *
 * Every screen has this as its place; only the ones that are about something
 * need more. Kept as a function rather than written out at each call so the
 * shape of a place is defined once.
 */
export function justGo(screen: Screen): Action[] {
  return [{ type: 'go', screen }];
}

/** The ids the app is holding, which is what turns a screen into a place. */
export interface Where {
  courseId: CourseId;
  itemId: string;
  eventId: string;
  guideId: CourseId;
  /*
   * Nullable, because the store's are: a note, a document, a sheet and a deck
   * are each "the one that is open, or none". Written out rather than taken
   * as `State` so this file stays a model of a strip of tabs rather than
   * something that has to be given the whole app to answer a question.
   */
  noteId: string | null;
  documentId: string | null;
  sheetId: string | null;
  deckId: string | null;
  mode: StudyMode;
}

/**
 * The place the app is in right now, as actions that would return to it.
 *
 * The mirror of `actionsFor`: that one reads a search result, this one reads
 * the app itself, so a tab records where you actually are rather than only
 * where search sent you. The screens that are about something are the ones
 * listed; everything else is a screen you are simply on.
 *
 * The four screens under a guide — the drill, the quiz, the lesson, the
 * slides — take two actions, because there is no action that opens a quiz
 * about a particular course: opening the guide carries the id, and going to
 * the screen carries which of the four it was.
 */
export function placeFor(screen: Screen, at: Where): Action[] {
  switch (screen) {
    case 'course':
    case 'edit':
      return at.courseId ? [{ type: 'openCourse', id: at.courseId }] : justGo(screen);
    case 'item':
      return at.itemId ? [{ type: 'openItem', id: at.itemId }] : justGo(screen);
    case 'event':
      return at.eventId ? [{ type: 'openEvent', id: at.eventId }] : justGo(screen);
    case 'guide':
      return at.guideId ? [{ type: 'openGuide', id: at.guideId, mode: at.mode }] : justGo(screen);
    case 'drill':
    case 'quiz':
    case 'lesson':
    case 'slides':
      return at.guideId
        ? [{ type: 'openGuide', id: at.guideId, mode: at.mode }, { type: 'go', screen }]
        : justGo(screen);
    case 'note':
      return at.noteId ? [{ type: 'openNote', id: at.noteId }] : justGo(screen);
    case 'write':
      return at.documentId ? [{ type: 'openDocument', id: at.documentId }] : justGo(screen);
    case 'sheet':
      return at.sheetId ? [{ type: 'openSheet', id: at.sheetId }] : justGo(screen);
    case 'deck':
      return at.deckId ? [{ type: 'editDeck', id: at.deckId }] : justGo(screen);
    default:
      return justGo(screen);
  }
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
  return { id, screen: null, title: NEW_TAB, place: [] };
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
export function visit(strip: Strip, screen: Screen, title: string, place: Action[]): Strip {
  const at = clamp(strip, strip.at);
  const tab = strip.tabs[at];
  if (!tab) return strip;
  // The query is not touched here: following a result is what a tab does
  // *after* a search, and the search is what you come back to.
  // Compared by what it says and where it goes, not by identity: this is
  // called on every navigation and on every open, and a new object each time
  // is a re-render of the strip each time.
  if (tab.screen === screen && tab.title === title && sameplace(tab.place, place)) return strip;
  const tabs = [...strip.tabs];
  tabs[at] = { ...tab, screen, title, place };
  return { tabs, at };
}

/** What this tab last searched for. Empty forgets it. */
export function asked(strip: Strip, query: string): Strip {
  const at = clamp(strip, strip.at);
  const tab = strip.tabs[at];
  if (!tab || (tab.query ?? '') === query) return strip;
  const tabs = [...strip.tabs];
  tabs[at] = { ...tab, query: query || undefined };
  return { tabs, at };
}

/** Whether two places are the same place. Shallow: an action is flat. */
export function sameplace(a: Action[], b: Action[]): boolean {
  return a.length === b.length && a.every((x, i) => JSON.stringify(x) === JSON.stringify(b[i]));
}

/** Open a screen in a tab of its own — the middle-click, as a button. */
export function openBeside(
  strip: Strip,
  screen: Screen,
  title: string,
  place: Action[],
  id: string = tabId(),
): Strip {
  return visit(add(strip, id), screen, title, place);
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
/**
 * The actions a stored tab is allowed to carry.
 *
 * The store on the device is not a trusted input — it holds whatever an older
 * build, a newer build or a half-finished sync wrote — and a tab's place is
 * *dispatched*. Without this list, a strip edited by hand in devtools would be
 * a way to make the app do anything the reducer can do, including the things
 * that delete data. So: opening actions only, and everything else is dropped
 * rather than repaired.
 *
 * Adding an arm to `actionsFor` or `placeFor` means adding its type here, and
 * `browser.test.ts` holds that the two lists agree.
 */
export const PLACE_ACTIONS = [
  'go',
  'openItem',
  'openCourse',
  'openEvent',
  'openGuide',
  'openNote',
  'openDocument',
  'openSheet',
  'editDeck',
  'setMineTab',
] as const;

const ALLOWED = new Set<string>(PLACE_ACTIONS);

/** One stored action, if it is one of the openers and nothing but flat data. */
function placeAction(raw: unknown): Action | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const action = raw as Record<string, unknown>;
  if (typeof action.type !== 'string' || !ALLOWED.has(action.type)) return null;
  for (const value of Object.values(action)) {
    const kind = typeof value;
    if (kind !== 'string' && kind !== 'number' && kind !== 'boolean') return null;
  }
  return action as unknown as Action;
}

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
        tabs.push(fresh(tab.id));
        continue;
      }
      if (typeof tab.screen !== 'string' || !known(tab.screen)) continue;
      const screen = tab.screen as Screen;
      const place = Array.isArray(tab.place)
        ? tab.place.map(placeAction).filter((a): a is Action => a !== null)
        : [];
      tabs.push({
        id: tab.id,
        screen,
        title: typeof tab.title === 'string' && tab.title ? tab.title : screen,
        ...(typeof tab.query === 'string' && tab.query ? { query: tab.query } : {}),
        // A tab whose place did not survive the check still knows its screen,
        // so it lands you there rather than nowhere. Losing the deadline you
        // had open is a smaller failure than a tab that does nothing.
        place: place.length > 0 ? place : justGo(screen),
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
