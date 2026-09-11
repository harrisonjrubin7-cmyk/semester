/**
 * The app as a home screen: pages of icons, folders, and a dock.
 *
 * An alternate way in, not a replacement. The tab bar is right for somebody who
 * lives in four screens; a springboard is right for somebody who has forty-six
 * and wants to see them. Both stay, and the choice is in Settings, because
 * which one is better genuinely depends on the person rather than on us.
 *
 * ## The layout is data, and it comes from the same list as everything else
 *
 * The pages below name screens by id, and every id is resolved against
 * `lib/nav.ts` — the one directory the app already keeps. That matters more
 * than it sounds: a springboard with its own copy of "which screens exist" is a
 * second list to update, and the second list is the one that gets forgotten
 * when a screen is added or renamed.
 *
 * It also means capability gating is free. A screen this school has no
 * equivalent of is filtered out of `offered()` and simply does not appear here
 * — no error, no gap where an icon should be. A folder that empties disappears
 * with it rather than opening onto nothing.
 *
 * ## What is missing from a page is not missing from the app
 *
 * The three pages are an arrangement, not an inventory. Anything not placed by
 * hand lands on a final page rather than being unreachable, because a launcher
 * that silently hides a screen is worse than one with an untidy last page.
 */

import { arranged, readLists, writeLists } from './arrange';
import { DESTINATIONS, offered } from './nav';
import { DEFAULT_ROLE, type Role } from './role';
import { has } from './search';
import type { Capabilities } from './school';

export interface Folder {
  label: string;
  screens: string[];
}

export interface Page {
  /** Whether this page carries the live widgets above its icons. */
  widgets: boolean;
  items: (string | Folder)[];
}

/** Four along the bottom, on every page. The ones opened daily. */
export const DOCK = ['home', 'calendar', 'study', 'me'];

/**
 * The arrangement, by hand.
 *
 * First page is the day: what is due, what is next, what you are working on.
 * Second is the work itself with the rest folded away. Third is upkeep — the
 * things you touch weekly rather than daily.
 */
export const PAGES: Page[] = [
  {
    widgets: true,
    items: ['home', 'brief', 'calendar', 'courses', 'runway', 'work', 'ask'],
  },
  {
    widgets: false,
    items: [
      'study',
      'exam',
      'solve',
      'tonight',
      'proof',
      'analyse',
      'ahead',
      { label: 'Make', screens: ['write', 'sheet', 'draw', 'equations', 'sources', 'essay', 'deck'] },
      {
        label: 'Campus',
        screens: ['meals', 'housing', 'maps', 'classmates', 'groupwork', 'costs', 'yes', 'mail', 'activities'],
      },
      { label: 'Upkeep', screens: ['import', 'edit', 'update', 'announce', 'brief'] },
      { label: 'Yours', screens: ['mine', 'account', 'connect', 'export', 'notifs'] },
    ],
  },
  {
    widgets: false,
    items: [
      'behind',
      'degree',
      'registrar',
      'people',
      'applying',
      'clocks',
      'costs',
      'settings',
    ],
  },
];

const isFolder = (i: string | Folder): i is Folder => typeof i !== 'string';

/** Every screen id the arrangement places, dock included. */
export function placed(): string[] {
  const out = [...DOCK];
  for (const page of PAGES) {
    for (const item of page.items) {
      if (isFolder(item)) out.push(...item.screens);
      else out.push(item);
    }
  }
  return [...new Set(out)];
}

/**
 * The pages this student actually gets.
 *
 * Filtered against what the school has and against what the directory knows —
 * an id here that names no real screen is dropped rather than drawn as an icon
 * that goes nowhere. Empty folders and empty pages go with it.
 */
