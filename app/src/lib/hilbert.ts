/**
 * Hilbert: the shape a wobble is wobbling inside.
 *
 * Every transform before this one answers a question about a whole run at
 * once — which frequencies, which scales, which poles. This one answers a
 * question about every moment of it: how big is the wobble *here*, and how
 * fast is it turning *here*. A signal that swells and fades, or drifts from
 * one frequency to another, is the ordinary case in anything measured, and it
 * is the case none of the others say much about.
 *
 * ## What the transform is, and the one line of arithmetic it takes
 *
 * The Hilbert transform turns every component of a signal a quarter turn:
 * a cosine becomes a sine, a sine becomes minus a cosine. Written as an
 * integral it is awkward — a principal value over the whole line — and
 * written as a spectrum it is one line:
 *
 *   take the transform, throw the negative frequencies away, double the rest.
 *
 * What comes back is complex, and it is the *analytic signal*: the run is its
 * real part and the quarter-turn shift is its imaginary part. That is why this
 * file is thirty lines on top of `lib/fourier.ts` rather than an integrator of
 * its own, and why `Re(analytic(x))` is `x` to the last bit of the float — a
 * fact worth checking, and checked.
 *
 * ## What it is for
 *
 * The size of the analytic signal at each moment is the **envelope** — the
 * shape the wobble is wobbling inside, which is what somebody means by "it is
 * dying away" or "it swells in March". The rate its angle turns is the
 * **instantaneous frequency** — one number per sample, where a spectrum gives
 * one set of numbers for the whole run.
 *
 * ## The edge, said out loud
 *
 * The spectrum of a finite run assumes it repeats, so the envelope near the
 * two ends is affected by the other end. That is inherent to computing this
 * through a transform rather than a fault here, and it is why the reading
 * names where the envelope peaks rather than claiming the first and last
 * samples are as trustworthy as the middle.
 */

import { dft, icdft, type Bin } from './fourier';

/**
 * The run and its quarter turn, as one complex signal.
 *
 * The negative half of the spectrum carries no information a real signal did
 * not already put in the positive half, so dropping it and doubling what is
 * left loses nothing and gains the imaginary part. The nought-th bin is the
 * average and the middle one — where there is one — is its own mirror, so
 * neither is doubled: that is the line every implementation gets wrong once.
 */
export function analytic(xs: number[]): Bin[] {
  const n = xs.length;
  const bins = dft(xs);
  const half = Math.floor(n / 2);
  const kept = bins.map((b, k) => {
    if (k === 0) return b;
    if (n % 2 === 0 && k === half) return b;
    if (k < half + (n % 2)) return { re: 2 * b.re, im: 2 * b.im };
    return { re: 0, im: 0 };
  });
  return icdft(kept);
}

/** The quarter turn on its own: a cosine comes back as a sine. */
export const hilbert = (xs: number[]): number[] => analytic(xs).map((b) => b.im);

/** How big the wobble is at each moment — the shape it is wobbling inside. */
export const envelope = (xs: number[]): number[] => analytic(xs).map((b) => Math.hypot(b.re, b.im));

/**
 * The angle, unwound.
 *
 * `atan2` comes back between −π and π, so a signal that keeps turning looks
 * like a sawtooth rather than a climb. Unwinding it — adding a turn whenever
 * it jumps back — is what makes the difference between one sample and the next
 * mean a frequency rather than a jump.
 */
export function phase(xs: number[]): number[] {
  let turns = 0;
  let last = 0;
  return analytic(xs).map((b, i) => {
    const angle = Math.atan2(b.im, b.re);
    if (i > 0) {
      const step = angle - last;
      if (step > Math.PI) turns -= 1;
      else if (step < -Math.PI) turns += 1;
    }
    last = angle;
    return angle + 2 * Math.PI * turns;
  });
}

/** How fast it is turning at each moment, in cycles per sample. */
export function frequency(xs: number[]): number[] {
  const angles = phase(xs);
  const n = angles.length;
  return angles.map((_, i) => {
    const before = Math.max(0, i - 1);
    const after = Math.min(n - 1, i + 1);
    const span = after - before;
    return span > 0 ? (angles[after] - angles[before]) / (span * 2 * Math.PI) : 0;
  });
}

/** Where the envelope is at its biggest, and how big that is. */
export function loudestMoment(xs: number[]): { at: number; size: number } {
  const sizes = envelope(xs);
  let at = 0;
  sizes.forEach((v, i) => {
    if (v > sizes[at]) at = i;
  });
  return { at, size: sizes[at] };
}

/**
 * The average turn rate, weighted by how loud it is there.
 *
 * A plain average over every sample is dominated by the quiet stretches, where
 * the angle of something near nothing wanders about and means very little.
 * Weighting by the envelope asks the question somebody means: how fast is this
 * turning *where there is something to turn*.
 */
export function averageFrequency(xs: number[]): number {
  const sizes = envelope(xs);
  const rates = frequency(xs);
  let top = 0;
  let bottom = 0;
  // The ends are where the wrap-around shows, so they are left out of the average.
  for (let i = 1; i < xs.length - 1; i += 1) {
    top += sizes[i] * rates[i];
    bottom += sizes[i];
  }
  return bottom > 0 ? top / bottom : 0;
}
