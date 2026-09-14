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
  /**
   * Kept at the front of the strip, as its glyph alone.
   *
   * The four or five places somebody is in every day — Today, the calendar,
   * the guide they are working through — are not "open" in the sense the rest
   * of the strip means it: they are never finished with, and they are what
   * everything else is opened *next to*. A pinned tab says so: it takes a
   * glyph's width rather than a name's, it sits before everything, and it has
   * no cross on it, because closing one by a thumb landing an inch left of
   * where it meant to is the whole reason browsers took the cross away.
   */
  pinned?: boolean;
  /**
   * The group this tab belongs to, if it is in one.
   *
   * The id of a `TabGroup` in the same strip, never the group itself: a tab
   * is written to the device on every navigation and a group is renamed and
   * recoloured from a menu, so a copy of the group on each of its tabs would
   * be four places to rename and three of them stale. `tidy` below drops an
   * id no group answers to rather than trusting it.
   */
  group?: string;
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
  openUnit?: number;
  callCode?: string;
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
      return at.courseId ? [{ type: 'openCourse', id: at.courseId }] : justGo(screen);
    case 'edit':
      return at.courseId ? [{ type: 'openCourse', id: at.courseId }, { type: 'go', screen: 'edit' }] : justGo(screen);
    case 'item':
      return at.itemId ? [{ type: 'openItem', id: at.itemId }] : justGo(screen);
    case 'event':
      return at.eventId ? [{ type: 'openEvent', id: at.eventId }] : justGo(screen);
    case 'guide':
      return at.guideId ? [{ type: 'openGuide', id: at.guideId, mode: at.mode, ...(at.openUnit!==undefined?{unit:at.openUnit}:{}) }] : justGo(screen);
    case 'drill':
    case 'quiz':
    case 'lesson':
    case 'slides':
      return at.guideId
        ? [{ type: 'openGuide', id: at.guideId, mode: at.mode, ...(at.openUnit!==undefined?{unit:at.openUnit}:{}) }, { type: 'go', screen }]
        : justGo(screen);
    case 'call':
      return at.callCode ? [{type:'openCall',code:at.callCode}] : justGo(screen);
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

/**
 * A group: several tabs under one name, in one colour.
 *
 * The strip solved "I was reading the guide, let me check when it is due" and
 * created the problem every browser user already has by Wednesday — nine tabs
 * across the top, four of them about the essay, three about the exam, and no
 * way to tell which is which without reading all nine. A group is the answer
 * browsers landed on: say that these four are the essay, and the strip says it
 * for you from then on.
 *
 * It is worth more here than in a browser, because the tabs are not nine
 * websites with nine favicons — they are nine screens of the same app, drawn
 * in the same materials, and a row of them is genuinely hard to read at a
 * glance. The colour is doing work no favicon is doing.
 */
export interface TabGroup {
  /** Stable for the life of the group; what a tab's `group` points at. */
  id: string;
  /**
   * What it is called, or empty.
   *
   * Empty is a real state and not a missing one: a browser lets you group
   * three tabs with one gesture and name them never, and the colour alone is
   * enough to read the strip. An unnamed group draws as its dot.
   */
  name: string;
  /**
   * Which of the reader's own twelve colours it wears, as an index.
   *
   * An index rather than a hex, because the palette is not fixed: every
   * colour in this app is derived from the accent somebody chose, and the
   * twelve a group picks from are `tintChoices` in `lib/tint.ts` — the same
   * twelve a course is pinned to. Storing the hex would freeze a group at the
   * colour their old accent made, and a reader who moves from Sterling to
   * Copper would find one row of the app left behind.
   */
  tone: number;
  /**
   * Whether the strip is showing its tabs or only its name.
   *
   * The whole point of a group on a full strip: four tabs fold into one chip
   * that still says what they are, and the room goes to whatever you are
   * actually doing. Collapsing the group you are working in would hide the
   * page you are looking at, so `collapse` below moves you out first.
   */
  collapsed: boolean;
}

