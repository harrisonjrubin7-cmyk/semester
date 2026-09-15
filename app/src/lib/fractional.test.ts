import { describe, expect, it } from 'vitest';
import type { Bin } from './fourier';
import {
  basisOf,
  bestOrder,
  commuting,
  fractional,
  fractionalOf,
  gathering,
  jacobi,
  sizesOf,
  turnsOf,
  unitaryDft,
} from './fractional';

/**
 * A rotation, checked against the things a rotation has to be.
 *
 * This is the one transform here whose correctness is a set of exact
 * equalities rather than a table to compare against: turning nothing of the
 * way is the run, turning all of the way is the transform, turning twice as
 * far is the run backwards, turning four times is home again, and turning `a`
 * then `b` is turning `a + b`. Every one of those is checked to ten places or
 * better, which is why the eigenvector route was worth taking over the chirp
 * one — the chirp route satisfies none of them exactly.
 */

const real = (xs: number[]): Bin[] => xs.map((v) => ({ re: v, im: 0 }));
const near = (got: Bin[], want: Bin[], places = 9) => {
  expect(got).toHaveLength(want.length);
  got.forEach((b, i) => {
    expect(b.re).toBeCloseTo(want[i].re, places);
    expect(b.im).toBeCloseTo(want[i].im, places);
  });
};
const run = [3, -1, 4, 1, -5, 9, 2, 6];
const chirp = (n: number, from: number, to: number) =>
  Array.from({ length: n }, (_, i) => Math.cos(2 * Math.PI * (from * i + ((to - from) * i * i) / (2 * n))));

