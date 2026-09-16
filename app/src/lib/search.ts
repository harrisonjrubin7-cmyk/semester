/**
 * Matching text against a query, for the searches this app has.
 *
 * This file used to describe a search that no longer exists: an adapter per
 * screen saying what its rows were and what matching one meant, which `<Page>`
 * turned into a field on top of the screen. That one is gone, and what is left
 * here is the pieces the surviving searches are built out of — the plain
 * containment test a caller reaches for, and the vocabulary both rankings have
 * to agree on.
 *
 * There are two rankings, and they are not the same job. `lib/find.ts` ranks
 * records — courses, deadlines, notes, units — against each other and the
 * screens. `lib/desk.ts` ranks screens alone, for the bar and the directory.
 * What they must not disagree about is which words in a query are worth
 * matching at all, so that list lives here and neither owns it.
 */

/**
 * Does any of this text contain the query?
 *
 * Deliberately a plain substring test and not the ranked scoring in `find.ts`:
 * that ranking exists to order results from six different sources against each
 * other, and a caller checking whether one record mentions a word has no
 * ordering to decide.
 *
 * Undefined and empty fields are skipped, so a caller can name a field that is
 * only sometimes there without guarding it.
 */
export function has(q: string, ...text: (string | null | undefined)[]): boolean {
  for (const t of text) {
    if (t && t.toLowerCase().includes(q)) return true;
  }
  return false;
}

/**
 * Words nobody is searching by.
 *
 * "delete my account" failed the every-word test because no screen's keywords
 * contain "my" — which is true of every possessive and article somebody puts in
 * a sentence. Requiring them makes the loose match useless for exactly the
 * queries it exists to serve.
 *
 * Deliberately short. A long stop list starts throwing away words that carry
 * meaning, and "work" or "check" are screens here.
 *
 * Here rather than in `find.ts`, where it was written, because the app search
 * in `desk.ts` needs the same list and the two must not drift: a word the
 * palette ignores and the bar demands is a query that works in one search and
 * returns "No app matches that" in the other, one field apart on the same
 * screen.
 */
export const FILLER = new Set([
  'a', 'an', 'the', 'my', 'me', 'i', 'is', 'are', 'was', 'to', 'of', 'in', 'on',
  'for', 'at', 'and', 'or', 'do', 'does', 'did', 'can', 'how', 'where', 'what',
  'when', 'it', 'this', 'that',
  'change', 'set', 'turn', 'switch', 'make', 'open', 'show',
]);

/**
 * What a query is asking for, once the words nobody searches by are gone.
 *
 * Lower-cased and trimmed by the caller; this only splits and filters, so that
 * both searches decide "is there anything left to match on" the same way.
 */
export function queryWords(q: string): string[] {
  return q.split(/\s+/).filter((w) => w && !FILLER.has(w));
}

/**
 * Is this query one the every-word tier should even be tried on?
 *
 * True when the filtered words are not simply the query again — so a
 * multi-word query gets it, and so does "where are my grades", which comes
 * down to the single word "grades" that a whole-query test never saw. A
 * one-word query that survives filtering unchanged has already been tried
 * against everything, and running it again under a lower tier would only
 * duplicate the row it already produced.
 */
export function worthSplitting(words: string[], q: string): boolean {
  return words.length > 0 && (words.length > 1 || words[0] !== q);
}