/** How many colours a group can be, which is how many `tintChoices` gives. */
export const GROUP_TONES = 12;

/** How long a group's name may be. A strip is not a place for a sentence. */
export const GROUP_NAME = 24;

/** The strip: what is open, which one of them is on, and how they are grouped. */
export interface Strip {
  tabs: AppTab[];
  at: number;
  /**
   * The groups, in no particular order — the tabs carry the order.
   *
   * A list rather than a map by id, so it survives `JSON.parse` as the same
   * shape it was written in and so `load` can filter it with one pass.
   */
  groups: TabGroup[];
}

/** What a tab with nothing in it is called, in the strip and in the title. */
export const NEW_TAB = 'New tab';

/**
 * How many tabs the strip will hold.
 *
 * Ten was chosen when the strip drew every tab at once, where past about that
 * many each one is a favicon and half a letter, and a tab you cannot read is
 * not a tab you can return to. The strip scrolls and folds groups now, so
 * legibility is no longer what the number is protecting: a run folded to its
 * name costs one slot however many tabs are in it, and the row carries the
 * ones you are actually working in.
 *
 * So the cap is high enough to stop being a limit anybody meets by accident,
 * and stays a cap only to bound what is written to the device and replayed on
 * load. When it is reached the strip refuses rather than making room — see
 * `add` — because the tab that would give way is a page somebody meant to
 * come back to.
 */
export const MAX_TABS = 100;

/** Ids that are unique within a session and readable in a React tree. */
let counter = 0;
export function tabId(): string {
  counter += 1;
  return `tab-${Date.now().toString(36)}-${counter}`;
}

/** The same, for a group. Its own prefix, so a stray id is obvious in a store. */
export function groupId(): string {
  counter += 1;
  return `group-${Date.now().toString(36)}-${counter}`;
}

/** A tab with nothing in it — the search page. */
export function fresh(id: string = tabId()): AppTab {
  return { id, screen: null, title: NEW_TAB, place: [] };
}

/** The strip somebody who has never opened one gets. */
export function blank(id: string = tabId()): Strip {
  return { tabs: [fresh(id)], at: 0, groups: [] };
}

/** The tab that is on, which is always one of them. */
export function current(strip: Strip): AppTab {
  return strip.tabs[clamp(strip, strip.at)];
}

function clamp(strip: Strip, at: number): number {
  return Math.min(Math.max(0, Number.isFinite(at) ? Math.trunc(at) : 0), Math.max(0, strip.tabs.length - 1));
}

/**
 * Open a new tab beside the one you are on, and go to it.
 *
 * Beside rather than at the end, which is the one detail everybody notices
 * when it is wrong: a tab opened out of this one belongs next to this one, or
 * the strip stops being in any order at all by the fourth tab.
 */
export function add(strip: Strip, id: string = tabId()): Strip {
  /*
   * A full strip refuses rather than making room.
   *
   * It used to drop the oldest tab that was not in use, which reads as tidying
   * and is actually deletion: the tab that goes is a page somebody opened and
   * meant to come back to, and opening a search result is not consent to lose
   * it. The cap is high enough now (see `MAX_TABS`) that reaching it is a
   * deliberate act, and the callers say so rather than quietly obliging.
   */
  if (strip.tabs.length >= MAX_TABS) return strip;
  const at = clamp(strip, strip.at) + 1;
  /*
   * And it joins the group it was opened out of.
   *
   * Beside a grouped tab is *inside* that group — both because it is what
   * every browser does, and because the alternative is not available here: a
   * group's tabs are one run in the strip, and a loose tab dropped into the
   * middle of that run would split it in two. Opening a tab from inside the
   * essay group is nearly always another tab about the essay anyway.
   */
  const from = strip.tabs[clamp(strip, strip.at)];
  // Beside a *pinned* tab is not pinned, and is in no group either: a new tab
  // is a place nobody has decided about yet, and pinning is a decision.
  // `tidy` puts it at the head of the working strip.
  const born = from?.group && !from.pinned ? { ...fresh(id), group: from.group } : fresh(id);
  return { ...strip, tabs: [...strip.tabs.slice(0, at), born, ...strip.tabs.slice(at)], at };
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
  // `tidy` because the tab that just left may have been the last one in its
  // group, and a group with nothing in it is a name in the store nobody can
  // see or remove.
  return tidy({ ...strip, tabs, at: Math.min(next, tabs.length - 1) });
}

