import type { ReactNode } from 'react';

/**
 * How a screen says what searching it means.
 *
 * The app has one very good search — `lib/find.ts` reaches deadlines, units,
 * courses, notes, tasks and the app's own screens — and it answers the wrong
 * question when you are standing on a screen with sixty rows on it. Somebody
 * looking at their sources for the one by Trounstine does not want a list of
 * every screen that mentions Trounstine; they want that row, here, now.
 *
 * So a screen declares what its own rows are and what matching one means, and
 * `<Page>` does everything else: the box, the debounce, the empty state, the
 * clearing, and the way out to the global search when the answer is not on
 * this screen after all.
 *
 * ## Screens with no adapter
 *
 * They get the same box, and typing in it goes straight to the global search.
 * That is the point of doing this in the shell rather than screen by screen: a
 * screen nobody has written an adapter for is not a screen where the search box
 * is missing or, worse, present and dead. A stub adapter that "searches" a
 * screen with nothing to search would be exactly that dead box, which is why
 * there are none.
 */
export interface SearchAdapter<T> {
  /** What the box says when it is empty. Name the rows: "Filter your sources". */
  placeholder: string;
  /**
   * Every row this screen could show, unfiltered and in its display order.
   *
   * Called on each render, so hand back a memoised array rather than building
   * one here — `<Page>` cannot memoise on your behalf without knowing what the
   * array depends on.
   */
  select: () => T[];
  /**
   * Does this row answer the query?
   *
   * The query arrives trimmed and lower-cased, and is never empty — `<Page>`
   * shows everything when nothing has been typed rather than asking.
   */
  match: (item: T, q: string) => boolean;
  /**
   * What to say when the screen has rows but none of them match.
   *
   * Optional: the default names the query and offers the whole app, which is
   * right for most screens. Write one where the screen can say something more
   * useful — that the filter above is also narrowing the list, say.
   */
  empty?: (q: string) => ReactNode;
}

/**
 * The ordinary match: does any of this text contain the query?
 *
 * Most adapters are one line of this. Deliberately a plain substring test and
 * not the ranked scoring in `find.ts`: that ranking exists to order results
 * from six different sources against each other, and a screen filtering its
 * own list in place has no ordering to decide — the rows stay in the order the
 * screen already put them in, which is the order the person was reading.
 *
 * Undefined and empty fields are skipped, so an adapter can name a field that
 * is only sometimes there without guarding it.
 */
export function has(q: string, ...text: (string | null | undefined)[]): boolean {
  for (const t of text) {
    if (t && t.toLowerCase().includes(q)) return true;
  }
  return false;
}