describe('taking a symmetric matrix apart', () => {
  it('gives vectors that are at right angles and of unit length', () => {
    const { vectors } = jacobi(commuting(16));
    for (let i = 0; i < 16; i += 1) {
      for (let j = 0; j < 16; j += 1) {
        const dot = vectors.reduce((t, row) => t + row[i] * row[j], 0);
        expect(dot).toBeCloseTo(i === j ? 1 : 0, 9);
      }
    }
  });

  it('puts the matrix back together from what it found', () => {
    const s = commuting(8);
    const { values, vectors } = jacobi(s);
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        const back = values.reduce((t, v, i) => t + v * vectors[r][i] * vectors[c][i], 0);
        expect(back).toBeCloseTo(s[r][c], 9);
      }
    }
  });

  it('knows that an even count skips a quarter turn at the end', () => {
    expect(turnsOf(8)).toEqual([0, 1, 2, 3, 4, 5, 6, 8]);
    expect(turnsOf(7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('works the basis out once and keeps it', () => {
    expect(basisOf(16)).toBe(basisOf(16));
  });

  it('hands back a basis that is still at right angles after the sorting out', () => {
    const { vectors } = basisOf(12);
    vectors.forEach((a, i) => {
      vectors.forEach((b, j) => {
        expect(a.reduce((t, x, k) => t + x * b[k], 0)).toBeCloseTo(i === j ? 1 : 0, 9);
      });
    });
  });

  it('does not simply give the k-th smoothest vector the k-th quarter turn', () => {
    // Where the eigenvalues stop being a good stand-in for smoothness, the
    // ranking and the turns come apart: 6 then 8 then 7, not 6, 7, 8. Reading
    // the turn off the rank instead of measuring it is what stopped order 1
    // being the transform.
    expect(basisOf(16).turns).toEqual([0, 1, 2, 3, 4, 5, 6, 8, 7, 10, 9, 12, 11, 14, 13, 16]);
  });

  it('sorts a pair that shares an eigenvalue into different turns', () => {
    // Candan's matrix has a repeated eigenvalue at eight samples, and within
    // that pair every direction is as good as every other — so the two have to
    // be told apart by the turns they carry, not by the matrix.
    expect(basisOf(8).turns).toEqual([0, 1, 2, 3, 4, 6, 5, 8]);
  });
});

describe('the four turns everybody knows', () => {
  it('leaves the run alone at no turn at all', () => {
    near(fractionalOf(run, 0), real(run), 10);
  });

  it('is the ordinary transform at one', () => {
    // The test the whole eigenvector route exists to pass, and the one the
    // ordering at the end of `turnsOf` is the difference between.
    near(fractionalOf(run, 1), unitaryDft(run), 9);
  });

  it('is the run backwards at two', () => {
    const back = run.map((_, i) => run[(run.length - i) % run.length]);
    near(fractionalOf(run, 2), real(back), 9);
  });

  it('is the transform backwards at three, and home again at four', () => {
    const undone = unitaryDft(run).map((b) => ({ re: b.re, im: -b.im }));
    near(fractionalOf(run, 3), undone, 9);
    near(fractionalOf(run, 4), real(run), 9);
  });
});

describe('what makes it a rotation', () => {
  it('adds up: turning a then b is turning a and b together', () => {
    for (const [a, b] of [
      [0.3, 0.4],
      [0.5, 0.5],
      [1.2, 0.9],
      [-0.7, 1.7],
    ]) {
      near(fractional(fractionalOf(run, a), b), fractionalOf(run, a + b), 8);
    }
  });

  it('comes undone by turning back', () => {
    for (const a of [0.25, 0.8, 1.5, 2.6]) {
      near(fractional(fractionalOf(run, a), -a), real(run), 8);
    }
  });

  it('keeps the energy at every order, which is what a turn does', () => {
    const there = run.reduce((t, v) => t + v * v, 0);
    for (const a of [0, 0.15, 0.5, 1, 1.75, 2, 3.4]) {
      const back = fractionalOf(run, a).reduce((t, b) => t + b.re * b.re + b.im * b.im, 0);
      expect(back).toBeCloseTo(there, 8);
    }
  });

  it('goes round in four, at any order', () => {
    for (const a of [0.3, 1.1, 2.7]) near(fractionalOf(run, a + 4), fractionalOf(run, a), 8);
  });

  it('holds at an odd count too, where the turns do not skip', () => {
    const odd = [1, -2, 3, -4, 5];
    near(fractionalOf(odd, 1), unitaryDft(odd), 9);
    near(fractional(fractionalOf(odd, 0.6), 0.4), unitaryDft(odd), 8);
  });
});

describe('finding the chirp', () => {
  it('gathers a plain wave best at the ordinary transform', () => {
    const xs = Array.from({ length: 32 }, (_, n) => Math.cos((2 * Math.PI * 5 * n) / 32));
    const got = bestOrder(xs);
    expect(Math.min(Math.abs(got.order - 1), Math.abs(got.order - 3))).toBeLessThan(0.05);
    expect(got.gathered).toBeGreaterThan(0.45);
  });

  it('gathers a chirp somewhere else, which is the point of the whole thing', () => {
    /*
     * A spectrum cannot find a chirp: every frequency is there for a moment,
     * so nothing stands out. Turned to the right order it collapses to a spike
     * — and the order it collapses at is what the chirp is, which is the one
     * question none of the other transforms here answers.
     */
    const xs = chirp(64, 0.05, 0.35);
    const got = bestOrder(xs);
    expect(Math.abs(got.order - 1)).toBeGreaterThan(0.1);
    // And it is a better peak than the ordinary transform manages.
    expect(got.gathered).toBeGreaterThan(gathering(fractionalOf(xs, 1)) * 1.5);
  });

  it('finds a steeper chirp at a different order than a shallower one', () => {
    const gentle = bestOrder(chirp(64, 0.05, 0.2));
    const steep = bestOrder(chirp(64, 0.05, 0.45));
    expect(Math.abs(gentle.order - steep.order)).toBeGreaterThan(0.05);
  });

  it('has nothing to gather in a run that never moves', () => {
    expect(gathering(fractionalOf(new Array(16).fill(0), 0.5))).toBe(0);
  });

  it('measures what is drawn, so the sentence and the picture agree', () => {
    const xs = chirp(32, 0.05, 0.3);
    const bins = fractionalOf(xs, 0.6);
    const sizes = sizesOf(bins);
    const total = sizes.reduce((t, v) => t + v * v, 0);
    expect(gathering(bins)).toBeCloseTo(Math.max(...sizes) ** 2 / total, 12);
  });
});
