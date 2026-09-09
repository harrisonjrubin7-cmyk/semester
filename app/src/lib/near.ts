/**
 * Two words that are one slip of the finger apart.
 *
 * The search in `find.ts` matches by containment: every tier of its scoring,
 * from an exact name down to the loose every-word pass, asks whether the
 * letters typed appear somewhere in the letters stored. That is exactly right
 * when the letters typed are the letters meant, and it is a wall when they are
 * not — "calender" finds nothing, though there is a Calendar screen; "gradess"
 * finds nothing, though the grade table is one of the most-visited pages in
 * the app. The person then gets a sentence telling them to try a course code,
 * a topic, a professor or the name of a screen, which is what they did.
 *
 * A search that answers a typed word and not a mistyped one is a search people
 * learn to distrust, and the failure is invisible from the inside: nobody
 * reports "I searched wrong", they just stop searching.
 *
 * So this is the smallest thing that fixes it — a bounded edit distance, used
 * as the very last tier of the ranking and never as a competitor to a real
 * match.
 *
 * ## Transpositions count as one
 *
 * The distance here is optimal string alignment rather than plain Levenshtein:
 * two adjacent letters swapped cost one edit, not two. That is not a
 * refinement, it is the main case — "teh", "recieve", "schedual", "podacst"
 * are all transpositions, and under plain Levenshtein a seven-letter word is
 * allowed one edit and a transposition costs two, so precisely the commonest
 * typo would be the one still finding nothing.
 */

/**
 * How far off a word of this length may be.
 *
 * Nought below five letters, because at four a single edit reaches "case",
 * "cast", "cost" and "cars" from one another, and a tier that turns every
 * short word into every other short word is noise wearing the costume of
 * helpfulness. One edit up to seven letters, two from eight — a longer word
 * is both likelier to be typed wrong and far less likely to collide, and
 * "assignmnets" should still land on assignments.
 */
export function slack(word: string): number {
  if (word.length >= 8) return 2;
  if (word.length >= 5) return 1;
  return 0;
}

/**
 * The optimal-string-alignment distance, given up on once it exceeds `max`.
 *
 * Bounded on purpose. This runs against every word of every candidate that
 * nothing else matched, on every keystroke, so the answer worth computing is
 * "is this within two edits" and not "how far apart are these exactly". The
 * length check rejects most pairs before any work at all, and a row whose
 * every cell is already over the budget ends it.
 *
 * Returns `max + 1` for anything further away than `max`.
 */
export function distance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (max <= 0) return 1;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  const n = a.length;
  const m = b.length;
  if (n === 0) return m > max ? max + 1 : m;
  if (m === 0) return n > max ? max + 1 : n;

  // Three rows, because a transposition looks two rows back.
  let before: number[] = [];
  let prev = new Array<number>(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;

  for (let i = 1; i <= n; i++) {
    const row = new Array<number>(m + 1);
    row[0] = i;
    let best = row[0];
    // Only the diagonal band can hold a value within budget; everything
    // outside it needs more than `max` insertions or deletions to reach.
    const lo = Math.max(1, i - max);
    const hi = Math.min(m, i + max);
    for (let j = 1; j <= m; j++) {
      if (j < lo || j > hi) {
        row[j] = max + 1;
        continue;
      }
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, before[j - 2] + 1);
      }
      row[j] = v;
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    before = prev;
    prev = row;
  }

  return prev[m] > max ? max + 1 : prev[m];
}

/**
 * Is `typed` a near miss for `word`?
 *
 * The tolerance comes from what was typed rather than from what is stored: a
 * long word typed short is still somebody aiming at the long one, and taking
 * the shorter of the two would quietly make the second half of a query
 * stricter than the first.
 */
export function near(typed: string, word: string): boolean {
  const max = slack(typed);
  if (max === 0) return typed === word;
  return distance(typed, word, max) <= max;
}

/** Splitting a haystack the way a person reads it — on anything but letters and digits. */
const WORDS = /[^a-z0-9]+/;

/**
 * Does any word in `text` sit within a typo of `typed`?
 *
 * Word by word rather than against the whole string, because an edit distance
 * over a sentence is dominated by its length: "calender" is two edits from
 * "calendar" and forty from "The calendar, and every deadline on it".
 */
export function nearAny(typed: string, text: string): boolean {
  if (!typed || !text) return false;
  const max = slack(typed);
  if (max === 0) return false;
  for (const w of text.toLowerCase().split(WORDS)) {
    // Cheap gates first: the two loops below are the expensive part, and most
    // words fail on length alone.
    if (!w || Math.abs(w.length - typed.length) > max) continue;
    if (distance(typed, w, max) <= max) return true;
  }
  return false;
}