/**
 * Go to a tab. Out-of-range is clamped rather than thrown: it is a click.
 *
 * A tab inside a collapsed group opens the group on the way. Nothing else can
 * happen: its page is about to be the whole window, and a strip claiming it is
 * folded away would be lying about where you are. This is also what makes the
 * keyboard and the restored-strip cases safe, where the landing is not a click
 * on something visible.
 */
export function select(strip: Strip, which: number): Strip {
  const at = clamp(strip, which);
  const held = strip.tabs[at]?.group;
  const shut = held ? strip.groups.find((g) => g.id === held && g.collapsed) : undefined;
  if (!shut) return { ...strip, at };
  return {
    ...strip,
    at,
    groups: strip.groups.map((g) => (g.id === shut.id ? { ...g, collapsed: false } : g)),
  };
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
  return { ...strip, tabs, at };
}

/** What this tab last searched for. Empty forgets it. */
export function asked(strip: Strip, query: string): Strip {
  const at = clamp(strip, strip.at);
  const tab = strip.tabs[at];
  if (!tab || (tab.query ?? '') === query) return strip;
  const tabs = [...strip.tabs];
  tabs[at] = { ...tab, query: query || undefined };
  return { ...strip, tabs, at };
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
  const next=add(strip,id);
  return next===strip?strip:visit(next, screen, title, place);
}

/**
 * The strip, put back in order after anything that could have broken it.
 *
 * Two rules, both invisible until they are broken. **A group is one run of
 * tabs**: its members sit next to each other, because a group drawn as two
 * halves with somebody else's tab between them is not a group, it is a
 * colour repeated twice. And **a group has members**: the last tab leaving
 * takes the group with it, or the store fills up with names for rows that are
 * not there and a colour comes back the next time that id is reused.
 *
 * Every structural change runs through here rather than each one remembering
 * to hold the invariants itself — closing a tab, evicting one, joining a
 * group, reading a strip off the device.
 *
 * A strip that already holds is returned as it came, by reference. This is
 * called on paths that run on every navigation, and a new object each time is
 * a re-render of the strip each time.
 */
export function tidy(strip: Strip): Strip {
  const named = new Set(strip.groups.map((g) => g.id));
  // An id no group answers to is dropped rather than repaired: it came from
  // an older build or a half-written store, and the honest reading of a tab
  // pointing at nothing is a tab in no group. A pinned tab is in none either:
  // it is kept apart from the working strip, and a group with one end in the
  // pinned run would be a group drawn in two places.
  const tabs = strip.tabs.map((t) =>
    t.group && (t.pinned || !named.has(t.group)) ? loose(t) : t,
  );

  const order: AppTab[] = [];
  const done = new Set<string>();
  // The pinned ones first, in the order they were pinned in. This is the
  // second invariant the strip holds: everything pinned is before everything
  // that is not, so the four places you are always in stay where your eye
  // goes for them however the rest of the strip churns.
  for (const tab of tabs) {
    if (tab.pinned) {
      order.push(tab);
      done.add(tab.id);
    }
  }
  for (const tab of tabs) {
    if (done.has(tab.id)) continue;
    if (!tab.group) {
      order.push(tab);
      done.add(tab.id);
      continue;
    }
    // The whole run, at the position of its first member, in the order the
    // members were already in: a group closes up rather than jumping to the
    // end of the strip the moment somebody adds a fifth tab to it.
    for (const mate of tabs) {
      if (mate.group === tab.group) {
        order.push(mate);
        done.add(mate.id);
      }
    }
  }

  const groups = strip.groups.filter((g) => order.some((t) => t.group === g.id));
  const on = strip.tabs[clamp(strip, strip.at)];
  const at = Math.max(0, order.findIndex((t) => t.id === on?.id));
  const same =
    groups.length === strip.groups.length &&
    order.length === strip.tabs.length &&
    order.every((t, i) => t === strip.tabs[i]) &&
    at === strip.at;
  return same ? strip : { tabs: order, at, groups };
}

