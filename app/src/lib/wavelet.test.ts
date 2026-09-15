import { describe, expect, it } from 'vitest';
import {
  D4,
  HAAR,
  analyse,
  approximation,
  depthOf,
  halvable,
  join,
  loudestDetail,
  reachOf,
  rebuild,
  shares,
  split,
} from './wavelet';

/**
 * Wavelets, against answers that can be worked on paper.
 *
 * Haar is averages and differences, so its first pass can be written out by
 * hand and is. The rest is checked by the two properties that make a filter
 * bank a transform rather than a smoother: it comes back exactly, and it keeps
 * the energy it was given. And the one thing that distinguishes the two
 * filters here — that Daubechies-4 is blind to a straight line and Haar is not
 * — is checked directly, because it is the reason for having both and not a
 * property either can be assumed to have.
 */

const near = (got: number[], want: number[], places = 9) => {
  expect(got).toHaveLength(want.length);
  got.forEach((v, i) => expect(v).toBeCloseTo(want[i], places));
};

describe('one pass', () => {
  it('is averages and differences, scaled so nothing is gained or lost', () => {
    // (a+b)/√2 and (a−b)/√2 — the √2 is what makes the energy come out equal.
    const { smooth, detail } = split([4, 2, 6, 10], HAAR);
    near(smooth, [6 / Math.SQRT2, 16 / Math.SQRT2]);
    near(detail, [2 / Math.SQRT2, -4 / Math.SQRT2]);
  });

  it('undoes itself exactly', () => {
    const xs = [4, 2, 6, 10, -3, 7, 0, 1];
    for (const f of [HAAR, D4]) {
      const { smooth, detail } = split(xs, f);
      near(join(smooth, detail, f), xs, 12);
    }
  });

  it('keeps the energy, which is what orthonormal means', () => {
    const xs = [3, -1, 4, 1, -5, 9, 2, 6];
    const there = xs.reduce((t, v) => t + v * v, 0);
    for (const f of [HAAR, D4]) {
      const { smooth, detail } = split(xs, f);
      const back = [...smooth, ...detail].reduce((t, v) => t + v * v, 0);
      expect(back).toBeCloseTo(there, 9);
    }
  });
});

describe('the whole transform', () => {
  const xs = [4, 2, 6, 10, -3, 7, 0, 1, 5, 5, 5, 5, 12, -2, 3, 8];

  it('halves the run at every level, down to one', () => {
    const levels = analyse(xs, HAAR);
    expect(levels.details.map((d) => d.length)).toEqual([8, 4, 2, 1]);
    expect(levels.smooth).toHaveLength(1);
    expect(depthOf(16)).toBe(4);
  });

  it('comes back as what it was, to the last bit of the float', () => {
    for (const f of [HAAR, D4]) {
      for (const depth of [1, 2, 4]) near(rebuild(analyse(xs, f, depth)), xs, 12);
    }
  });

  it('keeps the average in the coarsest level and nowhere else', () => {
    const levels = analyse(xs, HAAR);
    const mean = xs.reduce((t, v) => t + v, 0) / xs.length;
    // One coefficient at the bottom, scaled by √N: that is the average.
    expect(levels.smooth[0] / Math.sqrt(xs.length)).toBeCloseTo(mean, 9);
  });

  it('stops where the run stops rather than asking for more halvings than there are', () => {
    expect(analyse(xs, HAAR, 99).details).toHaveLength(4);
    expect(analyse(xs, HAAR, 0).details).toHaveLength(1);
  });
});

describe('what tells the two filters apart', () => {
  // A ramp, which is the case the whole family is built around.
  const ramp = Array.from({ length: 16 }, (_, n) => 3 * n + 1);

  it('leaves Daubechies-4 with nothing to say about a straight line', () => {
    const detail = analyse(ramp, D4, 1).details[0];
    // Every one but the two at the wrap, where the ramp falls off a cliff.
    detail.slice(0, -2).forEach((v) => expect(v).toBeCloseTo(0, 9));
  });

  it('and leaves Haar reporting the slope at every one of them', () => {
    const detail = analyse(ramp, HAAR, 1).details[0];
    // (x[2i] − x[2i+1])/√2 is −3/√2 wherever the ramp is a ramp.
    detail.slice(0, -1).forEach((v) => expect(v).toBeCloseTo(-3 / Math.SQRT2, 9));
  });

  it('leaves both with nothing to say about a flat run', () => {
    const flat = new Array(16).fill(7);
    for (const f of [HAAR, D4]) {
      analyse(flat, f, 1).details[0].forEach((v) => expect(v).toBeCloseTo(0, 9));
    }
  });
});

