/**
 * The fractional Fourier transform: the spectrum, part of the way there.
 *
 * `lib/fourier.ts` turns a run of samples into its spectrum. This turns it a
 * *fraction* of the way: at order 0 it is the run itself, at order 1 it is the
 * ordinary transform, at order 2 it is the run backwards, at order 4 it is
 * back where it started. Every order between is a real thing, and the family
 * is a rotation — of the plane with time along one axis and frequency along
 * the other, which is the plane `lib/packet.ts` tiles and `lib/hilbert.ts`
 * walks along.
 *
 * ## What it is for
 *
 * A chirp — a wobble that speeds up as it goes — is a sloping line in that
 * plane, and a spectrum looks at the plane from one fixed side. That is why a
 * chirp has no peak in an ordinary spectrum: every frequency is there for a
 * moment. Turn the plane until the line points along an axis and the whole
 * chirp collapses into one spike, exactly as a plain sinusoid does at order 1.
 *
 * So the question this answers is "what is it a chirp *of*", and the reading
 * is the order that concentrates the run best — found by turning the plane a
 * little at a time and seeing where it gathers.
 *
 * ## Why it is built out of eigenvectors rather than out of chirps
 *
 * There is a fast way to do this with three chirp multiplications and a
 * transform, and it is the usual way, and it is an approximation: at order 1
 * it is nearly but not exactly the transform, and doing it twice at order 0.5
 * is nearly but not exactly doing it once at order 1. Near-misses are hard to
 * test and easy to be wrong about.
 *
 * The other way is exact. The ordinary transform has eigenvectors — runs it
 * leaves alone but for a quarter turn of phase — and if you have them, the
 * fractional transform is the same eigenvectors with the phase turned a
 * fraction as far. Every property that ought to hold then holds to the last
 * bit of the float, and `fractional.test.ts` checks all of them as equalities:
 * order 0 is the run, order 1 is the transform, order 2 is the run reversed,
 * order 4 is the run again, and doing `a` then `b` is doing `a + b`.
 *
 * Getting the eigenvectors is Candan's method: a tridiagonal matrix that
 * commutes with the transform, so they share eigenvectors, and that one is
 * symmetric and real and comes apart with Jacobi rotations. What it gives is
 * the *order* — its eigenvectors ranked smoothest first — and that ranking is
 * the whole reason to go through it rather than take any eigenvectors of the
 * transform that come to hand.
 *
 * What it does not give is which quarter turn each one carries. The tempting
 * shortcut, that the k-th smoothest turns k quarters, is not true: the orders
 * skip, and where they skip moves with the count. So the turn is measured
 * rather than assumed, in `basisOf`, which is what makes order 1 the ordinary
 * transform to the last bit — the first thing the tests ask.
 */

import { dft, type Bin } from './fourier';

/** As many samples as this takes at once: the eigenvectors cost a cube of them. */
export const MOST = 256;

/**
 * A real symmetric matrix taken apart, by rotations.
 *
 * Jacobi: pick the biggest off-diagonal entry, turn the two rows and columns
 * it sits on until it is zero, and repeat. Each turn makes some other entry a
 * little bigger and the whole thing a lot smaller, and it converges on every
 * symmetric matrix without exception — which is worth more here than speed,
 * because what comes out has to be orthonormal to the last bit for the
 * transform built on it to be exact.
 */
export function jacobi(input: number[][]): { values: number[]; vectors: number[][] } {
  const n = input.length;
  const a = input.map((row) => [...row]);
  const v: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  );
  for (let sweep = 0; sweep < 100; sweep += 1) {
    let off = 0;
    for (let p = 0; p < n; p += 1) for (let q = p + 1; q < n; q += 1) off += a[p][q] * a[p][q];
    if (off < 1e-30) break;
    for (let p = 0; p < n - 1; p += 1) {
      for (let q = p + 1; q < n; q += 1) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k += 1) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k += 1) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k += 1) {
          const vkp = v[k][p];
          const vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  return { values: a.map((row, i) => row[i]), vectors: v };
}

/**
 * The matrix Candan found that commutes with the transform.
 *
 * Tridiagonal, with the corners joined because a run of samples wraps round.
 * Two matrices that commute share eigenvectors, and this one is real and
 * symmetric where the transform is complex — so its eigenvectors are the
 * transform's, and they can be had by rotations rather than by anything
 * harder.
 */
