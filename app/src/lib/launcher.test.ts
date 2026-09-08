import { describe, expect, it } from 'vitest';
import { GROUPS, destinationsFor } from './nav';
import { afterDrag, readOrder, reorder, tilesFor, writeOrder } from './launcher';
import type { Capabilities } from './school';
import type { Screen } from './types';

/**
 * The arrangement, and the promise it makes.
 *
 * The promise is that a saved order is a preference over the registry and
 * never a replacement for it: it can put things in an odd sequence and it can
 * never hide one, invent one, or bring back one the school gate has switched
 * off. Everything here is a way of checking that a stale string — and every
 * order goes stale, because the app keeps gaining screens — stays harmless.
 */

const CAPS: Capabilities = { mealPlan: 'none', housing: false, campusMap: false };
const screens = (g: (typeof GROUPS)[number]) => destinationsFor(g, CAPS).map((d) => d.screen);

describe('the look key', () => {
  it('round-trips', () => {
    const order = { Semester: ['brief', 'home'] as Screen[], Data: ['export'] as Screen[] };
    expect(readOrder(writeOrder(order))).toEqual(order);
  });

  it('reads nothing as no preference at all', () => {
    expect(readOrder(undefined)).toEqual({});
    expect(readOrder('')).toEqual({});
  });

  it('drops a shelf that is not a shelf', () => {
    expect(readOrder('Upkeep:home|Semester:brief')).toEqual({ Semester: ['brief'] });
  });

  it('survives a string somebody typed by hand', () => {
    expect(() => readOrder('|:|,,|Semester:|Semester')).not.toThrow();
    expect(readOrder('|:|,,|Semester:|Semester')).toEqual({});
  });

  it('writes no shelf it has nothing to say about', () => {
    expect(writeOrder({ Semester: [] })).toBe('');
  });
});

describe('the tiles on a shelf', () => {
  it('is the registry’s membership, in the registry’s order, by default', () => {
    for (const g of GROUPS) {
      expect(tilesFor(g, CAPS, {}).map((d) => d.screen)).toEqual(screens(g));
    }
  });

  it('puts the ones somebody named first, in the order they named them', () => {
    const all = screens('Semester');
    const last = all[all.length - 1];
    const moved = tilesFor('Semester', CAPS, { Semester: [last] }).map((d) => d.screen);
    expect(moved[0]).toBe(last);
    expect(moved).toHaveLength(all.length);
    expect(new Set(moved)).toEqual(new Set(all));
  });

  it('never loses a screen the order forgot to mention', () => {
    // The case that matters: an order saved before a screen existed.
    const all = screens('Study');
    const partial = { Study: [all[2]] as Screen[] };
    expect(tilesFor('Study', CAPS, partial).map((d) => d.screen).sort()).toEqual([...all].sort());
  });

  it('ignores a name that is not on this shelf, and one that is not a screen', () => {
    const all = screens('Life');
    const junk = { Life: ['home', 'not-a-screen', all[1]] as Screen[] };
    expect(tilesFor('Life', CAPS, junk).map((d) => d.screen)).toEqual([
      all[1],
      ...all.filter((s) => s !== all[1]),
    ]);
  });

  it('shows a screen once even when the order names it twice', () => {
    const all = screens('Campus');
    const twice = { Campus: [all[1], all[1]] as Screen[] };
    const got = tilesFor('Campus', CAPS, twice).map((d) => d.screen);
    expect(got).toHaveLength(all.length);
    expect(new Set(got).size).toBe(all.length);
  });
});

describe('dropping one tile on another', () => {
  it('takes the position rather than swapping', () => {
    // The distinction the comment in `reorder` is about: dragging the last
    // onto the first should put it first, not exchange the two ends.
    expect(reorder([1, 2, 3, 4], 4, 1)).toEqual([4, 1, 2, 3]);
    expect(reorder([1, 2, 3, 4], 1, 3)).toEqual([2, 3, 1, 4]);
  });

  it('does nothing when a tile is dropped on itself, or on a stranger', () => {
    expect(reorder([1, 2, 3], 2, 2)).toEqual([1, 2, 3]);
    expect(reorder([1, 2, 3], 9, 1)).toEqual([1, 2, 3]);
  });

  it('writes the whole shelf down, not just the pair that moved', () => {
    const all = screens('Make');
    const next = afterDrag('Make', CAPS, {}, all[3], all[0]);
    expect(next.Make).toHaveLength(all.length);
    expect(next.Make![0]).toBe(all[3]);
  });

  it('keeps every screen through a drag, on every shelf', () => {
    for (const g of GROUPS) {
      const all = screens(g);
      if (all.length < 2) continue;
      const next = afterDrag(g, CAPS, {}, all[all.length - 1], all[0]);
      expect(new Set(next[g])).toEqual(new Set(all));
    }
  });

  it('round-trips through the look key it will be stored in', () => {
    const all = screens('Courses');
    const next = afterDrag('Courses', CAPS, {}, all[2], all[0]);
    expect(tilesFor('Courses', CAPS, readOrder(writeOrder(next))).map((d) => d.screen)).toEqual(
      next.Courses,
    );
  });
});
