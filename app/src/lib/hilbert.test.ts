import { describe, expect, it } from 'vitest';
import { analytic, averageFrequency, envelope, frequency, hilbert, loudestMoment, phase } from './hilbert';

/**
 * A quarter turn, checked against the turn it is supposed to be.
 *
 * For a frequency the run can actually hold, the answer is exact: the Hilbert
 * transform of a cosine is that sine and nothing else, to the last bit of the
 * float. So most of this is equalities rather than tolerances, and the two
 * properties that make it a quarter turn rather than something near one —
 * that doing it twice gives minus what you started with, and that the result
 * is at right angles to the original — are checked as such.
 */

const at = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => f(i));
const near = (got: number[], want: number[], places = 9) => {
  expect(got).toHaveLength(want.length);
  got.forEach((v, i) => expect(v).toBeCloseTo(want[i], places));
};

describe('the quarter turn', () => {
  const N = 64;
  const k = 5;
  const cos = at(N, (n) => Math.cos((2 * Math.PI * k * n) / N));
  const sin = at(N, (n) => Math.sin((2 * Math.PI * k * n) / N));

  it('turns a cosine into the sine beside it', () => {
    near(hilbert(cos), sin, 9);
  });

  it('turns a sine into minus the cosine, which is the same turn again', () => {
    near(hilbert(sin), cos.map((v) => -v), 9);
  });

  it('keeps the run it was given as the real half', () => {
    // The whole reason this is one line on top of a transform: the run comes
    // back untouched beside its shift, rather than being reconstructed.
    near(analytic(cos).map((b) => b.re), cos, 12);
  });

  it('does nothing at all to a flat run, which has nothing to turn', () => {
    hilbert(new Array(32).fill(4)).forEach((v) => expect(v).toBeCloseTo(0, 12));
  });

  it('gives back minus the run when done twice', () => {
    near(hilbert(hilbert(cos)), cos.map((v) => -v), 9);
  });

  it('comes out at right angles to what went in', () => {
    const dot = cos.reduce((t, v, i) => t + v * hilbert(cos)[i], 0);
    expect(dot).toBeCloseTo(0, 9);
  });

  it('works at a count the fast transform cannot take', () => {
    const odd = at(6, (n) => Math.cos((2 * Math.PI * n) / 6));
    near(hilbert(odd), at(6, (n) => Math.sin((2 * Math.PI * n) / 6)), 9);
  });
});

describe('the envelope', () => {
  it('is the amplitude of a plain wave, flat all the way along', () => {
    const xs = at(64, (n) => 3 * Math.cos((2 * Math.PI * 7 * n) / 64));
    envelope(xs).forEach((v) => expect(v).toBeCloseTo(3, 9));
  });

  it('follows an amplitude that changes, which is what it is for', () => {
    // A wave that fades: the envelope should trace the fading, not the wave.
    const size = (n: number) => 1 + Math.cos((2 * Math.PI * n) / 128) ** 2;
    const xs = at(128, (n) => size(n) * Math.cos((2 * Math.PI * 24 * n) / 128));
    const got = envelope(xs);
    // Away from the two ends, where the wrap-around shows.
    for (let n = 8; n < 120; n += 1) expect(got[n]).toBeCloseTo(size(n), 1);
  });

  it('is never below the run it came from', () => {
    const xs = at(64, (n) => Math.sin(n) + 0.4 * Math.sin(3.1 * n));
    envelope(xs).forEach((v, i) => expect(v).toBeGreaterThanOrEqual(Math.abs(xs[i]) - 1e-9));
  });

  it('says where the loudest moment is', () => {
    // A burst in the middle of a quiet run.
    const xs = at(128, (n) => (n > 56 && n < 72 ? 5 : 0.05) * Math.cos((2 * Math.PI * 16 * n) / 128));
    const got = loudestMoment(xs);
    expect(got.at).toBeGreaterThan(50);
    expect(got.at).toBeLessThan(78);
    expect(got.size).toBeGreaterThan(3);
  });
});

describe('how fast it is turning', () => {
  it('is the frequency of a plain wave, at every moment of it', () => {
    for (const k of [3, 9, 20]) {
      const xs = at(128, (n) => Math.cos((2 * Math.PI * k * n) / 128));
      const got = frequency(xs);
      for (let n = 2; n < 126; n += 1) expect(got[n]).toBeCloseTo(k / 128, 9);
      expect(averageFrequency(xs)).toBeCloseTo(k / 128, 9);
    }
  });

  it('follows a frequency that moves, which a spectrum cannot', () => {
    /*
     * A chirp: it starts slow and ends fast. A spectrum of the whole run says
     * "everything between", and says nothing about which end is which. This
     * says it sample by sample, which is the entire point of the transform.
     */
    const rate = (n: number) => 0.05 + (0.15 * n) / 256;
    const xs = at(256, (n) => Math.cos(2 * Math.PI * (0.05 * n + (0.15 * n * n) / 512)));
    const got = frequency(xs);
    for (const n of [40, 128, 210]) expect(got[n]).toBeCloseTo(rate(n), 2);
    expect(got[210]).toBeGreaterThan(got[40]);
  });

  it('climbs without a sawtooth in it, because the angle is unwound', () => {
    const xs = at(64, (n) => Math.cos((2 * Math.PI * 5 * n) / 64));
    const angles = phase(xs);
    for (let n = 1; n < 64; n += 1) expect(angles[n]).toBeGreaterThan(angles[n - 1]);
  });

  it('weights the average by how loud it is, not by how many samples are quiet', () => {
    // Almost all of this run is silence, where an angle means nothing at all.
    const xs = at(256, (n) => (n > 100 && n < 156 ? 1 : 1e-6) * Math.cos((2 * Math.PI * 32 * n) / 256));
    expect(averageFrequency(xs)).toBeCloseTo(32 / 256, 2);
  });
});