export function commuting(n: number): number[][] {
  const s: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let k = 0; k < n; k += 1) {
    s[k][k] = 2 * Math.cos((2 * Math.PI * k) / n) - 4;
    s[k][(k + 1) % n] += 1;
    s[(k + 1) % n][k] += 1;
  }
  return s;
}

/**
 * The run backwards, which is what a half turn does to it.
 *
 * Wrapped: the first sample stays where it is and the rest reverse around it,
 * because a run of samples has no end, only a seam.
 */
const reversed = (v: number[]): number[] => v.map((_, k) => v[(v.length - k) % v.length]);

/**
 * A run split into four parts, one per quarter turn.
 *
 * Four goes of the transform land back where they started, so every run is the
 * sum of four pieces and the transform does nothing to each but turn it — a
 * quarter, a half, three quarters, or not at all. Picking a piece out wants
 * only the run, its transform and its reverse, and the pieces of a real run
 * come out real, which is what keeps all of this in plain numbers.
 */
export function quarters(v: number[]): number[][] {
  const root = Math.sqrt(v.length);
  const spectrum = dft(v);
  const back = reversed(v);
  return [0, 1, 2, 3].map((turn) => {
    const half = turn % 2 === 0 ? 1 : -1;
    const twist = (b: Bin) => {
      if (turn === 0) return 2 * b.re;
      if (turn === 1) return -2 * b.im;
      if (turn === 2) return -2 * b.re;
      return 2 * b.im;
    };
    return v.map((x, k) => (x + half * back[k] + twist(spectrum[k]) / root) / 4);
  });
}

/** How long a run is, end to end. */
const size = (v: number[]): number => Math.sqrt(v.reduce((t, x) => t + x * x, 0));

/**
 * What is left of `v` once everything it shares with `seen` is taken away.
 *
 * Twice over, because once is not enough when what comes out is much shorter
 * than what went in — which is exactly the case this is here for, where the
 * answer wanted is a near-nothing left behind by a near-everything.
 */
function stripped(v: number[], seen: number[][]): number[] {
  const out = [...v];
  for (let pass = 0; pass < 2; pass += 1) {
    for (const u of seen) {
      let dot = 0;
      for (let k = 0; k < out.length; k += 1) dot += u[k] * out[k];
      for (let k = 0; k < out.length; k += 1) out[k] -= dot * u[k];
    }
  }
  return out;
}

interface Basis {
  vectors: number[][];
  turns: number[];
}

/*
 * Worked once per length and kept.
 *
 * Taking a matrix apart costs a cube of the count and finding the best order
 * asks for hundreds of transforms at the same length, so doing it once turns
 * a sweep from slow into instant. Nothing here depends on the data, only on
 * how much of it there is.
 */
const kept = new Map<number, Basis>();

/**
 * The eigenvectors in order, each with the quarter turn it actually carries.
 *
 * Candan's matrix supplies the *order*: its eigenvectors, smoothest first, are
 * the smooth-first ones, and that ranking is the whole reason to go through it
 * rather than take any old eigenvectors of the transform.
 *
 * It does not supply the turn. The tempting shortcut — the k-th smoothest
 * turns k quarters — is wrong twice over at small counts. Candan's matrix can
 * have two eigenvectors sharing an eigenvalue, and then no method on earth
 * picks them apart, because within that pair every direction is as good as
 * every other; and even where its eigenvalues are distinct the ranking can
 * disagree with the turns near the rough end, where it stops being a good
 * stand-in for the smooth thing it is copying.
 *
 * So the turn is measured instead. Each ranked eigenvector is split into its
 * four turning pieces, and the piece with anything new left in it — new
 * meaning not already spoken for by an earlier vector of the same turn — is
 * the one kept. Each turn's vectors then take orders `t, t+4, t+8 …` in the
 * order they arrive, which is smoothest first. A vector that shares its
 * eigenvalue with another sorts itself out on the way through: the first of
 * the pair claims whichever turn it leans towards, and the second, finding
 * nothing new left there, takes the other.
 *
 * What comes back is orthonormal to the last bit and turns exactly, which is
 * what the integer orders in `fractional.test.ts` are checking.
 */
