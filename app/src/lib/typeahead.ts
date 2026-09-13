/**
 * What the box offers before you have finished typing.
 *
 * A search box that offers nothing until you press Enter asks you to know the
 * word. That is fine for "econ" and useless for everything a student actually
 * half-remembers: the reading with the long title, the unit called something
 * about monopolies, the screen where the meal plan lives. Google's answer —
 * and it is the reason people type into that box rather than into a menu — is
 * that the box answers while you type, and that most of what it offers is
 * either something you searched before or a completion of what is already in
 * front of you.
 *
 * So three kinds of row, in this order:
 *
 *   1. **What you searched before**, matching what is typed. Most searches a
 *      person makes are a search they have made — the same course, the same
 *      unit, three days running — and a history row is one keystroke instead
 *      of eleven. Each is removable, because a typo you made once should not
 *      follow you for the term.
 *   2. **Completions**, drawn from the names of the things the app can find.
 *      Not a word list: every completion offered leads somewhere, so nothing
 *      the box suggests can return "no results".
 *   3. **Ideas**, when the box is empty and there is no history to show —
 *      Google's "Keep exploring". Built from the student's own courses and
 *      screens for the same reason.
 *
 * Not `lib/suggest.ts`, which suggests *applications* — programmes to apply
 * to, and when. This is the search box's typeahead and nothing else.
 *
 * The ranking is deliberately dull, like `lib/find.ts`: what starts with what
 * you typed beats what merely contains it, and ties keep the order they came
 * in. People read the first two rows.
 */

export type SuggestKind = 'recent' | 'complete' | 'explore';

export interface Suggestion {
  kind: SuggestKind;
  text: string;
}

/** Where the history is kept, and how much of it. */
export const SEARCHES_KEY = 'semester.searches.v1';

/**
 * Twelve, which is about two screens of history rows and a term's worth of
 * habit. Beyond that a list stops being "what I search" and becomes a log.
 */
export const MAX_RECENTS = 12;

/** How many rows the box will put up at once. More than this is a wall. */
export const MAX_SUGGESTIONS = 8;

const norm = (s: string) => s.trim().toLowerCase();

/**
 * A search, remembered — newest first, no duplicates, oldest dropped.
 *
 * Case-insensitive de-duplication, and the new spelling wins: somebody who
 * types "Econ 101" after "econ 101" has just told you which one they read
 * more easily.
 */
export function remember(list: string[], query: string): string[] {
  const q = query.trim();
  if (!q) return list;
  return [q, ...list.filter((old) => norm(old) !== norm(q))].slice(0, MAX_RECENTS);
}

export function forget(list: string[], query: string): string[] {
  return list.filter((old) => norm(old) !== norm(query));
}

/**
 * The rows to draw under the box.
 *
 * `corpus` is the names of things that can actually be found — titles of
 * hits, course names, screen labels — and is the only source of completions,
 * so an offer the box makes is an offer the results can keep. `ideas` is used
 * only when there is nothing typed and nothing searched before, which is the
 * one moment a suggestion list has to be generous rather than relevant.
 */
export function suggestions(
  query: string,
  recents: string[],
  corpus: string[],
  ideas: string[] = [],
): Suggestion[] {
  const q = norm(query);
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  const push = (kind: SuggestKind, text: string) => {
    const key = norm(text);
    if (!key || seen.has(key) || out.length >= MAX_SUGGESTIONS) return;
    seen.add(key);
    out.push({ kind, text });
  };

  // Never offer back exactly what is already in the box: a row that does
  // nothing when pressed is worse than one row fewer.
  if (q) seen.add(q);

  const matching = (list: string[]) =>
    q === '' ? list : rank(list.filter((text) => norm(text).includes(q)), q);

  /*
   * History first, and capped when it is the only thing there is.
   *
   * With an empty box, twelve remembered searches would fill the list and
   * leave no room for anything else — which is a box that can only ever offer
   * you your own past. Five, and the rest of the space goes to ideas.
   */
  const past = matching(recents);
  for (const text of q === '' ? past.slice(0, 5) : past) push('recent', text);

  for (const text of matching(corpus)) push('complete', text);

  if (q === '') for (const text of ideas) push('explore', text);

  return out;
}

/** Starts-with before contains, and otherwise the order given. */
function rank(list: string[], q: string): string[] {
  return [...list].sort((a, b) => score(b, q) - score(a, q));
}

function score(text: string, q: string): number {
  const t = norm(text);
  if (t.startsWith(q)) return 2;
  // A match at a word boundary is the same thing to a reader as a match at
  // the start — "state" against "The state of the union" is not a middle
  // match to anybody but a substring search.
  if (t.includes(` ${q}`)) return 1;
  return 0;
}

export function readSearches(): string[] {
  try {
    const raw = localStorage.getItem(SEARCHES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    return list.filter((s): s is string => typeof s === 'string' && s.trim() !== '').slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

export function writeSearches(list: string[]): void {
  try {
    localStorage.setItem(SEARCHES_KEY, JSON.stringify(list.slice(0, MAX_RECENTS)));
  } catch {
    // History is a convenience. Losing it must not lose the search.
  }
}