describe('the smoothing, which is the picture', () => {
  const xs = [4, 2, 6, 10, -3, 7, 0, 1];

  it('is a staircase of averages under Haar', () => {
    // Level 1 replaces each pair with its average, twice over.
    near(approximation(xs, HAAR, 1), [3, 3, 8, 8, 2, 2, 0.5, 0.5], 9);
    near(approximation(xs, HAAR, 2), [5.5, 5.5, 5.5, 5.5, 1.25, 1.25, 1.25, 1.25], 9);
  });

  it('flattens to the average once every scale is dropped', () => {
    const mean = xs.reduce((t, v) => t + v, 0) / xs.length;
    approximation(xs, HAAR, 3).forEach((v) => expect(v).toBeCloseTo(mean, 9));
  });

  it('is the run itself where nothing has been dropped', () => {
    near(rebuild(analyse(xs, HAAR, 1)), xs, 12);
  });
});

describe('what it says about a run', () => {
  it('puts a slow wave at the coarse scales and the fastest one at the finest', () => {
    const slow = Array.from({ length: 64 }, (_, n) => Math.sin((2 * Math.PI * n) / 64));
    // The fastest thing 64 samples can hold: up, down, up, down.
    const fastest = Array.from({ length: 64 }, (_, n) => (-1) ** n);
    const slowShares = shares(analyse(slow, HAAR));
    const fastShares = shares(analyse(fastest, HAAR));
    // The finest scale is level 1; the coarsest is last.
    expect(slowShares[slowShares.length - 1]).toBeGreaterThan(slowShares[0]);
    expect(fastShares[0]).toBeCloseTo(1, 12);
  });

  it('spreads a wave between two scales where it sits between them, which Haar does', () => {
    /*
     * A sine of period four is not a fine-scale thing or a coarse-scale one.
     *
     * Haar's filters are two samples long, so they tell scales apart bluntly:
     * a period-four wave lands half on level 1 and half on level 2, exactly.
     * That is a property of this wavelet rather than a fault in the run, and
     * it is the price of the simplicity that makes Haar worth teaching — a
     * longer filter tells neighbouring scales apart better.
     */
    const between = Array.from({ length: 64 }, (_, n) => Math.sin((2 * Math.PI * 16 * n) / 64));
    const got = shares(analyse(between, HAAR));
    expect(got[0]).toBeCloseTo(0.5, 9);
    expect(got[1]).toBeCloseTo(0.5, 9);
    expect(got.slice(2).every((v) => v < 1e-12)).toBe(true);
  });

  it('adds up to all of the wobble and none of the average', () => {
    const xs = [3, -1, 4, 1, -5, 9, 2, 6];
    expect(shares(analyse(xs, HAAR)).reduce((t, v) => t + v, 0)).toBeCloseTo(1, 12);
    expect(shares(analyse(new Array(8).fill(2), HAAR)).every((v) => v === 0)).toBe(true);
  });

  it('says where the biggest wobble is, which is what Fourier cannot', () => {
    // A flat run with one step in it at sample 40: a spectrum would spread that
    // across every frequency and say nothing about where it was.
    const xs = Array.from({ length: 64 }, (_, n) => (n < 40 ? 0 : 10));
    const got = loudestDetail(analyse(xs, HAAR));
    expect(got?.at).toBeGreaterThan(24);
    expect(got?.at).toBeLessThan(56);
    expect(got?.level).toBeGreaterThan(2);
  });

  it('has nothing to point at in a run that never moves', () => {
    expect(loudestDetail(analyse(new Array(8).fill(3), HAAR))?.size).toBeCloseTo(0, 12);
  });
});

describe('the length it needs', () => {
  it('knows which runs can be halved all the way down', () => {
    expect([2, 4, 8, 16, 1024].map(halvable)).toEqual([true, true, true, true, true]);
    expect([0, 1, 3, 6, 12, 17].map(halvable)).toEqual([false, false, false, false, false, false]);
  });
});

/**
 * Where a coefficient is, which is the half of the answer Fourier has not got.
 *
 * A two-tap filter at level L was made from exactly 2^L samples; a four-tap
 * one was made from more, and from more again at every level. Reporting the
 * second as though it were the first puts Daubechies' answers four or five
 * samples early, which is wrong in exactly the dimension this transform exists
 * to be right in.
 */
describe('the stretch a coefficient came from', () => {
  it('is the level for Haar and wider for a longer filter', () => {
    expect([1, 2, 3].map((l) => reachOf(l, HAAR))).toEqual([2, 4, 8]);
    expect([1, 2, 3].map((l) => reachOf(l, D4))).toEqual([4, 10, 22]);
  });

  it('puts a step where the step is, under either filter', () => {
    const xs = Array.from({ length: 64 }, (_, n) => (n < 40 ? 0 : 10));
    for (const f of [HAAR, D4]) {
      const got = loudestDetail(analyse(xs, f));
      expect(Math.abs((got?.at ?? 0) - 40)).toBeLessThan(reachOf(got?.level ?? 1, f));
    }
  });

  it('starts a level-1 coefficient where its samples start', () => {
    // Haar's first level-1 coefficient is samples 0 and 1: the middle is a half.
    const spike = [0, 0, 0, 0, 0, 0, 9, 0];
    expect(loudestDetail(analyse(spike, HAAR, 1))?.at).toBe(7);
  });
});