export function pagesFor(caps: Capabilities, role: Role = DEFAULT_ROLE): Page[] {
  const can = new Set(offered(caps, role).map((d) => d.screen as string));
  const pages: Page[] = [];
  for (const page of PAGES) {
    const items: (string | Folder)[] = [];
    for (const item of page.items) {
      if (isFolder(item)) {
        const screens = item.screens.filter((s) => can.has(s));
        if (screens.length > 0) items.push({ label: item.label, screens });
      } else if (can.has(item)) {
        items.push(item);
      }
    }
    if (items.length > 0) pages.push({ widgets: page.widgets, items });
  }

  /*
   * Whatever the arrangement forgot.
   *
   * A launcher that silently hides a screen is worse than one with an untidy
   * last page — and this is what catches a screen added to the directory and
   * not placed here, which will happen, because the two lists are edited months
   * apart.
   */
  const seen = new Set(placed());
  const rest = offered(caps, role)
    .map((d) => d.screen as string)
    .filter((s) => !seen.has(s));
  if (rest.length > 0) pages.push({ widgets: false, items: rest });
  return pages;
}

/**
 * Where an icon has been dragged to, and what it is filed under.
 *
 * ## The arrangement above is a starting point, not a home screen
 *
 * `PAGES` is somebody's opinion about which eight screens belong on the first
 * page — a good one, and still an opinion. A home screen whose icons cannot be
 * moved is the one screen in the app that is a picture of a home screen rather
 * than one, and every phone anybody owns has taught them otherwise: you hold
 * an icon and you put it where you want it.
 *
 * ## Saved as a preference over the pages, never as a copy of them
 *
 * Three lists get their own name in the look key: each page by its number,
 * each folder by its label, and the dock. Every one of them is resolved
 * through `arranged()` against what `pagesFor` offers today, so the same
 * three guarantees hold as everywhere else — a screen the school switched off
 * stays off, a screen added since appears at the end of its page rather than
 * nowhere, and a name that is no longer anything is dropped.
 *
 * That is also why the arrangement is per page rather than one flat list: a
 * screen can sit on two pages (`costs` does) and inside a folder as well as
 * outside it (`brief` does), and one list of names could not say which of
 * those moved.
 */
export const DOCK_KEY = 'dock';

/** The saved-order name for page `i`, for a folder, and for either item. */
export function pageKey(i: number): string {
  return `p${i}`;
}

export function folderKey(label: string): string {
  return `+${label}`;
}

export function keyOf(item: string | Folder): string {
  return isFolder(item) ? folderKey(item.label) : item;
}

/** The pages this student gets, in the order they have dragged them into. */
export function arrangedPages(
  caps: Capabilities,
  saved: string | undefined,
  role: Role = DEFAULT_ROLE,
): Page[] {
  const lists = readLists(saved);
  return pagesFor(caps, role).map((page, i) => {
    const byKey = new Map(page.items.map((item) => [keyOf(item), item]));
    const items = arranged([...byKey.keys()], lists[pageKey(i)] ?? []).map((k) => {
      const item = byKey.get(k)!;
      // A folder's own icons are arrangeable too — it is a grid of icons like
      // any other, and the one somebody opens it for should not be fourth.
      if (!isFolder(item)) return item;
      return {
        label: item.label,
        screens: arranged(item.screens, lists[folderKey(item.label)] ?? []),
      };
    });
    return { widgets: page.widgets, items };
  });
}

/** The dock, arranged. Four icons, and which four is the point of them. */
export function arrangedDock(
  caps: Capabilities,
  saved: string | undefined,
  role: Role = DEFAULT_ROLE,
): string[] {
  return arranged(dockFor(caps, role), readLists(saved)[DOCK_KEY] ?? []);
}

/**
 * The look key after one drag.
 *
 * The whole of the list that moved is written down, not the pair that swapped
 * — a partial order leaves the rest at the mercy of the next screen anybody
 * adds to `PAGES`, which is precisely the arrangement a person would have to
 * make again.
 */
export function afterMove(saved: string | undefined, list: string, items: string[]): string {
  return writeLists({ ...readLists(saved), [list]: items });
}

/** The dock, minus anything this school does not have. */
export function dockFor(caps: Capabilities, role: Role = DEFAULT_ROLE): string[] {
  const can = new Set(offered(caps, role).map((d) => d.screen as string));
  return DOCK.filter((s) => can.has(s));
}

