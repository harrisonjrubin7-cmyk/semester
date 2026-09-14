/**
 * Wavelets: which scales the wobble is at, and — unlike Fourier — where.
 *
 * `lib/fourier.ts` answers "what frequencies is this made of" and cannot
 * answer "and when". A transform over the whole run has no *when* in it: a
 * spike at week 30 and a wobble spread across the year can give the same
 * spectrum, because a sine has no beginning. That is the honest limit of the
 * three transforms before this one, and it is the reason for this one.
 *
 * A wavelet is a wave with an end to it. Slide it along and stretch it, and
 * what comes back is a number for every place *and* every scale. So the
 * reading here is not a list of frequencies, it is a share per scale and a
 * place where the biggest one is.
 *
 * ## Haar, and why it is the one to start with
 *
 * Averages and differences. Pair the samples up: the average of each pair is
 * the signal at half the resolution, and the difference is what was lost.
 * Repeat on the averages and you have the whole thing — a run of 32 becomes 16
 * averages and 16 differences, then 8 and 8, and so on. Nothing is thrown
 * away, which is why it comes back exactly.
 *
 * That is the entire idea, and Haar is the one wavelet where you can see it
 * without a filter table. Daubechies-4 — written `daubechies` or `db`, since a
 * name in this notation is letters and `d4` is `d` times four — is here beside
 * it because the family is
 * the point: it is four numbers rather than two, and it is *blind to a
 * straight line* — feed it a ramp and every detail comes back zero, where Haar
 * reports the slope at every scale. A test in this file's companion checks
 * exactly that, because it is the difference between the two and not a
 * property either of them can be assumed to have.
 *
 * ## The two things this refuses
 *
 * A length that is not a power of two, because halving is what the transform
 * does and there is no honest way to halve seventeen. And nothing else: it is
 * finite, orthonormal and exact, so there is no convergence to worry about and
 * no case where it half-works.
 *
 * The inverse is the forward transform's transpose, which for an orthonormal
 * filter bank is its inverse exactly. That is not a convenience — it is why
 * `rebuild(analyse(x))` is `x` to the last bit of the float rather than to
 * some tolerance, and it is checked that way.
 */

/** A filter bank: the averaging half and the differencing half. */
export interface Filter {
  name: string;
  /** The low-pass half — what survives the smoothing. */
  low: number[];
  /** The high-pass half, which is the low one reversed with alternating signs. */
  high: number[];
}

const root2 = Math.SQRT2;

/** Averages and differences, which is the whole of it. */
export const HAAR: Filter = {
  name: 'Haar',
  low: [1 / root2, 1 / root2],
  high: [1 / root2, -1 / root2],
};

/** Four numbers rather than two, and blind to a straight line. */
export const D4: Filter = (() => {
  const s = Math.sqrt(3);
  const low = [(1 + s) / (4 * root2), (3 + s) / (4 * root2), (3 - s) / (4 * root2), (1 - s) / (4 * root2)];
  // The quadrature mirror: `g[k] = (-1)^k h[L-1-k]`, which is what makes the
  // transpose the inverse rather than merely something close to it.
  return { name: 'Daubechies-4', low, high: low.map((_, k) => (k % 2 ? -1 : 1) * low[low.length - 1 - k]) };
})();

/** Whether a run can be halved all the way down, which is what this transform does. */
export const halvable = (n: number): boolean => n >= 2 && (n & (n - 1)) === 0;

/** How many times a run can be halved. */
export const depthOf = (n: number): number => Math.round(Math.log2(n));

/**
 * One pass: the run at half the resolution, and what that cost.
 *
 * Wrapped round at the end rather than padded, because a pad invents data and
 * a wrap at least uses the data there is. It is the ordinary choice and it is
 * why a ramp's last detail is not zero even under a filter that is blind to
 * ramps: the wrap is a cliff, and the cliff is real.
 */
export function split(xs: number[], f: Filter): { smooth: number[]; detail: number[] } {
  const n = xs.length;
  const half = n / 2;
  const smooth = new Array<number>(half).fill(0);
  const detail = new Array<number>(half).fill(0);
  for (let i = 0; i < half; i += 1) {
    for (let k = 0; k < f.low.length; k += 1) {
      const x = xs[(2 * i + k) % n];
      smooth[i] += f.low[k] * x;
      detail[i] += f.high[k] * x;
    }
  }
  return { smooth, detail };
}

