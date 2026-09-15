/**
 * The workspace shell, as rules rather than as markup.
 *
 * The shell is a tab strip, one search bar under it, a launcher, a directory
 * and a sidebar — and every one of those has to agree with the others about
 * what the app contains, what this student has pinned, and whether the centre
 * of the search home is currently covered. Five components each answering
 * those questions for themselves is how the launcher ends up offering a
 * screen the directory hides, which is the exact fault `lib/nav.ts` was
 * written to stop one layer down.
 *
 * So the answers are here, once, and the components read them.
 *
 * ## Nothing here decides what the app contains
 *
 * `lib/nav.ts` does, gated by the school and the role, and everything below
 * goes through `offered`. A saved list of shortcuts is a *preference over*
 * that registry and never a replacement for it: a name that is no longer a
 * screen is dropped, a screen this school has switched off cannot come back
 * by being named in an old list, and the worst a stale list can do is put
 * five shortcuts in an odd order.
 */

import { offered, saysFor, type Destination } from './nav';
import { queryWords, worthSplitting } from './search';
import { DEFAULT_ROLE, type Role } from './role';
import type { Capabilities } from './school';
import type { Screen } from './types';

/**
 * The shortcuts a search home opens on, before anybody has moved one.
 *
 * The four screens that are the term — what is on today, the courses, the
 * study modes, the calendar — and the one thing somebody does on day one.
 * Not "most used": a row whose contents change with the week moves every
 * icon under it, and a shortcut you have to read is not a shortcut. See the
 * same argument in `lib/apps.ts`.
 */
export const DEFAULT_FAVOURITES: Screen[] = ['home', 'courses', 'study', 'calendar', 'import'];

/** How many shortcuts the row will hold. Six across is the drawn width. */
export const MAX_FAVOURITES = 6;

/** The saved list, parsed. Anything unrecognised is dropped, not trusted. */
function saved(list: string | undefined): Screen[] {
  if (typeof list !== 'string' || list.trim() === '') return [];
  return list
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as Screen[];
}

/**
 * The shortcuts, resolved against what this school and this person can have.
 *
 * An empty preference is the state "nobody has chosen", answered with the
 * defaults — and the defaults go through the same gate, so a school with no
 * syllabus import does not get a dead tile.
 */
export function readFavourites(
  list: string | undefined,
  caps: Capabilities,
  role: Role = DEFAULT_ROLE,
): Destination[] {
  const can = offered(caps, role);
  const by = new Map(can.map((d) => [d.screen, d]));
  const wanted = saved(list);
  const from = wanted.length > 0 ? wanted : DEFAULT_FAVOURITES;
  const out: Destination[] = [];
  for (const screen of from) {
    const d = by.get(screen);
    if (d && !out.includes(d)) out.push(d);
  }
  return out.slice(0, MAX_FAVOURITES);
}

/** Back to a look key. */
export function writeFavourites(screens: Screen[]): string {
  return screens.slice(0, MAX_FAVOURITES).join(',');
}

/**
 * Pin or unpin one screen, returning the key to save.
 *
 * Resolved first, so a toggle made against the defaults writes the defaults
 * plus the change rather than a list of one — pinning a sixth screen must not
 * silently unpin the five that were showing.
 */
export function toggleFavourite(
  list: string | undefined,
  screen: Screen,
  caps: Capabilities,
  role: Role = DEFAULT_ROLE,
): string {
  const now = readFavourites(list, caps, role).map((d) => d.screen);
  const next = now.includes(screen)
    ? now.filter((s) => s !== screen)
    : [...now, screen].slice(0, MAX_FAVOURITES);
  return writeFavourites(next);
}

/** Whether a screen is pinned, asked the way the star in the directory asks. */
export function isFavourite(
  list: string | undefined,
  screen: Screen,
  caps: Capabilities,
  role: Role = DEFAULT_ROLE,
): boolean {
  return readFavourites(list, caps, role).some((d) => d.screen === screen);
}

/**
 * The four tiers, run against one run of characters.
 *
 * The order is the whole of it: the name you typed beats the name that starts
 * with it, which beats the name that contains it, which beats a word in the
 * sentence or the keywords. "Deck" has to reach Deck before it reaches the six
 * screens whose blurb mentions slides, and "powerpoint" — which is in no label
 * anywhere — still has to reach Deck.
 *
 * The school's own words are matched as well as the registry's, so a
 * Vanderbilt student searching YES finds their registrar.
 *
 * Split out of `scoreApp` so the every-word tier below can ask the same
 * question of one word that the whole query asks of itself, and get an answer
 * on the same scale.
 */
