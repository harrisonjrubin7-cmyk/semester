/**
 * Wavelet packets: the same tree, split both ways.
 *
 * `lib/wavelet.ts` halves the run, keeps the averages, and halves those again.
 * The differences it drops out at each level are never split further, so the
 * scales it reports get coarser as they get faster: it separates slow things
 * finely and fast things barely at all. That is the right trade for most runs
 * and it is a trade.
 *
 * A packet transform splits *both* halves at every level — the differences as
 * well as the averages — and what comes out is `2^L` bands of equal width
 * covering the frequencies evenly. So a fast wobble can be pinned down as
 * precisely as a slow one, which is the whole reason the packet tree exists.
 *
 * ## The ordering, which is the part that goes wrong quietly
 *
 * The bands do not come out in frequency order, and nothing about them says
 * so. Every high-pass branch turns the frequency axis over, so at level two
 * the four bands come out as low, second, *fourth, third*. Read in the order
 * they arrive, a run's energy is reported in the wrong bands — plausibly, with
 * no error and no sign of trouble.
 *
 * The fix is the Gray code, and which way round it goes is the trap inside the
 * trap: the band at frequency place `k` is the tree's node `k ^ (k >> 1)`, not
 * the other way about. At level two the Gray code is its own inverse, so both
 * readings agree and a wrong one looks right; at level three they part company
 * and the top four bands come back shuffled. Which is why `packet.test.ts`
 * checks this the only way worth checking it — a sinusoid of a known frequency
 * goes in, and the band it comes out of has to be the band whose range
 * contains it — at level three as well as level two.
 *
 * ## The best basis
 *
 * A packet tree is not one answer but every answer: the full tree at level 3
 * contains the ordinary wavelet transform, the even split into eight, and
 * every mixture of the two. Coifman and Wickerhauser's method picks between
 * them — work out what each node costs, and keep a node whenever it costs less
 * than its two children together. What comes back is the split that describes
 * this particular run most compactly, which is the question a packet tree is
 * for and the one no other transform here can answer.
 */

import { split, type Filter, HAAR, halvable, depthOf } from './wavelet';

/** One node of the tree: which level it is on, where along it, and what is in it. */
export interface Node {
  level: number;
  index: number;
  values: number[];
}

/**
 * Every band at a level, in the order the splitting produces them.
 *
 * Not frequency order — see `inFrequencyOrder`, and the note at the top for
 * why reading these straight is the mistake this file exists to avoid.
 */
export function packets(xs: number[], f: Filter = HAAR, level = 1): number[][] {
  let bands = [xs];
  for (let i = 0; i < level; i += 1) {
    const next: number[][] = [];
    for (const band of bands) {
      const pass = split(band, f);
      next.push(pass.smooth, pass.detail);
    }
    bands = next;
  }
  return bands;
}

/**
 * Which node of the tree sits at a place in frequency.
 *
 * The Gray code. Each high-pass branch reverses the axis below it, and a
 * number's Gray code is exactly the record of how many reversals are above it.
 */
export const naturalOf = (frequency: number): number => frequency ^ (frequency >> 1);

/** And the way back: where a node of the tree sits in frequency. */
export function frequencyOf(natural: number): number {
  let out = 0;
  for (let bit = natural; bit > 0; bit >>= 1) out ^= bit;
  return out;
}

/** The bands of a level, put in the order their frequencies run. */
export function inFrequencyOrder(bands: number[][]): number[][] {
  return bands.map((_, k) => bands[naturalOf(k)]);
}

/** Every band at a level, in frequency order — which is what a reading wants. */
export const banded = (xs: number[], f: Filter = HAAR, level = 1): number[][] =>
  inFrequencyOrder(packets(xs, f, level));

/** How much of the run each band holds, as shares of one. */
export function shares(bands: number[][]): number[] {
  const energy = bands.map((b) => b.reduce((t, v) => t + v * v, 0));
  const total = energy.reduce((t, v) => t + v, 0);
  return total > 0 ? energy.map((v) => v / total) : energy.map(() => 0);
}

/** What a band covers, in cycles per sample — nothing above a half exists. */
export function bandRange(place: number, level: number): { from: number; to: number } {
  const width = 0.5 / 2 ** level;
  return { from: place * width, to: (place + 1) * width };
}

/**
 * What a set of coefficients costs, by Shannon's measure.
 *
 * Energy gathered into a few big coefficients costs little; the same energy
 * spread thinly over many costs a lot. That is what "describes it compactly"
 * means, and the measure is additive down the tree, which is the property that
 * makes the choice below a single sweep rather than a search.
 */
export function cost(values: number[], total: number): number {
  if (total <= 0) return 0;
  let out = 0;
  for (const v of values) {
    const p = (v * v) / total;
    if (p > 0) out -= p * Math.log(p);
  }
  return out;
}

/**
 * The split that describes this run most compactly.
 *
 * Coifman and Wickerhauser: work up from the bottom, and keep a node whenever
 * it costs less than its two children together. The full tree contains the
 * ordinary wavelet transform and the even split and everything between, so
 * what comes back is whichever of those this particular run is happiest in.
 */
export function bestBasis(xs: number[], f: Filter = HAAR, depth = 3): Node[] {
  const total = xs.reduce((t, v) => t + v * v, 0);
  const levels: number[][][] = [[xs]];
  for (let i = 0; i < depth; i += 1) {
    const next: number[][] = [];
    for (const band of levels[i]) {
      const pass = split(band, f);
      next.push(pass.smooth, pass.detail);
    }
    levels.push(next);
  }
  /** What the best basis under a node costs, and which nodes it is made of. */
  const best = (level: number, index: number): { price: number; nodes: Node[] } => {
    const values = levels[level][index];
    const here = { price: cost(values, total), nodes: [{ level, index, values }] };
    if (level >= depth) return here;
    const left = best(level + 1, 2 * index);
    const right = best(level + 1, 2 * index + 1);
    const below = left.price + right.price;
    // The node itself where it is no worse, so a run with nothing to gain from
    // splitting comes back as one band rather than as a tie broken downwards.
    return here.price <= below ? here : { price: below, nodes: [...left.nodes, ...right.nodes] };
  };
  return best(0, 0).nodes;
}

/** Whether a run can be split this many times: a power of two, and long enough. */
export const takes = (length: number, level: number): boolean => halvable(length) && depthOf(length) >= level;
