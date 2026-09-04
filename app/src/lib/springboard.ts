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

import { DESTINATIONS, offered } from './nav';
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
    items: ['home', 'brief', 'calendar', 'courses', 'grades', 'runway', 'work', 'ask'],
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
      'check',
      { label: 'Make', screens: ['draw', 'sources', 'essay', 'deck'] },
      {
        label: 'Campus',
        screens: ['meals', 'housing', 'maps', 'classmates', 'groupwork', 'costs', 'yes', 'mail', 'activities'],
      },
      { label: 'Upkeep', screens: ['import', 'edit', 'update', 'announce', 'weekly', 'worked'] },
      { label: 'Yours', screens: ['mine', 'account', 'connect', 'cloud', 'export', 'notifs'] },
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
export function pagesFor(caps: Capabilities): Page[] {
  const can = new Set(offered(caps).map((d) => d.screen as string));
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
  const rest = offered(caps)
    .map((d) => d.screen as string)
    .filter((s) => !seen.has(s));
  if (rest.length > 0) pages.push({ widgets: false, items: rest });
  return pages;
}

/** The dock, minus anything this school does not have. */
export function dockFor(caps: Capabilities): string[] {
  const can = new Set(offered(caps).map((d) => d.screen as string));
  return DOCK.filter((s) => can.has(s));
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
 * The same scoring the app's own search uses would be better, but this runs on
 * every keystroke over forty-six items and a substring match on the label and
 * the directory's keywords is enough to find an icon you can already see.
 */
export function matches(screen: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const d = DESTINATIONS.find((x) => x.screen === screen);
  if (!d) return false;
  return `${d.label} ${d.short ?? ''} ${d.keywords}`.toLowerCase().includes(q);
}

/** Everything on offer, flattened, for the search results grid. */
export function searchable(caps: Capabilities): string[] {
  return offered(caps).map((d) => d.screen as string);
}
