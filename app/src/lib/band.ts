/**
 * Packing all-day entries into the rows of a banner.
 *
 * `bannersOn` in `lib/select.ts` answers "what covers this day". A band is the
 * other question: given seven of those answers side by side, **how many rows
 * does the banner need and which cells does each bar occupy** — so that a
 * Thursday-to-Sunday trip is one bar four columns wide rather than four bars
 * that happen to touch.
 *
 * Kept apart from the component that draws it for the reason the hour grid's
 * lane arithmetic is kept out of `HourGrid`: this is the part with an answer
 * that can be wrong, and a wrong answer here is a bar that overlaps another
 * one or a banner three rows taller than it needs. Both are easy to assert on
 * and neither is easy to see.
 *
 * The day view uses this too, with one column. That is not a special case
 * worth its own path — it is the same packing over a narrower week, and
 * having one implementation is what stops the day banner and the week banner
 * from disagreeing about the order two entries stack in.
 */

import type { Banner } from './select';

/** One bar, as a row of the band draws it. */
export interface BandRun {
  /** The banner id, which already identifies the run rather than the day. */
  key: string;
  title: string;
  meta: string;
  kind: string;
  /** The columns it covers in the band being drawn, inclusive of both. */
  from: number;
  to: number;
  /**
   * Whether the run truly begins and ends here, rather than being cut off by
   * the edge of the view.
   *
   * A trip starting the previous Sunday is drawn from Monday's column with a
   * square left edge, because a rounded one would say it starts on Monday.
   * Both clients draw the clipped end flat and this is the fact that lets a
   * component do the same without knowing what a week is.
   */
  opens: boolean;
  closes: boolean;
  /** The record behind it, where the student owns one. */
  appointmentId: string | null;
}

/**
 * The band, as rows of non-overlapping bars.
 *
 * Longest runs first, then by the column they start in — so the week-long bar
 * is the top row and the one-day entries fill in beneath it. That ordering is
 * the one both clients use and it is the readable one: a reader scanning down
 * a column meets the thing covering the most of their week first, and short
 * entries never push a long one down a row for a day and back up the next.
 */
export function bandRows(columns: Banner[][]): BandRun[][] {
  const byKey = new Map<string, BandRun>();

  columns.forEach((banners, col) => {
    for (const b of banners) {
      const had = byKey.get(b.id);
      if (!had) {
        byKey.set(b.id, {
          key: b.id,
          title: b.title,
          meta: b.meta,
          kind: b.kind,
          from: col,
          to: col,
          opens: b.first,
          closes: b.last,
          appointmentId: b.from?.id ?? null,
        });
        continue;
      }
      // A run met again in a later column reaches further; whether it *ends*
      // in the view is whatever the rightmost day of it says.
      had.to = col;
      had.closes = b.last;
    }
  });

  const runs = [...byKey.values()].sort(
    (a, b) => b.to - b.from - (a.to - a.from) || a.from - b.from || a.title.localeCompare(b.title),
  );

  const rows: BandRun[][] = [];
  for (const run of runs) {
    // The first row with nothing in the columns this one needs. Greedy is
    // right here because the runs are already in the order that makes it
    // produce the fewest rows: anything that could be pushed down by a
    // later run is longer than it, and longer runs are placed first.
    let row = rows.findIndex((taken) => taken.every((r) => r.to < run.from || r.from > run.to));
    if (row === -1) row = rows.push([]) - 1;
    rows[row].push(run);
  }

  return rows.map((row) => [...row].sort((a, b) => a.from - b.from));
}