export function basisOf(n: number): Basis {
  const had = kept.get(n);
  if (had) return had;
  const { values, vectors } = jacobi(commuting(n));
  const rank = values.map((_, i) => i).sort((i, j) => values[j] - values[i]);
  const taken: number[][][] = [[], [], [], []];
  const made: Basis = { vectors: [], turns: [] };
  for (const i of rank) {
    const parts = quarters(vectors.map((row) => row[i]));
    let turn = 0;
    let rest = parts[0];
    let most = -1;
    for (let t = 0; t < 4; t += 1) {
      const left = stripped(parts[t], taken[t]);
      const big = size(left);
      if (big > most) {
        most = big;
        turn = t;
        rest = left;
      }
    }
    const unit = rest.map((x) => x / most);
    taken[turn].push(unit);
    made.vectors.push(unit);
    made.turns.push(turn + 4 * (taken[turn].length - 1));
  }
  kept.set(n, made);
  return made;
}

/**
 * Every order an `n`-point transform has, smallest first.
 *
 * Not `0 … n-1`: the four turns do not get equal numbers of vectors, so the
 * list skips. It is what the counts come to, read off the basis rather than
 * guessed at.
 */
export const turnsOf = (n: number): number[] => [...basisOf(n).turns].sort((a, b) => a - b);

/**
 * The transform, turned a fraction of the way.
 *
 * Project onto each eigenvector, turn each projection by its own quarter turn
 * times the order, and add them back up. At order 1 every turn is a whole
 * quarter and this is the ordinary transform; at order 0 none of them turn and
 * it is the run itself.
 */
export function fractional(xs: Bin[], order: number): Bin[] {
  const n = xs.length;
  const { vectors, turns } = basisOf(n);
  const out: Bin[] = Array.from({ length: n }, () => ({ re: 0, im: 0 }));
  for (let i = 0; i < n; i += 1) {
    const v = vectors[i];
    let re = 0;
    let im = 0;
    for (let k = 0; k < n; k += 1) {
      re += v[k] * xs[k].re;
      im += v[k] * xs[k].im;
    }
    const angle = (-Math.PI * turns[i] * order) / 2;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const tr = re * c - im * s;
    const ti = re * s + im * c;
    for (let k = 0; k < n; k += 1) {
      out[k].re += v[k] * tr;
      out[k].im += v[k] * ti;
    }
  }
  return out;
}

/** The same, for a run of plain numbers. */
export const fractionalOf = (xs: number[], order: number): Bin[] =>
  fractional(xs.map((v) => ({ re: v, im: 0 })), order);

/** How big each output is — the picture, since what comes back is complex. */
export const sizesOf = (bins: Bin[]): number[] => bins.map((b) => Math.hypot(b.re, b.im));

/**
 * How gathered a run is: the share of it sitting in its single biggest place.
 *
 * A chirp spread across every frequency has a small one; the same chirp turned
 * until it lines up has a large one. That is the whole measure, and it is the
 * one a person would use looking at the picture.
 */
export function gathering(bins: Bin[]): number {
  const sizes = sizesOf(bins);
  const total = sizes.reduce((t, v) => t + v * v, 0);
  if (total <= 0) return 0;
  return Math.max(...sizes.map((v) => (v * v) / total));
}

/**
 * The order that gathers a run best.
 *
 * Coarsely first and then finely about the winner, because the measure has one
 * broad peak and a hundred cheap looks find it better than ten expensive ones.
 * Orders run 0 to 2: past that is the same rotations seen from behind.
 */
export function bestOrder(xs: number[]): { order: number; gathered: number } {
  const look = (from: number, to: number, step: number, best: { order: number; gathered: number }) => {
    for (let a = from; a <= to + 1e-9; a += step) {
      const got = gathering(fractionalOf(xs, a));
      if (got > best.gathered) best = { order: Number(a.toFixed(6)), gathered: got };
    }
    return best;
  };
  let best = { order: 0, gathered: gathering(fractionalOf(xs, 0)) };
  best = look(0, 2, 0.02, best);
  best = look(Math.max(0, best.order - 0.02), Math.min(2, best.order + 0.02), 0.002, best);
  return best;
}

/** The ordinary transform, scaled the way a rotation has to be — for the tests to compare against. */
export const unitaryDft = (xs: number[]): Bin[] =>
  dft(xs).map((b) => ({ re: b.re / Math.sqrt(xs.length), im: b.im / Math.sqrt(xs.length) }));