/** The same tab, out of whatever group it was in. */
function loose(tab: AppTab): AppTab {
  const { group: _out, ...rest } = tab;
  return rest;
}

/**
 * Pin a tab, or let it go back to the working strip.
 *
 * Pinning takes a tab out of its group on the way — a group is a piece of
 * work with several tabs in it, and a pinned tab is the opposite of that, one
 * place kept to hand. `tidy` would do it anyway; doing it here is what makes
 * the reason legible at the call rather than inferred from an invariant.
 *
 * Nothing else moves. The tab that is on is still on, wherever `tidy` has put
 * it: pinning the thing you are looking at must not take you somewhere else.
 */
export function pin(strip: Strip, which: number, pinned = true): Strip {
  const tab = strip.tabs[which];
  if (!tab || Boolean(tab.pinned) === pinned) return strip;
  const tabs = [...strip.tabs];
  tabs[which] = pinned ? { ...loose(tab), pinned: true } : unpinned(tab);
  return tidy({ ...strip, tabs });
}

/** The same tab, no longer pinned — the key removed rather than set false. */
function unpinned(tab: AppTab): AppTab {
  const { pinned: _out, ...rest } = tab;
  return rest;
}

/** How many tabs are pinned, which is where the working strip begins. */
export function pinnedCount(strip: Strip): number {
  return strip.tabs.filter((t) => t.pinned).length;
}

/**
 * The strip, reordered by a drag — and what the new position means.
 *
 * Dragging a tab is not only "put it there". On a strip with groups on it,
 * where a tab lands says which work it belongs to, and a browser answers that
 * without being asked: dropped between two tabs of a group it joins the
 * group, dragged out from among them it leaves. Anything else makes `tidy`
 * fight the finger — a tab dropped inside a run would be pulled straight back
 * out of it, and the drag would look broken rather than considered.
 *
 * The rule, in the order it is asked:
 *
 * 1. **Still touching its own group?** Then it stays in it. This is what makes
 *    reordering *within* a group work: a tab dragged to the front of its own
 *    run has a stranger on its left and its own group on its right, and a rule
 *    that only looked at both sides would throw it out of the group for
 *    arriving at the front of it.
 * 2. **Strictly inside another group** — the tabs on both sides are in one
 *    group — then it joins that one. Both sides, because the edge of a run is
 *    exactly where somebody drops a tab they want *beside* a group rather
 *    than in it.
 * 3. Otherwise it is a loose tab, wherever it came from.
 *
 * Rule 1 costs one thing, and it is the right thing to pay: a tab dragged one
 * slot past the end of its own run is still touching it, so it stays in the
 * group. A browser can tell that gesture from the one beside it because it
 * knows the group as a rectangle and the pointer as a point; a strip of ids
 * cannot, since the slot past the last member is also the slot beside it.
 * Between silently dropping a tab out of the work it belongs to and keeping
 * it in, this keeps it in — and "Remove from Midterm", in the tab's own menu,
 * is the way out that never has to guess.
 *
 * `order` is the ids as they are now drawn, which is what `dropped` in
 * `lib/arrange.ts` hands back — the one implementation of "it moved" this app
 * has. Ids it does not name keep their places behind the ones it does, so a
 * stale order cannot lose a tab.
 *
 * Pinning is not something a drag decides. A pinned tab dragged along the
 * strip stays pinned and `tidy` keeps it among the pinned ones; an unpinned
 * one let go among them lands at the head of the working strip instead, which
 * is the nearest place it can be. Pinning is a decision with a menu item on
 * it, and one a thumb should not be able to make by sliding an inch too far.
 */
