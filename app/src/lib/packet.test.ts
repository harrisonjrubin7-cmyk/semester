import { describe, expect, it } from 'vitest';
import { D4, HAAR } from './wavelet';
import {
  banded,
  bandRange,
  bestBasis,
  cost,
  frequencyOf,
  inFrequencyOrder,
  naturalOf,
  packets,
  shares,
  takes,
} from './packet';

/**
 * The packet tree, and the ordering that is the whole difficulty of it.
 *
 * The arithmetic is `lib/wavelet.ts` applied twice as often, so most of it is
 * already checked there. What is new here is which band is which, and that is
 * checked the only way worth checking it: a sinusoid of a known frequency goes
 * in, and the band it comes out of has to be the band whose range contains it.
 * A wrong permutation passes every structural test ever written and fails that
 * one immediately.
 */

const wave = (n: number, cycles: number) => Array.from({ length: n }, (_, i) => Math.cos(2 * Math.PI * cycles * i));
const loudest = (bands: number[][]) => {
  const energy = bands.map((b) => b.reduce((t, v) => t + v * v, 0));
  return energy.indexOf(Math.max(...energy));
};

describe('the tree', () => {
  it('splits both halves, so a level has twice the bands the last one had', () => {
    const xs = Array.from({ length: 64 }, (_, n) => Math.sin(n));
    expect(packets(xs, HAAR, 1)).toHaveLength(2);
    expect(packets(xs, HAAR, 3)).toHaveLength(8);
    expect(packets(xs, HAAR, 3).every((b) => b.length === 8)).toBe(true);
  });

  it('keeps the energy it was given, at every level', () => {
    const xs = [3, -1, 4, 1, -5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3];
    const there = xs.reduce((t, v) => t + v * v, 0);
    for (const f of [HAAR, D4]) {
      for (const level of [1, 2, 3, 4]) {
        const back = packets(xs, f, level).flat().reduce((t, v) => t + v * v, 0);
        expect(back).toBeCloseTo(there, 9);
      }
    }
  });

  it('adds up to all of the run, whichever way the bands are ordered', () => {
    const xs = Array.from({ length: 32 }, (_, n) => Math.sin(n) + 0.3 * n);
    expect(shares(banded(xs, HAAR, 3)).reduce((t, v) => t + v, 0)).toBeCloseTo(1, 12);
  });
});