/** The pass undone — the transpose, which for an orthonormal bank is the inverse. */
export function join(smooth: number[], detail: number[], f: Filter): number[] {
  const half = smooth.length;
  const n = half * 2;
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < half; i += 1) {
    for (let k = 0; k < f.low.length; k += 1) {
      out[(2 * i + k) % n] += f.low[k] * smooth[i] + f.high[k] * detail[i];
    }
  }
  return out;
}

/** A run taken apart: what is left at the coarsest scale, and what each scale held. */
export interface Levels {
  filter: Filter;
  /** What survives at the coarsest scale asked for. */
  smooth: number[];
  /** `details[0]` is the finest scale — every other sample — and the last is the coarsest. */
  details: number[][];
}

/** A run taken apart, as many times as asked or as many as it allows. */
export function analyse(xs: number[], f: Filter = HAAR, depth = depthOf(xs.length)): Levels {
  const most = Math.max(1, Math.min(depth, depthOf(xs.length)));
  const details: number[][] = [];
  let smooth = xs;
  for (let i = 0; i < most; i += 1) {
    const pass = split(smooth, f);
    details.push(pass.detail);
    smooth = pass.smooth;
  }
  return { filter: f, smooth, details };
}

/** And put back together, which is exact. */
export function rebuild(levels: Levels): number[] {
  let smooth = levels.smooth;
  for (let i = levels.details.length - 1; i >= 0; i -= 1) smooth = join(smooth, levels.details[i], levels.filter);
  return smooth;
}

/**
 * The run with the finest scales dropped — the smoothing, at full length.
 *
 * The picture of a multiresolution: level 1 is the data with every other
 * wobble gone, level 3 with everything below eight samples gone, and the last
 * level is the average and nothing else. Done by rebuilding with those details
 * set to nothing rather than by a separate smoother, so what is drawn is
 * exactly what the transform says is there.
 */
export function approximation(xs: number[], f: Filter = HAAR, level = 1): number[] {
  const deep = Math.max(1, Math.min(level, depthOf(xs.length)));
  const levels = analyse(xs, f, deep);
  return rebuild({ ...levels, details: levels.details.map((d) => d.map(() => 0)) });
}

/** How much of the wobble each scale holds, finest first, as shares of one. */
export function shares(levels: Levels): number[] {
  const energy = levels.details.map((d) => d.reduce((t, v) => t + v * v, 0));
  const total = energy.reduce((t, v) => t + v, 0);
  return total > 0 ? energy.map((v) => v / total) : energy.map(() => 0);
}

/**
 * How many samples one coefficient at a level was made from.
 *
 * A two-tap filter at level L covers exactly `2^L` samples, which is the
 * picture everybody has of a wavelet. A four-tap one covers more, and covers
 * more again at every level: `(2^L - 1)(M - 1) + 1`, because each pass feeds
 * on M of the last pass's outputs and those already overlap. It matters for
 * one reason — where a coefficient *is* — and getting it wrong reports
 * Daubechies' answers four or five samples early.
 */
export const reachOf = (level: number, filter: Filter): number =>
  (2 ** level - 1) * (filter.low.length - 1) + 1;

/**
 * The biggest single wobble: which scale, and where in the run.
 *
 * This is the answer Fourier has no way of giving. The place is the middle of
 * the stretch the coefficient was made from — a sample number somebody can
 * look at, rather than a coefficient index they would have to convert — and
 * that stretch depends on the filter as well as the level, which is what
 * `reachOf` is for.
 */
export function loudestDetail(levels: Levels): { level: number; at: number; size: number } | null {
  let best: { level: number; at: number; size: number } | null = null;
  levels.details.forEach((detail, i) => {
    const level = i + 1;
    const middle = (reachOf(level, levels.filter) - 1) / 2;
    detail.forEach((v, k) => {
      if (!best || Math.abs(v) > best.size) {
        best = { level, at: Math.round(2 ** level * k + middle), size: Math.abs(v) };
      }
    });
  });
  return best;
}
