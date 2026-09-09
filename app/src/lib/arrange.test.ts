import { describe, expect, it } from 'vitest';
import { arranged, dropped, nudged, readLists, writeLists } from './arrange';

/**
 * The arithmetic behind every list in the app that can be dragged.
 *
 * The gesture is not tested here — a pointer sequence is a browser, not a
 * function — and what is left is the part that can be wrong in a way nobody
 * sees: a row that lands one place off, a saved order that quietly loses a
 * screen, a stale name that hides something. The last is the one that
 * matters, because every arrangement goes stale: the app keeps gaining
 * screens, and a school gate keeps taking them away again.
 */

describe('dropping a row on another', () => {
  it('takes the position rather than swapping', () => {
    // The whole argument for insert-at: dragging the last thing onto the
    // first should put it first, not exchange the two ends of the list and
    // leave everything between them alone.
    expect(dropped([1, 2, 3, 4], 4, 1)).toEqual([4, 1, 2, 3]);
    expect(dropped([1, 2, 3, 4], 1, 3)).toEqual([2, 3, 1, 4]);
  });

  it('is the same list when a row is dropped on itself', () => {
    const list = [1, 2, 3];
    // The same array, not an equal one: the caller skips the write on it.
    expect(dropped(list, 2, 2)).toBe(list);
  });

  it('is the same list when either end of the move is a stranger', () => {
    // A drop can land on a row that has been filtered out from under it, so
    // this is the ordinary case rather than an error.
    const list = [1, 2, 3];
    expect(dropped(list, 9, 1)).toBe(list);
    expect(dropped(list, 1, 9)).toBe(list);
  });

  it('never loses or repeats anything, wherever it lands', () => {
    const all = ['a', 'b', 'c', 'd', 'e'];
    for (const from of all) {
      for (const to of all) {
        const next = dropped(all, from, to);
        expect([...next].sort()).toEqual([...all].sort());
      }
    }
  });
});

describe('nudging a row one step', () => {
  it('moves it by one, in either direction', () => {
    expect(nudged(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(nudged(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
  });

  it('stops at both ends rather than wrapping', () => {
    const list = ['a', 'b', 'c'];
    expect(nudged(list, 'a', -1)).toBe(list);
    expect(nudged(list, 'c', 1)).toBe(list);
  });

  it('does nothing to something that is not in the list', () => {
    const list = ['a', 'b'];
    expect(nudged(list, 'z', 1)).toBe(list);
  });

  it('agrees with a drop of one place, which is what the arrows promise', () => {
    // The two controls have to mean the same thing: an arrow is a drag onto
    // the neighbour. They were four separate implementations before this,
    // one of them written as a swap, and at one step apart a swap and a
    // splice agree — which is exactly why the difference went unnoticed.
    const list = ['a', 'b', 'c', 'd'];
    expect(nudged(list, 'c', -1)).toEqual(dropped(list, 'c', 'b'));
    expect(nudged(list, 'b', 1)).toEqual(dropped(list, 'b', 'c'));
  });
});

describe('a saved order against what the app actually offers', () => {
  it('puts the named ones first and keeps the rest behind them', () => {
    expect(arranged(['a', 'b', 'c', 'd'], ['c', 'a'])).toEqual(['c', 'a', 'b', 'd']);
  });

  it('cannot hide something the order does not name', () => {
    // The promise that makes a stale order harmless: a screen added since it
    // was saved appears at the end rather than not at all.
    expect(arranged(['a', 'b', 'new'], ['b', 'a'])).toEqual(['b', 'a', 'new']);
  });

  it('cannot bring back something that is no longer offered', () => {
    expect(arranged(['a', 'b'], ['gone', 'b'])).toEqual(['b', 'a']);
  });

  it('draws something named twice once', () => {
    expect(arranged(['a', 'b'], ['b', 'b'])).toEqual(['b', 'a']);
  });

  it('is the offered list when nothing has been arranged', () => {
    expect(arranged(['a', 'b', 'c'], [])).toEqual(['a', 'b', 'c']);
  });
});

describe('the look key several lists share', () => {
  it('round-trips', () => {
    const lists = { p0: ['home', 'brief'], dock: ['me'] };
    expect(readLists(writeLists(lists))).toEqual(lists);
  });

  it('reads nothing as no preference at all', () => {
    expect(readLists(undefined)).toEqual({});
    expect(readLists('')).toEqual({});
  });

  it('leaves an empty list out rather than writing it blank', () => {
    expect(writeLists({ p0: ['home'], p1: [] })).toBe('p0:home');
  });

  it('drops a chunk it cannot read rather than trusting it', () => {
    expect(readLists('rubbish|p0:home|:nameless|p1:')).toEqual({ p0: ['home'] });
  });

  it('ignores the spaces a hand-edited key might have in it', () => {
    expect(readLists('p0: home , brief')).toEqual({ p0: ['home', 'brief'] });
  });
});