describe('which band is which', () => {
  it('is the Gray code, which turns over under every high-pass branch', () => {
    // Level two comes out low, second, fourth, third — not in order.
    expect([0, 1, 2, 3].map(naturalOf)).toEqual([0, 1, 3, 2]);
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(naturalOf)).toEqual([0, 1, 3, 2, 6, 7, 5, 4]);
  });

  it('goes the way it goes, which level two cannot tell you', () => {
    /*
     * The trap inside the trap.
     *
     * At level two the Gray code is its own inverse, so using it backwards
     * gives the same four bands and looks right. At level three it does not:
     * the two readings differ in the top four, and one of them is wrong.
     */
    expect([0, 1, 2, 3].map(naturalOf)).toEqual([0, 1, 2, 3].map(frequencyOf));
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(frequencyOf)).toEqual([0, 1, 3, 2, 7, 6, 4, 5]);
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(naturalOf)).not.toEqual([0, 1, 2, 3, 4, 5, 6, 7].map(frequencyOf));
  });

  it('reorders the bands themselves, not only their numbers', () => {
    const xs = Array.from({ length: 64 }, (_, n) => Math.sin(n) + 0.4 * Math.cos(2.7 * n));
    const natural = packets(xs, HAAR, 3);
    const ordered = inFrequencyOrder(natural);
    expect(ordered).toHaveLength(natural.length);
    ordered.forEach((band, k) => expect(band).toBe(natural[naturalOf(k)]));
    // Every band used once: a permutation, not a sample with repeats.
    expect(new Set(ordered).size).toBe(natural.length);
  });

  it('undoes itself, so a place in frequency names exactly one band', () => {
    for (const level of [1, 2, 3, 4]) {
      for (let k = 0; k < 2 ** level; k += 1) expect(frequencyOf(naturalOf(k))).toBe(k);
      for (let k = 0; k < 2 ** level; k += 1) expect(naturalOf(frequencyOf(k))).toBe(k);
    }
  });

  it('puts a sinusoid in the band whose range contains it', () => {
    /*
     * The test the ordering exists for.
     *
     * A wrong permutation is invisible to every structural check — the bands
     * are all there, the energy adds up, nothing throws — and it reports a
     * run's energy at the wrong frequencies. So: build a wave at the middle of
     * each band in turn, and ask which band it came out of.
     */
    for (const f of [HAAR, D4]) {
      for (const level of [2, 3]) {
        for (let k = 0; k < 2 ** level; k += 1) {
          const { from, to } = bandRange(k, level);
          const xs = wave(128, (from + to) / 2);
          expect(loudest(banded(xs, f, level))).toBe(k);
        }
      }
    }
  });

  it('and the order they arrive in is not that order, which is the point', () => {
    // The top band of four: reading the tree straight puts it third.
    const { from, to } = bandRange(3, 2);
    const xs = wave(128, (from + to) / 2);
    expect(loudest(banded(xs, D4, 2))).toBe(3);
    expect(loudest(packets(xs, D4, 2))).toBe(2);
  });

  it('covers the whole of what a run can hold, evenly and once each', () => {
    const ranges = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => bandRange(k, 3));
    expect(ranges[0].from).toBe(0);
    expect(ranges[7].to).toBeCloseTo(0.5, 12);
    ranges.forEach((r, k) => {
      if (k > 0) expect(r.from).toBeCloseTo(ranges[k - 1].to, 12);
    });
  });

  it('separates two fast waves the ordinary transform lumps together', () => {
    /*
     * The reason for the whole tree.
     *
     * `lib/wavelet.ts` never splits its detail bands, so everything from a
     * quarter of the rate upwards lands in one. Packets split it eight ways,
     * so two fast waves land in two different bands rather than in the same.
     */
    const near = wave(256, 0.28);
    const far = wave(256, 0.47);
    expect(loudest(banded(near, D4, 3))).not.toBe(loudest(banded(far, D4, 3)));
    expect(loudest(banded(near, D4, 3))).toBe(4);
    expect(loudest(banded(far, D4, 3))).toBe(7);
  });
});

describe('the best basis', () => {
  it('leaves a run alone when splitting it would only spread it', () => {
    // One spike: all the energy is already in one place, and every split
    // scatters it. The cheapest description is the run itself.
    const spike = [0, 0, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(bestBasis(spike, HAAR, 3)).toEqual([{ level: 0, index: 0, values: spike }]);
  });

  it('splits a run that has a frequency in it, because that gathers it up', () => {
    const xs = wave(64, 0.32);
    const basis = bestBasis(xs, D4, 3);
    expect(basis.length).toBeGreaterThan(1);
    // Every band of a basis, laid end to end, is the length of the run.
    expect(basis.reduce((t, n) => t + n.values.length, 0)).toBe(64);
  });

  it('is a basis: every part of the tree covered once and no part twice', () => {
    for (const xs of [wave(64, 0.1), wave(64, 0.4), Array.from({ length: 64 }, (_, n) => n % 7)]) {
      const basis = bestBasis(xs, HAAR, 4);
      expect(basis.reduce((t, n) => t + n.values.length, 0)).toBe(64);
      // No node may be an ancestor of another: that would cover twice.
      for (const a of basis) {
        for (const b of basis) {
          if (a === b) continue;
          if (a.level >= b.level) continue;
          const under = b.index >> (b.level - a.level);
          expect(under).not.toBe(a.index);
        }
      }
    }
  });

  it('costs nothing for one coefficient holding everything, and more as it spreads', () => {
    expect(cost([5], 25)).toBeCloseTo(0, 12);
    expect(cost([1, 1, 1, 1], 4)).toBeCloseTo(Math.log(4), 12);
    expect(cost([2, 0, 0, 0], 4)).toBeCloseTo(0, 12);
    expect(cost([1, 1, 1, 1], 4)).toBeGreaterThan(cost([1.9, 0.2, 0.2, 0.2], 4));
  });
});

describe('the run it needs', () => {
  it('wants a power of two, long enough to split that many times', () => {
    expect(takes(16, 4)).toBe(true);
    expect(takes(16, 5)).toBe(false);
    expect(takes(12, 2)).toBe(false);
    expect(takes(1, 1)).toBe(false);
  });
});