const atWordStart = (hay: string, word: string): boolean =>
  new RegExp(`(^|[^a-z])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(hay);

function tier(d: Destination, q: string, caps: Capabilities): number {
  const said = saysFor(d, caps);
  const label = said.label.toLowerCase();
  const short = (d.short ?? '').toLowerCase();
  if (label === q || short === q) return 100;
  if (label.startsWith(q) || short.startsWith(q)) return 80;
  if (label.includes(q) || short.includes(q)) return 60;
  /*
   * Joined on a newline rather than a space, because these are three separate
   * pieces of text and a phrase straddling two of them is a phrase nobody
   * wrote. Study's keywords end in `aloud` and its shelf is `Study`, so a
   * space here spelled out `aloud study` — a run that exists only at the
   * seam, scoring the whole-query tier and outranking any screen that holds
   * both words properly. Measured across the registry before the fix: 60 of
   * them, one per screen, `agenda semester` and `average courses` and
   * `analyze study` among them.
   *
   * A newline is still `[^a-z]`, so a word at the start of any field is as
   * findable as it ever was, and a one-word query cannot straddle a seam at
   * all.
   *
   * Found independently from both sides — #432 reached this function first
   * and named `guide study`; this branch named `aloud study`, a seam its own
   * `read aloud` keyword had just created — and measured at 60 twice, by two
   * probes that do not share a line of code. It matters more under the tier
   * below than it did on its own: a phantom whole-query hit returns before
   * the every-word tier is reached, and would have shadowed it.
   */
  const words = [said.blurb, d.keywords, d.group].join('\n').toLowerCase();
  // Word-start rather than bare `includes`: "map" inside "compare" is not a
  // hit anybody meant, and a search that answers with a screen whose only
  // connection is a substring in the middle of a word reads as broken.
  if (atWordStart(words, q)) return 40;
  return 0;
}

/**
 * The highest score the every-word tier can reach.
 *
 * One below the weakest whole-query tier, and that is the property the tier is
 * built around rather than a number that happened to look right: a screen
 * whose keywords contain the exact phrase typed is a better answer than a
 * screen that merely contains both words somewhere, and it stays ahead of one
 * however well the scattered words score. So *this tier* can only add rows to
 * the end of a result list; it cannot reorder the rows already there, which
 * is what made it safe to run under every existing search test rather than
 * beside them.
 *
 * The claim is about the tier and not about the change, and the difference is
 * not pedantry: the seam fix above does move rows, deliberately, and an
 * earlier draft of this comment said nothing moved. #432 caught the same
 * overstatement on its own side before merging. What moves is counted in
 * `scoreApp` below.
 */
export const SCATTERED = 39;

/**
 * How well an app answers to what was typed, or 0 for not at all.
 *
 * Five tiers now: the four above, asked of the whole query, and then every
 * word of it asked separately.
 *
 * ## Why the fifth
 *
 * Until it, the whole query had to appear as one unbroken run of characters in
 * one field, so the bar answered "No app matches that" to 32 of 44 ordinary
 * two- and three-word queries — "study guide", "pay bill", "practice exam",
 * "my grades", "email professor". The screen named in the first of those is
 * Study, whose keywords have said `guide` all along; the query failed because
 * no field anywhere reads "study guide" as one phrase.
 *
 * The worst of them is "add reading", which found nothing while a screen
 * *labelled* "Add a reading" sat in the registry. A search that cannot find a
 * screen by its own name minus an article is not a search with a gap in its
 * vocabulary; it is a matcher that only ever knew how to look for one word.
 *
 * `lib/find.ts` had already learned this — its loose tier is why "delete my
 * account" reaches Privacy — and the palette is the control that proves the
 * registry was never the problem: reading the same `DESTINATIONS`, it found
 * screens for 17 of the 32 queries this function called no match at all. Two
 * instruments, one registry, one of them wrong. The two now share the filler
 * list they filter by, in `lib/search.ts`.
 *
 * With the tier, 32 of those 44 are answered. The twelve that are still not
 * divide cleanly, and the division is the point: "submit assignment" has no
 * screen because the app has no submissions, and saying so is the honest
 * answer; "make a study guide" fails on `make`, a word the registry does not
 * carry and should not be taught to carry for one query. Neither is this
 * function's to fix.
 *
 * ## Against the tier that got here first
 *
 * #432 merged the same rule as a flat 20, and this replaced it rather than
 * joined it. Two differences, both measured on the 44 queries above: it does
 * not filter the words nobody searches by, so `pay my bill`, `my grades`,
 * `where are my grades` and `delete my account` need `my`, `where` and `are`
 * to land on a screen and none of them can; and a flat score leaves ranking
 * to registry order, where the mean of what each word scored puts the screen
 * with the better word first. 19 of 44 answered nothing under it, 12 here,
 * and there is no query it answers that this does not.
 *
 * Swept over the same 10,115 — every word in the registry, every adjacent
 * pair and triple of them, and 4,000 seeded pairs drawn from two screens at
 * once — against `main` carrying that tier:
 *
 *     gained rows, lost none      488     same rows, better order      66
 *     of those, had been empty    102     lost a row                  138
 *
 * Every one of the 138 gained a row as well; none lost without gaining, and
 * the 8-row cap is what moved them. 134 are queries that come down to one
 * real word or to no real word at all — `and an` answered with eight screens
 * under a tier that had to match `and` and `an`, and answers with the two
 * that mean something here. The remaining four are pronouns (`you your`,
 * `me you your`), which are not queries anybody types.
 *
 * ## Every word, not any of them
 *
 * A screen has to answer to all of them. Anything looser and one common word
 * carries the whole query: "study guide" would come back with every screen
 * whose blurb says "study", which is most of a shelf, and the person who typed
 * two words would be worse off than the one who typed one.
 */
export function scoreApp(d: Destination, query: string, caps: Capabilities): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const whole = tier(d, q, caps);
  if (whole > 0) return whole;
  const words = queryWords(q);
  if (!worthSplitting(words, q)) return 0;
  let total = 0;
  for (const w of words) {
    const one = tier(d, w, caps);
    if (one === 0) return 0;
    total += one;
  }
  // The mean, so that a word landing on a label counts for more than one
  // landing in a blurb — "practice exam" has to reach Practice paper before it
  // reaches the other screens on the Study shelf that merely mention practice.
  // Scaled into the band below the whole-query tiers, never into them.
  return Math.max(1, Math.round((total / words.length / 100) * SCATTERED));
}

/**
 * The apps that answer to what was typed, best first.
 *
 * Ties keep registry order, which is the order the shelves are in — so two
 * screens scoring the same come back in the order they sit in the launcher
 * rather than in whatever order the sort happened to leave them.
 */
export function findApps(
  query: string,
  caps: Capabilities,
  role: Role = DEFAULT_ROLE,
  limit = 8,
): Destination[] {
  const scored = offered(caps, role)
    .map((d, i) => ({ d, i, score: scoreApp(d, query, caps) }))
    .filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return scored.slice(0, limit).map((x) => x.d);
}

/**
 * What is standing over the search home, if anything.
 *
 * The centre of that screen — the big field, its add button and its AI Tutor
 * control — is hidden whenever one of these is up, and the guide is explicit
 * about why: it must not cover results or intercept clicks. One function so
 * the screen and the shell cannot disagree about whether something is open,
 * and a boolean rather than a z-index because an element that is merely
 * behind the overlay is still in the tab order and still read out.
 */
export interface Overlays {
  /** The top bar's own suggestions are dropped. */
  suggesting: boolean;
  /** The nine-dot launcher. */
  apps: boolean;
  /** Customize Semester. */
  customize: boolean;
  /** The command palette. */
  finder: boolean;
  /** The one-line capture box. */
  quickAdd: boolean;
}

export function centreHidden(o: Overlays): boolean {
  return o.suggesting || o.apps || o.customize || o.finder || o.quickAdd;
}

/**
 * The categories the directory filters by, with "All apps" in front.
 *
 * Read off what this school actually offers rather than off `GROUPS`, so a
 * shelf whose every screen is switched off is not a chip that empties the
 * list when pressed.
 */
export function categories(caps: Capabilities, role: Role = DEFAULT_ROLE): string[] {
  const seen: string[] = [];
  for (const d of offered(caps, role)) if (!seen.includes(d.group)) seen.push(d.group);
  return seen;
}

/** Everything this person can open, in one list, for the directory. */
export function allApps(caps: Capabilities, role: Role = DEFAULT_ROLE): Destination[] {
  return offered(caps, role);
}

/**
 * The directory, narrowed by a category and a query.
 *
 * The query here is the directory's own box and matches the same way the top
 * bar does, so "powerpoint" narrows the list to Deck in both places rather
 * than in one.
 */
export function narrowApps(
  apps: Destination[],
  category: string,
  query: string,
  caps: Capabilities,
): Destination[] {
  const inCategory = category ? apps.filter((d) => d.group === category) : apps;
  const q = query.trim();
  if (!q) return inCategory;
  return inCategory
    .map((d, i) => ({ d, i, score: scoreApp(d, q, caps) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.d);
}
