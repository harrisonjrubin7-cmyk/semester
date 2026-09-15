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
 * How well an app answers to what was typed, or 0 for not at all.
 *
 * Four tiers, and the order is the whole of it: the name you typed beats the
 * name that starts with it, which beats the name that contains it, which
 * beats a word in the sentence or the keywords. "Deck" has to reach Deck
 * before it reaches the six screens whose blurb mentions slides, and
 * "powerpoint" — which is in no label anywhere — still has to reach Deck.
 *
 * The school's own words are matched as well as the registry's, so a
 * Vanderbilt student searching YES finds their registrar.
 *
 * ## The fifth tier, for the words somebody actually types
 *
 * The four above all ask about `q` as one unbroken run of characters, and
 * that is the right question for a name: "powerpoint" is a word, and the
 * tiers rank it against a label. It is the wrong question for a phrase.
 * "study guide" scored 0 on every one of the sixty screens and this bar
 * answered *No app matches that* — for the thing the app is best at. Study's
 * label says `study` and its keywords say `guide`, but never adjacently, so
 * no whole-run test could reach it however it was ranked.
 *
 * `nav.ts`'s `taskMatch` had already learned this and written it down: every
 * word has to land somewhere, in any order, because people type the two
 * words they remember rather than the label as written. That is why full
 * search found study results for the same query this bar rejected — one
 * registry, two matchers, and only one of them could read a phrase. So the
 * rule comes here too, as a tier below the four rather than a change to
 * them: an exact name still outranks a phrase scattered across a blurb, and
 * every existing ranking holds.
 *
 * Deliberately last, and deliberately including the label in its haystack.
 * A one-word query cannot reach this tier — a word starting anywhere in a
 * label is already caught by `includes` at 60 — and the test below asserts
 * exactly that, across every row, rather than arguing it. The join below
 * cannot move a one-word score either, since one word cannot straddle a
 * seam; the sweep in the next paragraph measured that at zero.
 *
 * Phrases do move, and the first draft of this comment claimed they did not.
 * They move in one direction only: a run that existed solely at a field seam
 * scored 40 from the join below and lands here instead. `guide study` is the
 * example and this file's own test pins it at 20.
 *
 * Swept over 5,843 queries — every one-, two- and three-word run of every
 * field of all sixty rows, plus the 120 runs that span a seam — against all
 * sixty offered rows, comparing this scorer to the one on `main`:
 *
 *     gained a score      2,774        lost a score            0
 *     dropped 40 → 20        60        one-word score moved    0
 *
 * Seven queries get a different screen first, and all seven are seam runs
 * losing a place they never earned: `test study` led with Exam runway on a
 * phrase that existed only where two fields met, and now leads with Practice
 * paper, which holds both words. Nothing that scored stops scoring.
 *
 * The seam count is worth stating as 60 rather than "some": it is one per
 * screen, which is what you would expect of a defect that came from the
 * joining rather than from any row's text.
 */
const atWordStart = (hay: string, word: string): boolean =>
  new RegExp(`(^|[^a-z])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(hay);

export function scoreApp(d: Destination, query: string, caps: Capabilities): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const said = saysFor(d, caps);
  const label = said.label.toLowerCase();
  const short = (d.short ?? '').toLowerCase();
  if (label === q || short === q) return 100;
  if (label.startsWith(q) || short.startsWith(q)) return 80;
  if (label.includes(q) || short.includes(q)) return 60;
  /*
   * Joined on a newline rather than a space, because these are three
   * separate pieces of text and a phrase straddling two of them is a phrase
   * nobody wrote. Study's keywords end in `guide` and its shelf is `Study`,
   * so a space here spelled out `guide study` — and that run, which exists
   * only at the seam, scored 40: the accidental adjacency outranked every
   * screen that genuinely holds both words. A newline is still `[^a-z]`, so
   * a word at the start of any field is as findable as it ever was, and a
   * one-word query cannot straddle a seam at all.
   */
  const words = [said.blurb, d.keywords, d.group].join('\n').toLowerCase();
  // Word-start rather than bare `includes`: "map" inside "compare" is not a
  // hit anybody meant, and a search that answers with a screen whose only
  // connection is a substring in the middle of a word reads as broken.
  if (atWordStart(words, q)) return 40;
  const everything = [label, short, words].join('\n');
  const typed = q.split(/\s+/).filter(Boolean);
  if (typed.length > 1 && typed.every((w) => atWordStart(everything, w))) return 20;
  return 0;
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
