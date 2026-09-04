/**
 * Which screens sit in the bottom bar.
 *
 * The bar was seven screens chosen once, in a source file, by someone
 * guessing at what a student opens most. It is a reasonable guess and it is
 * wrong for most people: somebody with no classes across campus never opens
 * the map, and somebody drafting a thesis wants Essay in the bar rather than
 * three taps down a directory. Meanwhile every one of the forty-two screens
 * in `lib/nav.ts` is reachable, so the bar is not about what exists — it is
 * about which five things are worth one tap instead of three.
 *
 * ## What is fixed and why
 *
 * Me stays, always, in the last slot. It is the directory: it is how you get
 * to the other thirty-odd screens, to settings, and to this list itself. A
 * student who could remove it could arrange a phone with no route back —
 * the header's Me button only appears in one of the two nav modes, and
 * telling somebody to reinstall the app to undo a preference is not a
 * preference, it is a trap.
 *
 * Everything else is theirs, between two and six of them.
 */

import { DESTINATIONS, destination, rootOf } from './nav';
import type { Screen } from './types';

/** The bar as it shipped. Still the answer for most people, so still default. */
export const DEFAULT_TABS: Screen[] = [
  'home',
  'courses',
  'study',
  'calendar',
  'maps',
  'mine',
  'me',
];

/**
 * Seven, because seven is what fits.
 *
 * At 402px seven tabs leave about 57px each, which is where "CALENDAR" stops
 * fitting on one line at the bar's tracking. An eighth would either shrink
 * the labels below reading size or make the bar two rows tall on every
 * screen in the app.
 */
export const MOST = 7;

/** Below three the bar is a worse directory than the Me screen already is. */
export const FEWEST = 3;

/** The one that cannot be removed. See the note at the top of this file. */
export const PINNED: Screen = 'me';

/** How many the student actually chooses, once the pinned one is counted. */
export const MOST_CHOSEN = MOST - 1;
export const FEWEST_CHOSEN = FEWEST - 1;

/** Every screen that may go in the bar, in the order the directory lists them. */
export function choosable(): Screen[] {
  return DESTINATIONS.filter((d) => d.screen !== PINNED).map((d) => d.screen);
}

/**
 * A stored list, made safe to render.
 *
 * Anything could be in here: a screen removed in a later version, the same
 * screen twice after a sync collision, an empty array from a half-written
 * save, or nothing at all on a first run. All of those come back as a bar
 * that works, because a navigation bar is the one component that cannot
 * afford to render nothing.
 */
export function readTabs(saved: unknown): Screen[] {
  if (!Array.isArray(saved)) return DEFAULT_TABS;

  const known = new Set(DESTINATIONS.map((d) => d.screen));
  const out: Screen[] = [];
  for (const item of saved) {
    const screen = item as Screen;
    // Unknown screens are dropped rather than kept as dead buttons, and the
    // pinned one is skipped here so it can be appended in its own slot.
    if (typeof item !== 'string' || !known.has(screen) || screen === PINNED) continue;
    if (!out.includes(screen)) out.push(screen);
    if (out.length === MOST_CHOSEN) break;
  }

  if (out.length < FEWEST_CHOSEN) return DEFAULT_TABS;
  return [...out, PINNED];
}

/** Whether the list as it stands has room for another. */
export function hasRoom(chosen: Screen[]): boolean {
  return chosen.filter((s) => s !== PINNED).length < MOST_CHOSEN;
}

/**
 * Add or remove one, returning the new list.
 *
 * Refuses in both directions rather than doing something surprising: the list
 * comes back unchanged when the bar is full or when removing would take it
 * below the floor. `whyNot` says which, for the sentence shown next to it.
 */
export function toggleTab(chosen: Screen[], screen: Screen): Screen[] {
  if (screen === PINNED) return chosen;
  const picked = chosen.filter((s) => s !== PINNED);

  if (picked.includes(screen)) {
    if (picked.length <= FEWEST_CHOSEN) return chosen;
    return [...picked.filter((s) => s !== screen), PINNED];
  }

  if (picked.length >= MOST_CHOSEN) return chosen;
  return [...picked, screen, PINNED];
}

/** Why a tap did nothing, or empty when it would have worked. */
export function whyNot(chosen: Screen[], screen: Screen): string {
  if (screen === PINNED) return 'Me stays — it is how you reach everything else.';
  const picked = chosen.filter((s) => s !== PINNED);
  if (picked.includes(screen)) {
    return picked.length <= FEWEST_CHOSEN
      ? `Keep at least ${FEWEST_CHOSEN}. Take another one out first.`
      : '';
  }
  return picked.length >= MOST_CHOSEN
    ? `The bar holds ${MOST}. Take one out to make room.`
    : '';
}

/** Move one up or down the bar. Out-of-range moves leave the list alone. */
export function moveTab(chosen: Screen[], screen: Screen, by: -1 | 1): Screen[] {
  const picked = chosen.filter((s) => s !== PINNED);
  const at = picked.indexOf(screen);
  const to = at + by;
  if (at === -1 || to < 0 || to >= picked.length) return chosen;
  const out = [...picked];
  out.splice(at, 1);
  out.splice(to, 0, screen);
  return [...out, PINNED];
}

/**
 * Which tab should look active.
 *
 * `rootOf` answers this for the shipped bar, where every screen is either a
 * tab or nested under one. A chosen bar breaks that: put Essay in it and
 * `rootOf('essay')` still says Make's root, which is not in the bar — so the
 * bar would light nothing while you stood on the very screen it holds. The
 * screen itself wins whenever it is there.
 */
export function litTab(screen: Screen, chosen: Screen[]): Screen | null {
  if (chosen.includes(screen)) return screen;
  const root = rootOf(screen);
  return chosen.includes(root) ? root : null;
}

/**
 * The name the bar shows.
 *
 * The directory's own label where it fits, and the short one where it does
 * not — "Fold in an announcement" is a good sentence for a list of places
 * and will not go in a tab.
 */
export function tabLabel(screen: Screen): string {
  const d = destination(screen);
  return d?.short ?? d?.label ?? screen;
}
