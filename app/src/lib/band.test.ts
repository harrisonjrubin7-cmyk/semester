import { describe, expect, it } from 'vitest';
import { bandRows } from './band';
import type { Banner } from './select';

/**
 * The packing, not the drawing. Every case here is one a real week produces:
 * a break that starts before the week does, two trips that touch but do not
 * overlap, and one row's worth of entries that cannot share a row.
 */
function bar(id: string, day: number, days: number, title = id): Banner {
  return {
    id,
    title,
    meta: '',
    kind: 'other',
    on: '',
    day,
    days,
    first: day === 1,
    last: day === days,
    from: { kind: 'appointment', id },
  };
}

/** A week, as seven columns, from a map of column index → bars. */
function week(at: Record<number, Banner[]>): Banner[][] {
  return Array.from({ length: 7 }, (_, i) => at[i] ?? []);
}

describe('bandRows', () => {
  it('draws a run met in four columns as one bar, not four', () => {
    const rows = bandRows(
      week({ 2: [bar('trip', 1, 4)], 3: [bar('trip', 2, 4)], 4: [bar('trip', 3, 4)], 5: [bar('trip', 4, 4)] }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(1);
    expect(rows[0][0]).toMatchObject({ from: 2, to: 5, opens: true, closes: true });
  });

  it('squares off a run that began before the view did', () => {
    // Day 3 of 5 in the first column: it is running when the week opens, so
    // the left end is a cut rather than a start.
    const rows = bandRows(week({ 0: [bar('break', 3, 5)], 1: [bar('break', 4, 5)], 2: [bar('break', 5, 5)] }));
    expect(rows[0][0]).toMatchObject({ from: 0, to: 2, opens: false, closes: true });
  });

  it('squares off a run that outlives the view', () => {
    const rows = bandRows(week({ 5: [bar('away', 1, 4)], 6: [bar('away', 2, 4)] }));
    expect(rows[0][0]).toMatchObject({ from: 5, to: 6, opens: true, closes: false });
  });

  it('shares a row between two runs that do not touch', () => {
    const rows = bandRows(week({ 0: [bar('a', 1, 1)], 4: [bar('b', 1, 1)] }));
    expect(rows).toHaveLength(1);
    expect(rows[0].map((r) => r.key)).toEqual(['a', 'b']);
  });

  it('gives an overlapping run a row of its own', () => {
    const rows = bandRows(week({ 1: [bar('a', 1, 2), bar('b', 1, 1)], 2: [bar('a', 2, 2)] }));
    expect(rows).toHaveLength(2);
    // The longer one is the top row: a reader meets what covers most of the
    // week first, and a short entry never displaces a long one for a day.
    expect(rows[0][0].key).toBe('a');
    expect(rows[1][0].key).toBe('b');
  });

  it('puts the longest run on top however the columns hand them over', () => {
    const rows = bandRows(week({ 0: [bar('short', 1, 1), bar('long', 1, 3)], 1: [bar('long', 2, 3)], 2: [bar('long', 3, 3)] }));
    expect(rows.map((r) => r.map((x) => x.key))).toEqual([['long'], ['short']]);
  });

  it('reads left to right within a row', () => {
    const rows = bandRows(week({ 5: [bar('late', 1, 1)], 1: [bar('early', 1, 1)] }));
    expect(rows[0].map((r) => r.key)).toEqual(['early', 'late']);
  });

  it('is a band of nothing when nothing is all day', () => {
    expect(bandRows(week({}))).toEqual([]);
  });

  it('packs one column the same way, so the day banner cannot disagree', () => {
    const rows = bandRows([[bar('a', 1, 1), bar('b', 1, 1)]]);
    expect(rows.map((r) => r.map((x) => x.key))).toEqual([['a'], ['b']]);
  });
});