/**
 * The home screen's arrangement, as flat lists something can put arrows on.
 *
 * The board is arranged by dragging its icons, and dragging was the only way:
 * `boardOrder` is written from `Springboard.tsx` and from nowhere else. That
 * leaves out anybody who can work a pointer but cannot hold one still while
 * moving it — a tremor, a head pointer, an eye tracker — and on a tablet
 * there is no keyboard to fall back on either, so Alt with the arrow keys is
 * not the answer it is for a laptop. WCAG 2.2 puts it plainly at 2.5.7: what
 * a drag does, a single pointer has to be able to do without dragging.
 *
 * Three other orderings in this app already had one, all three by way of the
 * `Reorder` arrows — the courses, the tab bar, and Today's sections, that last
 * one on the settings page rather than on Today. This is the same answer for
 * the board: name every list it holds, and let the settings page draw them.
 *
 * A page's icons, each folder on that page, and the dock are separate lists
 * with separate keys, because that is how they are stored — see the note on
 * `pageKey` above for why the arrangement cannot be one flat list.
 */
export interface BoardList {
  /** The key this list is saved under: `p0`, `+Study`, `dock`. */
  key: string;
  /** What to call it on the settings page. */
  label: string;
  /** The screen ids in it, in their arranged order, with their captions. */
  items: { id: string; label: string }[];
}

export function boardLists(
  caps: Capabilities,
  saved: string | undefined,
  role: Role = DEFAULT_ROLE,
): BoardList[] {
  const out: BoardList[] = [];
  arrangedPages(caps, saved, role).forEach((page, i) => {
    out.push({
      key: pageKey(i),
      label: `Page ${i + 1}`,
      items: page.items.map((item) =>
        isFolder(item)
          ? { id: folderKey(item.label), label: `${item.label} (folder)` }
          : { id: item, label: labelFor(item) },
      ),
    });
    // A folder's own icons are a list of their own, and the one somebody
    // opens it for should not be stuck fourth because it cannot be dragged.
    for (const item of page.items) {
      if (!isFolder(item)) continue;
      out.push({
        key: folderKey(item.label),
        label: `${item.label} folder`,
        items: item.screens.map((s) => ({ id: s, label: labelFor(s) })),
      });
    }
  });
  out.push({
    key: DOCK_KEY,
    label: 'Dock',
    items: arrangedDock(caps, saved, role).map((s) => ({ id: s, label: labelFor(s) })),
  });
  // A list of one cannot be reordered, and a row of arrows that can never do
  // anything is worse than no row at all.
  return out.filter((l) => l.items.length > 1);
}

/** A screen's label for an icon, from the one directory. */
export function labelFor(screen: string): string {
  const d = DESTINATIONS.find((x) => x.screen === screen);
  // `short` where the directory has one — an icon caption has about nine
  // characters before it wraps, which is the same budget the tab bar has.
  return d?.short ?? d?.label ?? screen;
}

/**
 * What a search across the springboard matches.
 *
 * The same ranked scoring `lib/find.ts` uses would be better, but this runs on
 * every keystroke over forty-six items, and an icon you can already see needs
 * finding rather than ordering. So it is the plain substring test every
 * in-screen filter in the app uses — `has`, from `lib/search.ts` — over the
 * words the directory already holds.
 *
 * The blurb is one of those words now. It was not, and the difference showed:
 * the directory's own sentence for a screen is what the shelves print under
 * it and what Everything matches on, so a word somebody had just read there
 * found the screen in one place and nothing in the other. Whatever the
 * registry says about a screen is searchable, everywhere.
 */
export function matches(screen: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const d = DESTINATIONS.find((x) => x.screen === screen);
  if (!d) return false;
  return has(q, d.label, d.short, d.blurb, d.keywords);
}

/** Everything on offer, flattened, for the search results grid. */
export function searchable(caps: Capabilities, role: Role = DEFAULT_ROLE): string[] {
  return offered(caps, role).map((d) => d.screen as string);
}
