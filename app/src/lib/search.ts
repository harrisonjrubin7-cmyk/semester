/**
 * Matching text against a query, for the one search this app has.
 *
 * This file used to describe the other one: an adapter per screen saying what
 * its rows were and what matching one meant, which `<Page>` turned into a
 * field on top of the screen. That whole second search is gone — the header's
 * icon is the only one — and what is left is the predicate the remaining one
 * is built out of. `lib/find.ts` ranks with its own scoring; this is the plain
 * containment test its callers reach for.
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