export function rearrange(strip: Strip, order: string[], moved: string): Strip {
  const by = new Map(strip.tabs.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const tabs: AppTab[] = [];
  for (const id of order) {
    const tab = by.get(id);
    if (tab && !seen.has(id)) {
      tabs.push(tab);
      seen.add(id);
    }
  }
  // Anything the order did not name, in the order it already had. A drop can
  // land while a tab is closing in another window; losing it would be worse
  // than putting it at the end.
  for (const tab of strip.tabs) if (!seen.has(tab.id)) tabs.push(tab);

  const at = tabs.findIndex((t) => t.id === moved);
  if (at !== -1 && !tabs[at].pinned) {
    const own = tabs[at].group;
    const left = tabs[at - 1]?.group;
    const right = tabs[at + 1]?.group;
    const joins =
      own && (left === own || right === own) ? own
      : left && left === right ? left
      : undefined;
    tabs[at] = joins ? { ...tabs[at], group: joins } : loose(tabs[at]);
  }

  // The tab that was on is still the tab that is on: a drag rearranges the
  // strip, it does not go anywhere.
  const on = strip.tabs[clamp(strip, strip.at)];
  const now = Math.max(0, tabs.findIndex((t) => t.id === on?.id));
  return tidy({ ...strip, tabs, at: now });
}

/** The group a tab is in, or null. */
export function groupAt(strip: Strip, which: number): TabGroup | null {
  const held = strip.tabs[which]?.group;
  return (held && strip.groups.find((g) => g.id === held)) || null;
}

/** Which tabs are in a group, as indices into the strip. */
export function tabsIn(strip: Strip, id: string): number[] {
  return strip.tabs.flatMap((t, i) => (t.group === id ? [i] : []));
}

/**
 * The colour a new group gets, when nobody has picked one.
 *
 * The first of the twelve nothing is wearing, so three groups made in a row
 * are three colours rather than three of the same one, and only once all
 * twelve are out does it start again. See `tone` on `TabGroup` for why this
 * is an index rather than a colour.
 */
export function freeTone(strip: Strip): number {
  const worn = new Set(strip.groups.map((g) => g.tone));
  for (let i = 0; i < GROUP_TONES; i += 1) if (!worn.has(i)) return i;
  return strip.groups.length % GROUP_TONES;
}

/** Put a tab in a group of its own, and return the strip with it in. */
export function makeGroup(
  strip: Strip,
  which: number,
  name = '',
  tone = freeTone(strip),
  id: string = groupId(),
): Strip {
  if (which < 0 || which >= strip.tabs.length) return strip;
  const group: TabGroup = { id, name, tone: ((tone % GROUP_TONES) + GROUP_TONES) % GROUP_TONES, collapsed: false };
  const tabs = strip.tabs.map((t, i) => (i === which ? { ...t, group: id } : t));
  return tidy({ ...strip, tabs, groups: [...strip.groups, group] });
}

/** Move a tab into a group that already exists. It joins the end of its run. */
export function joinGroup(strip: Strip, which: number, id: string): Strip {
  if (!strip.groups.some((g) => g.id === id)) return strip;
  if (which < 0 || which >= strip.tabs.length) return strip;
  const tabs = strip.tabs.map((t, i) => (i === which ? { ...t, group: id } : t));
  return tidy({ ...strip, tabs });
}

/** Take a tab out of its group. The group goes too if it was the last one. */
export function leaveGroup(strip: Strip, which: number): Strip {
  const tab = strip.tabs[which];
  if (!tab?.group) return strip;
  const tabs = strip.tabs.map((t, i) => (i === which ? loose(t) : t));
  return tidy({ ...strip, tabs });
}

/** What a group is called. Empty is allowed: an unnamed group is its colour. */
export function renameGroup(strip: Strip, id: string, name: string): Strip {
  return overGroup(strip, id, (g) => ({ ...g, name: name.slice(0, GROUP_NAME) }));
}

/** Which of the twelve it wears. */
export function toneGroup(strip: Strip, id: string, tone: number): Strip {
  return overGroup(strip, id, (g) => ({ ...g, tone: ((tone % GROUP_TONES) + GROUP_TONES) % GROUP_TONES }));
}

/**
 * Fold a group down to its name, or open it again.
 *
 * Folding the group you are working in would hide the page in front of you,
 * so the tab that is on moves out first — to its right-hand neighbour outside
 * the group, the way closing a tab does, and to the left when there is no
 * right. A strip that is nothing but this one group has nowhere to move to
 * and gets a new tab, which is the same answer `close` gives for the same
 * reason: the app always has a page, and the page it invents is the search
 * page.
 */
export function collapse(strip: Strip, id: string, shut: boolean): Strip {
  const group = strip.groups.find((g) => g.id === id);
  if (!group || group.collapsed === shut) return strip;
  const groups = strip.groups.map((g) => (g.id === id ? { ...g, collapsed: shut } : g));
  if (!shut || strip.tabs[clamp(strip, strip.at)]?.group !== id) return { ...strip, groups };

  const at = clamp(strip, strip.at);
  const out = (from: number, step: number) => {
    for (let i = from; i >= 0 && i < strip.tabs.length; i += step) {
      if (strip.tabs[i].group !== id) return i;
    }
    return -1;
  };
  const to = out(at + 1, 1) === -1 ? out(at - 1, -1) : out(at + 1, 1);
  if (to !== -1) return { ...strip, groups, at: to };
  const room = strip.tabs.length < MAX_TABS ? strip.tabs : strip.tabs.slice(1);
  return { tabs: [...room, fresh()], at: room.length, groups };
}

/** Undo the grouping. The tabs stay open and stay where they are. */
export function dissolve(strip: Strip, id: string): Strip {
  if (!strip.groups.some((g) => g.id === id)) return strip;
  return tidy({
    ...strip,
    tabs: strip.tabs.map((t) => (t.group === id ? loose(t) : t)),
    groups: strip.groups.filter((g) => g.id !== id),
  });
}

/** Close every tab in a group, which is the point of having named them. */
export function closeGroup(strip: Strip, id: string): Strip {
  const tabs = strip.tabs.filter((t) => t.group !== id);
  if (tabs.length === 0) return blank();
  const on = strip.tabs[clamp(strip, strip.at)];
  const kept = tabs.findIndex((t) => t.id === on?.id);
  /*
   * Where you land when the group you were in has gone: the first tab after
   * the run, or the last tab there is. Counted against the strip as it was,
   * so closing a group in the middle leaves you where the group was rather
   * than at the far end of the strip.
   */
  const after = strip.tabs.findIndex((t, i) => i > clamp(strip, strip.at) && t.group !== id);
  const at =
    kept !== -1
      ? kept
      : after === -1
        ? tabs.length - 1
        : Math.max(0, tabs.findIndex((t) => t.id === strip.tabs[after].id));
  return tidy({ ...strip, tabs, at, groups: strip.groups.filter((g) => g.id !== id) });
}

/** One change to one group, or the strip back unchanged. */
function overGroup(strip: Strip, id: string, edit: (g: TabGroup) => TabGroup): Strip {
  if (!strip.groups.some((g) => g.id === id)) return strip;
  return { ...strip, groups: strip.groups.map((g) => (g.id === id ? edit(g) : g)) };
}

/** A tab, with where it sits — what the strip draws and clicks. */
export interface Seat {
  tab: AppTab;
  at: number;
}

/** A run of the strip: one group and its tabs, or one tab on its own. */
export interface Lane {
  group: TabGroup | null;
  seats: Seat[];
}

/**
 * The strip as it is drawn: runs, left to right.
 *
 * Here rather than in the component because it is the shape of the strip
 * rather than a way of rendering it — the same answer the overlay's strip and
 * the workspace's strip both need, and a thing a test can hold without a DOM.
 * Collapsed groups keep their tabs in the lane; whether to draw them is the
 * component's business, and a lane that dropped them would make "four tabs"
 * unanswerable at exactly the moment it is worth saying.
 */
export function lanes(strip: Strip): Lane[] {
  const out: Lane[] = [];
  for (let i = 0; i < strip.tabs.length; i += 1) {
    const tab = strip.tabs[i];
    const group = tab.group ? (strip.groups.find((g) => g.id === tab.group) ?? null) : null;
    const last = out[out.length - 1];
    if (group && last?.group?.id === group.id) last.seats.push({ tab, at: i });
    else out.push({ group, seats: [{ tab, at: i }] });
  }
  return out;
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
  'openCall',
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
export function placeAction(raw: unknown): Action | null {
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
    const saved = JSON.parse(raw) as { tabs?: unknown; at?: unknown; groups?: unknown };
    const list = Array.isArray(saved.tabs) ? saved.tabs : [];
    const tabs: AppTab[] = [];
    for (const entry of list) {
      const tab = entry as Partial<AppTab>;
      if (typeof tab?.id !== 'string' || tabs.some(t=>t.id===tab.id)) continue;
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
        ...(typeof tab.group === 'string' && tab.group ? { group: tab.group } : {}),
        ...(tab.pinned === true ? { pinned: true } : {}),
        // A tab whose place did not survive the check still knows its screen,
        // so it lands you there rather than nowhere. Losing the deadline you
        // had open is a smaller failure than a tab that does nothing.
        place: place.length > 0 ? place : justGo(screen),
      });
    }
    if (tabs.length === 0) return blank();
    const at = typeof saved.at === 'number' ? saved.at : 0;
    const strip = { tabs: tabs.slice(0, MAX_TABS), at: 0, groups: storedGroups(saved.groups) };
    /*
     * `tidy` last, and it is doing real work rather than tidying.
     *
     * Everything above reads one entry at a time; the two things that make a
     * strip coherent are about the whole of it — a group whose members were
     * split by the tab cap above, a tab carrying the id of a group that was
     * dropped. Both are ordinary here rather than exotic, because the cap
     * cuts the list wherever it falls.
     */
    return tidy({ ...strip, at: clamp(strip, at) });
  } catch {
    return blank();
  }
}

/** The groups off the device, keeping only the ones that are a group. */
function storedGroups(raw: unknown): TabGroup[] {
  if (!Array.isArray(raw)) return [];
  const out: TabGroup[] = [];
  for (const entry of raw) {
    const group = entry as Partial<TabGroup>;
    if (typeof group?.id !== 'string' || !group.id) continue;
    out.push({
      id: group.id,
      name: typeof group.name === 'string' ? group.name.slice(0, GROUP_NAME) : '',
      // A tone off the end of the palette is wrapped rather than dropped: the
      // palette is twelve today and an older build may have had more, and a
      // group that comes back in the wrong colour is a smaller loss than a
      // group that comes back as no group at all.
      tone:
        typeof group.tone === 'number' && Number.isFinite(group.tone)
          ? ((Math.trunc(group.tone) % GROUP_TONES) + GROUP_TONES) % GROUP_TONES
          : 0,
      collapsed: group.collapsed === true,
    });
  }
  return out;
}

export function dump(strip: Strip): string {
  return JSON.stringify({ tabs: strip.tabs, at: clamp(strip, strip.at), groups: strip.groups });
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
