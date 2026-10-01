/**
 * Which screens sit in the bottom bar.
 *
 * The bar was seven screens chosen once, in a source file, by someone
 * guessing at what a student opens most. It is a reasonable guess and it is
 * wrong for most people: somebody with no classes across campus never opens
 * the map, and somebody drafting a thesis wants Essay in the bar rather than
 * three taps down a directory. Meanwhile every one of the sixty screens
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

import { nudged } from './arrange';
import { DESTINATIONS, destination, rootOf } from './nav';
import { allowed, type Capabilities } from './school';
import { DEFAULT_ROLE, forRole, type Role } from './role';
import type { Screen } from './types';

/**
 * The bar a new account starts with.
 *
 * Five, not seven. The bar held Today, Courses, Study, Calendar, Map, Personal
 * and Progress — and Map and Personal are both real screens that a new student
 * has nothing in yet. On the first run they are two of seven tabs promising
 * things that are empty, which makes the whole bar read as a menu of somebody
 * else's app rather than a place to start.
 *
 * Progress is always the last and is the way to everything else — it holds
 * the whole directory, so nothing is unreachable, only un-promoted.
 *
 * ## One tab per question, and Courses gave way to Support
 *
 * The bar held Today, Courses, Study, Calendar and Progress: four of the
 * navigation areas in `lib/navareas.ts` and two tabs for one of them, Learn.
 * What it did not hold was Help. "Who can help me" is the question a student
 * is least likely to go looking for and most likely to need at a bad moment,
 * and the one screen that answers it — Support — was four taps down the
 * directory. So the bar is now the front doors of five areas in the order a
 * day runs: what is now, when things fall, the work, who can help, how it is
 * going. Courses is one tap from Study and from every deadline, and one tick
 * from being back in the bar.
 *
 * This is the *default*, not the maximum. The bar still takes up to seven and
 * Courses, Map and Personal are one tick from being back in it — see
 * Settings, Navigation. And because `tabs` is saved state, anybody who
 * already has this app has their own bar already and sees no change at all:
 * this is what a fresh install starts from.
 */
export const DEFAULT_TABS: Screen[] = ['home', 'calendar', 'study', 'support', 'me'];

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

/**
 * The bar as it can actually be drawn, given who is holding the phone.
 *
 * `readTabs` makes a stored list safe — no unknown screens, no duplicates,
 * never empty. It cannot make it *appropriate*, because a saved bar is a
 * saved bar and the gates move underneath it: switch to Teaching with Money
 * in the bar and the directory stops offering Money while the bar keeps
 * carrying it, one tap from a screen the role is meant to hide. Switching
 * schools does the same, and has always done it — this is the older hole,
 * reachable only by people who move university and therefore never reported.
 *
 * Filtered rather than rewritten, so nothing is lost: the stored order still
 * holds Money, and switching back brings it straight back. A bar is the one
 * component that cannot render nothing, so a filter that empties it falls
 * back the same way `readTabs` does.
 */
export function barFor(saved: Screen[], c: Capabilities, role: Role = DEFAULT_ROLE): Screen[] {
  const kept = saved.filter((s) => allowed(s, c) && forRole(s, role));
  // PINNED passes both gates by construction — `me` is on no gate's list — so
  // this only fires if a caller hands in a bar that never had it.
  const chosen = kept.filter((s) => s !== PINNED);
  if (chosen.length < FEWEST_CHOSEN) return DEFAULT_TABS;
  return kept.includes(PINNED) ? kept : [...kept, PINNED];
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
  const out = nudged(picked, screen, by);
  if (out === picked) return chosen;
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
 * The same question for the rail, which draws more than the bar does.
 *
 * `litTab` falls back to `rootOf` because on a phone that fallback is the only
 * indicator there is: Settings files under Me, there is no Settings tab, and
 * lighting Me at least says which shelf you are on. The rail has room to draw
 * those shelved screens as entries of their own, below the bar — so on the
 * rail the fallback lights the wrong row of a nav that is already showing the
 * right one. Standing on Settings lit Me, styled as the current page and
 * marked `aria-current="page"`, while Settings itself took a colour shift and
 * no more; a screen reader announced Progress as the page you were on.
 *
 * So a screen the rail lists itself is not "under" anything. Nesting is
 * untouched: Drill is not a rail entry, so it still lights Study.
 */
export function litRailTab(screen: Screen, chosen: Screen[], listed: Screen[]): Screen | null {
  return listed.includes(screen) ? null : litTab(screen, chosen);
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

// ── the five student destinations (D-003) ────────────────────────────────────

/**
 * Today, My Path, Search, Plan, Me — the blueprint's five, drawn over screens
 * that already exist. Nothing is renamed or moved: the ids, the hash routes and
 * `lib/nav.ts`'s shelves are untouched (`REGRESSION-CHECKLIST.md` §Q); only the
 * bar's five slots and their words change.
 *
 * Behind `journeyNavigation` as a rollback gate, and on in a normal build.
 * The five are fixed — the point is that they are the same for everyone — and
 * every contextual capability is still one tap away from its canonical home.
 */
export const FIVE_DESTINATIONS: Screen[] = ['home', 'degree', 'search', 'calendar', 'me'];

export const FIVE_LABELS: Partial<Record<Screen, string>> = {
  home: 'Today',
  degree: 'My Path',
  search: 'Search',
  calendar: 'Plan',
  me: 'Me',
};

/**
 * Which destination a screen lives under, from
 * `docs/ROUTE-AND-FEATURE-CROSSWALK.md`. Anything not named is under Me,
 * which is where the directory is.
 */
const UNDER: Partial<Record<Screen, Screen>> = {
  brief: 'home',
  behind: 'home',
  notifs: 'home',
  yes: 'degree',
  registrar: 'degree',
  pathway: 'degree',
  applying: 'degree',
  courses: 'degree',
  course: 'degree',
  item: 'degree',
  import: 'degree',
  edit: 'degree',
  announce: 'degree',
  ask: 'search',
  help: 'search',
  directory: 'search',
  hub: 'search',
  university: 'search',
  people: 'search',
  maps: 'search',
  links: 'search',
  opportunities: 'search',
  support: 'search',
  runway: 'calendar',
  clocks: 'calendar',
  costs: 'calendar',
  meals: 'calendar',
  housing: 'calendar',
  activities: 'calendar',
  work: 'calendar',
  event: 'calendar',
};

/** The one canonical home used by navigation, governance and continuity UI. */
export function canonicalDestinationFor(screen: Screen): Screen {
  if (FIVE_DESTINATIONS.includes(screen)) return screen;
  return UNDER[screen] ?? PINNED;
}

/** The bar to draw: the five when the flag is on, the student's own bar otherwise. */
export function barForMode(saved: Screen[], c: Capabilities, role: Role, five: boolean): Screen[] {
  if (!five) return barFor(saved, c, role);
  const kept = FIVE_DESTINATIONS.filter((s) => allowed(s, c) && forRole(s, role));
  return kept.filter((s) => s !== PINNED).length < FEWEST_CHOSEN ? barFor(saved, c, role) : kept;
}

/** The bar's word for a screen, in the five-destination bar or the ordinary one. */
export function labelForMode(screen: Screen, five: boolean): string {
  return (five && FIVE_LABELS[screen]) || tabLabel(screen);
}

/** Which tab to light for the screen on show. */
export function litForMode(screen: Screen, chosen: Screen[], five: boolean): Screen | null {
  if (!five) return litTab(screen, chosen);
  if (chosen.includes(screen)) return screen;
  const under = canonicalDestinationFor(screen);
  return chosen.includes(under) ? under : null;
}
