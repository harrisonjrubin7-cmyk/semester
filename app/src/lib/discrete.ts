/**
 * The z-transform: Laplace for things that happen on the beat.
 *
 * `lib/laplace.ts` is about a quantity that changes continuously. A great deal
 * of what a student in econ or methods actually has is not continuous: a
 * balance after each month, a reading each second, a series each quarter. That
 * is a sequence `x[n]`, its calculus is difference equations rather than
 * differential ones, and its transform is this one.
 *
 *   `Z{0.5^n}`            the transform, read and drawn against z
 *   `Z^{-1}{z/(z - 0.5)}` the way back — a sequence, drawn as the stems it is
 *
 * ## Why it is the same shape as Laplace, and where it is not
 *
 * The family is the discrete twin of that one: `c n^k r^n` times a cosine or a
 * sine of `\omega n`, starting at `n = d`. Sums of those are exactly the
 * sequences whose transforms are rational, and rational functions are exactly
 * what comes back — the same closure, and the same reason there is no
 * half-solved case to fall into.
 *
 * The arithmetic is shared outright: `lib/poly.ts` holds the roots and the
 * partial fraction, because taking `\frac{z}{(z-2)(z-3)}` apart is the same
 * problem as taking `\frac{1}{(s+1)(s+2)}` apart and two copies of a root
 * finder are two root finders that drift.
 *
 * What differs is worth saying. The work is done in `w = z^{-1}`, where the
 * sums are geometric and the delays are multiplications, and turned back into
 * `z` only to be written down — that is why the denominators come out as
 * textbooks print them. And the answer is a *sequence*, so it is drawn as
 * points on the integers with a stem to each: joining them with a line would
 * draw a value at `n = 1.5`, which is not a thing that exists.
 *
 * ## The one reading worth having
 *
 * Where a Laplace pole left of the axis means a thing settles, a z-transform
 * pole *inside the unit circle* means it dies away. The reading says which,
 * because `|p| < 1` is the whole of discrete stability and it is the sentence
 * somebody is trying to learn the week they open this.
 */

import { value, type Node, type Scope } from './calc';
import type { Got } from './laplace';
import {
  cx,
  gathered,
  pAdd,
  pAt,
  pDivide,
  pMul,
  pPow,
  pScale,
  pTrim,
  partialFractions,
  qMul,
  qPow,
  roots,
  type CPoly,
  type Complex,
  type Poly,
} from './poly';

const TINY = 1e-9;

/**
 * One piece of a sequence: `c (n-d)^k r^{n-d}` times a cosine or a sine of
 * `\omega(n-d)`, and nothing at all before `n = d`.
 *
 * `r` is never negative: `(-2)^n` is `2^n\cos(\pi n)`, which is the same
 * sequence and is in the family, so the alternating case needs no rule of its
 * own. Every formula below is written once because of that.
 */
export interface Beat {
  c: number;
  k: number;
  r: number;
  w: number;
  wave: 'cos' | 'sin';
  delay: number;
}

/** `c δ[n - at]` — one spike, which is a sequence rather than a nuisance here. */
export interface Spike {
  c: number;
  at: number;
}

export interface Seq {
  beats: Beat[];
  spikes: Spike[];
}

/** `w^delay · num(w)/den(w)`, in `w = z^{-1}` where the algebra is easy. */
export interface Step {
  delay: number;
  num: Poly;
  den: Poly;
  /**
   * The denominator's factors in w, where they are known rather than found.
   *
   * Carried for the same two reasons `lib/laplace.ts` carries its own. It
   * reads better — `\frac{z}{(z-1)^2}` is what a table prints and
   * `\frac{z}{z^2 - 2z + 1}` is the same thing said worse. And it is the
   * difference between a right answer and a wrong one on the way back: the sum
   * of `3/(1-w)`, `w/(1-w)^2` and `1/(1-0.5w)` over a denominator built by
   * multiplying is `(1-w)^3(1-0.5w)`, which has a pole at 1 three times where
   * the sequence has it twice. The spare one cancels against a zero on top,
   * and a partial fraction asked to split at a pole that is not there answers
   * with a five-hundred-thousand.
   */
  factors?: { poly: Poly; power: number }[];
}

export type Zed = Step[];

const beat = (c: number, k = 0, r = 1, w = 0, wave: 'cos' | 'sin' = 'cos', delay = 0): Beat => ({ c, k, r, w, wave, delay });
const bad = (fault: string): Got<never> => ({ ok: false, fault });
const good = <T,>(it: T): Got<T> => ({ ok: true, it });
const round = (v: number) => Number(v.toPrecision(9));

/** What the sequence is at a beat. Before it starts it is nothing, which is what causal means. */
export function at(seq: Seq, n: number): number {
  let out = 0;
  for (const spike of seq.spikes) if (Math.abs(n - spike.at) < 1e-9) out += spike.c;
  for (const b of seq.beats) {
    if (n < b.delay - 1e-9) continue;
    const m = n - b.delay;
    const wave = b.w === 0 ? (b.wave === 'cos' ? 1 : 0) : b.wave === 'cos' ? Math.cos(b.w * m) : Math.sin(b.w * m);
    out += b.c * (b.k === 0 ? 1 : m ** b.k) * b.r ** m * wave;
  }
  return out;
}

/** What a transform is worth at a value of z — the picture, poles and all. */
export function atZ(zed: Zed, z: number): number {
  let out = 0;
  for (const step of zed) {
    const { num, den } = inZ(step);
    out += pAt(num, z) / pAt(den, z);
  }
  return out;
}

/** Beats too small to matter dropped, and the rest gathered where they are the same shape. */
export function tidy(seq: Seq): Seq {
  const seen = new Map<string, Beat>();
  for (const b of seq.beats) {
    if (Math.abs(b.c) < 1e-7) continue;
    if (b.w === 0 && b.wave === 'sin') continue;
    const key = [b.k, round(b.r), round(b.w), b.wave, round(b.delay)].join('|');
    const had = seen.get(key);
    if (had) had.c += b.c;
    else seen.set(key, { ...b });
  }
  const beats = [...seen.values()].filter((b) => Math.abs(b.c) >= 1e-7);
  // Slowest decay first and the highest power of n within it, as an answer is
  // written — the same order `lib/laplace.ts` puts its terms in.
  beats.sort((p, q) => p.delay - q.delay || q.r - p.r || q.k - p.k || (p.wave === q.wave ? 0 : p.wave === 'cos' ? -1 : 1));
  const spikes = seq.spikes.filter((s) => Math.abs(s.c) >= 1e-7).sort((p, q) => p.at - q.at);
  return { beats, spikes };
}

// ── Forwards: a sequence, as a function of z ─────────────────────────────

/**
 * `A_k`, the polynomial on top of `\sum n^k x^n`.
 *
 * `\sum x^n` is `1/(1-x)` and every other power of n follows from applying
 * `x\frac{d}{dx}` to it, which keeps the answer a fraction over `(1-x)^{k+1}`
 * and turns the top into the Eulerian polynomials: 1, then x, then x(1+x),
 * then x(1 + 4x + x²). Built by the recurrence rather than tabled, so there is
 * no twelfth row somebody has to have typed correctly.
 */
function eulerian(k: number): Poly {
  let a: Poly = [1];
  for (let i = 0; i < k; i += 1) {
    const slope: Poly = a.slice(1).map((v, j) => v * (j + 1));
    // A_{k+1} = x[A_k'(1 - x) + (k+1)A_k]
    const inner = pAdd(pMul(slope, [1, -1]), pScale(a, i + 1));
    a = [0, ...inner];
  }
  return pTrim(a);
}

/** The factor a beat's denominator is a power of: `(1 - rw)`, or the quadratic a wave needs. */
function baseOf(b: Beat): { key: string; poly: Poly; power: number } {
  if (Math.abs(b.w) < TINY) return { key: `r${round(b.r)}`, poly: [1, -b.r], power: b.k + 1 };
  return {
    key: `c${round(b.r)}:${round(Math.abs(b.w))}`,
    poly: [1, -2 * b.r * Math.cos(b.w), b.r * b.r],
    power: b.k + 1,
  };
}

/**
 * The numerator one beat contributes, over its own denominator.
 *
 * `\sum n^k x^n` is `A_k(x)` over `(1-x)^{k+1}`, and a beat is that at
 * `x = qw` with `q = re^{i\omega}` — so the numerator is
 * `A_k(qw)(1 - \bar qw)^{k+1}`, real part for the cosine and imaginary part
 * for the sine, over `((1-qw)(1-\bar qw))^{k+1}`, which is real. One formula
 * covering every power of n, every ratio and every frequency, which is the
 * trick `lib/laplace.ts` plays one variable along.
 */
function numeratorOf(b: Beat): Poly {
  const top = eulerian(b.k);
  if (Math.abs(b.w) < TINY) return pScale(top.map((v, i) => v * b.r ** i), b.c);
  const q = cx(b.r * Math.cos(b.w), b.r * Math.sin(b.w));
  const inQ: CPoly = top.map((v, i) => {
    let power = cx(1);
    for (let j = 0; j < i; j += 1) power = { re: power.re * q.re - power.im * q.im, im: power.re * q.im + power.im * q.re };
    return { re: v * power.re, im: v * power.im };
  });
  const product = qMul(inQ, qPow([cx(1), cx(-q.re, q.im)], b.k + 1));
  return pScale(product.map((z) => (b.wave === 'cos' ? z.re : z.im)), b.c);
}

/**
 * A sequence, transformed.
 *
 * One fraction per delay, over the lowest denominator that holds every beat of
 * it — the distinct factors at the highest power any beat needs, rather than
 * the product of all of them. See the note on `Step.factors` for what the
 * product costs.
 */
export function forward(seq: Seq): Zed {
  const out: Zed = [];
  const clean = tidy(seq);
  const groups = new Map<number, Beat[]>();
  for (const b of clean.beats) {
    const key = round(b.delay);
    const had = groups.get(key);
    if (had) had.push(b);
    else groups.set(key, [b]);
  }
  for (const [delay, beats] of groups) {
    const bases = new Map<string, { poly: Poly; power: number }>();
    for (const b of beats) {
      const base = baseOf(b);
      const had = bases.get(base.key);
      if (!had || had.power < base.power) bases.set(base.key, { poly: base.poly, power: base.power });
    }
    let den: Poly = [1];
    for (const b of bases.values()) den = pMul(den, pPow(b.poly, b.power));
    let num: Poly = [0];
    for (const b of beats) {
      const base = baseOf(b);
      const held = bases.get(base.key);
      let over: Poly = [1];
      for (const [key, x] of bases) {
        over = pMul(over, pPow(x.poly, key === base.key ? (held?.power ?? 0) - base.power : x.power));
      }
      num = pAdd(num, pMul(numeratorOf(b), over));
    }
    out.push({
      delay,
      num: pTrim(num),
      den: pTrim(den),
      factors: [...bases.values()].map((b) => ({ poly: b.poly, power: b.power })),
    });
  }
  for (const spike of clean.spikes) out.push({ delay: spike.at, num: [spike.c], den: [1] });
  return out;
}

/**
 * The same fraction written in `z` rather than in `w`.
 *
 * Reversing the coefficients is the whole of `w = 1/z`: a polynomial's value
 * at `1/z` is its reversed self at `z`, over `z` to the degree. The two sides
 * are then lifted to the same power of z so nothing is left with a `z^{-1}` in
 * it, and the delay goes on the bottom, which is where `z^{-d}` belongs.
 */
export function inZ(step: Step): { num: Poly; den: Poly } {
  const num = pTrim(step.num);
  const den = pTrim(step.den);
  const top = num.length - 1;
  const bottom = den.length - 1;
  const lift = Math.max(top, bottom);
  const raise = (poly: Poly, by: number) => [...new Array<number>(by).fill(0), ...poly];
  return {
    num: pTrim(raise([...num].reverse(), lift - top)),
    den: pTrim(raise([...den].reverse(), lift - bottom + Math.max(0, Math.round(step.delay)))),
  };
}

/** Where a transform blows up, in z — and `|p| < 1` is the whole of whether it dies away. */
export function poles(zed: Zed): Complex[] {
  const out: Complex[] = [];
  for (const step of zed) {
    const den = pTrim(inZ(step).den);
    if (den.length < 2) continue;
    for (const g of gathered(roots(den), den)) {
      for (let i = 0; i < g.times; i += 1) out.push({ re: round(g.root.re), im: round(g.root.im) });
    }
  }
  return out.sort((a, b) => Math.hypot(b.re, b.im) - Math.hypot(a.re, a.im));
}

/** What the poles say: the unit circle rather than the imaginary axis. */
export function poleText(list: Complex[]): string {
  if (!list.length) return 'No poles: this is a handful of spikes and nothing after them.';
  const seen: Complex[] = [];
  for (const p of list) {
    if (p.im < 0 && seen.some((q) => Math.abs(q.re - p.re) < 1e-7 && Math.abs(q.im + p.im) < 1e-7)) continue;
    if (seen.some((q) => q.re === p.re && q.im === p.im)) continue;
    seen.push(p);
  }
  const where = seen.map(poleName).join(', ');
  const biggest = Math.max(...list.map((p) => Math.hypot(p.re, p.im)));
  const says =
    biggest < 1 - 1e-7
      ? 'all inside the unit circle, so it dies away'
      : biggest > 1 + 1e-7
        ? 'one of them outside the unit circle, so it runs away'
        : 'one of them on the unit circle, so it neither dies away nor runs away';
  return `${list.length === 1 ? 'Pole' : 'Poles'} at ${where} — ${says}.`;
}

function numberText(v: number): string {
  const near = Number(v.toPrecision(10));
  if (Math.abs(near - Math.round(near)) < 1e-9) return String(Math.round(near));
  return String(Number(v.toPrecision(6)));
}

function poleName(p: Complex): string {
  if (Math.abs(p.im) < 1e-7) return numberText(p.re);
  const real = Math.abs(p.re) < 1e-7 ? '' : `${numberText(p.re)} ± `;
  return `${real}${Math.abs(p.im) === 1 ? '' : numberText(Math.abs(p.im))}i`;
}

// ── Backwards: a function of z, as a sequence ────────────────────────────

/** `C(n + i - 1, i - 1)` as a polynomial in n — what `1/(1 - pw)^i` sums to. */
function binomial(i: number): Poly {
  let out: Poly = [1];
  for (let j = 1; j < i; j += 1) out = pMul(out, [j, 1]);
  let over = 1;
  for (let j = 2; j < i; j += 1) over *= j;
  return pScale(out, 1 / over);
}

/** One fraction in w, split and turned back into beats. */
function back(num: Poly, den: Poly): Got<Seq> {
  const top = pTrim(num);
  const bottom = pTrim(den);
  if (Math.abs(bottom[0]) < TINY) return bad('A transform with no constant on the bottom is not one this reads.');
  const spikes: Spike[] = [];
  let rest = top;
  if (top.length >= bottom.length) {
    const split = pDivide(top, bottom);
    split.quotient.forEach((c, i) => {
      if (Math.abs(c) > 1e-9) spikes.push({ c, at: i });
    });
    rest = split.remainder;
  }
  if (bottom.length === 1) return good({ beats: [], spikes });
  if (pTrim(rest).length === 1 && Math.abs(pTrim(rest)[0]) < TINY) return good({ beats: [], spikes });
  const parts = partialFractions(rest, bottom);
  if (!parts) return bad('The bottom of this transform did not come apart.');

  const beats: Beat[] = [];
  for (const { root, power, coef } of parts) {
    /*
     * `1/(w - ρ)^i` said the other way round.
     *
     * The split comes back over `(w - ρ)`, and a sequence is read off
     * `1/(1 - pw)^i` with `p = 1/ρ`. The two differ by `(-p)^i`, and that is
     * the whole of the conversion — after it, `1/(1 - pw)^i` is
     * `C(n+i-1, i-1)p^n`, which is the geometric series with a repeat in it.
     */
    const size = root.re * root.re + root.im * root.im;
    if (size < 1e-18) return bad('The bottom of this transform did not come apart.');
    const p = { re: root.re / size, im: -root.im / size };
    let scale = { re: 1, im: 0 };
    for (let j = 0; j < power; j += 1) {
      scale = { re: scale.re * -p.re - scale.im * -p.im, im: scale.re * -p.im + scale.im * -p.re };
    }
    const B = { re: coef.re * scale.re - coef.im * scale.im, im: coef.re * scale.im + coef.im * scale.re };
    const shape = binomial(power);
    const r = Math.hypot(p.re, p.im);
    const w = Math.atan2(p.im, p.re);
    shape.forEach((weight, k) => {
      if (Math.abs(weight) < 1e-12) return;
      if (Math.abs(p.im) < TINY) {
        beats.push(beat(B.re * weight, k, Math.abs(p.re), p.re < 0 ? Math.PI : 0));
        return;
      }
      // A conjugate pair is one oscillation counted once, as in Laplace.
      if (p.im < 0) return;
      beats.push(beat(2 * B.re * weight, k, r, w, 'cos'));
      beats.push(beat(-2 * B.im * weight, k, r, w, 'sin'));
    });
  }
  return good(tidy({ beats, spikes }));
}

/** A transform, turned back into the sequence it came from. */
export function inverse(zed: Zed): Got<Seq> {
  let out: Seq = { beats: [], spikes: [] };
  for (const step of zed) {
    const got = back(step.num, step.den);
    if (!got.ok) return got;
    out = {
      beats: [...out.beats, ...got.it.beats.map((b) => ({ ...b, delay: b.delay + step.delay }))],
      spikes: [...out.spikes, ...got.it.spikes.map((s) => ({ ...s, at: s.at + step.delay }))],
    };
  }
  return good(tidy(out));
}

// ── Reading one off what somebody typed ──────────────────────────────────

function mentions(node: Node, name: string): boolean {
  switch (node.kind) {
    case 'name':
      return node.name === name;
    case 'neg':
    case 'fact':
    case 'percent':
    case 'abs':
      return mentions(node.body, name);
    case 'op':
      return mentions(node.left, name) || mentions(node.right, name);
    case 'call':
      return node.args.some((a) => mentions(a, name));
    case 'apply':
      return node.args.some((a) => mentions(a, name)) || (node.power ? mentions(node.power, name) : false);
    case 'list':
      return node.items.some((i) => mentions(i, name));
    case 'range':
      return mentions(node.from, name) || (node.second ? mentions(node.second, name) : false) || mentions(node.to, name);
    case 'big':
      return mentions(node.from, name) || mentions(node.to, name) || mentions(node.body, name);
    default:
      return false;
  }
}

function names(node: Node, into: Set<string> = new Set()): Set<string> {
  if (node.kind === 'name') into.add(node.name);
  else if (node.kind === 'op') {
    names(node.left, into);
    names(node.right, into);
  } else if (node.kind === 'neg' || node.kind === 'abs' || node.kind === 'fact' || node.kind === 'percent') {
    names(node.body, into);
  } else if (node.kind === 'call' || node.kind === 'apply') {
    node.args.forEach((a) => names(a, into));
    if (node.kind === 'apply' && node.power) names(node.power, into);
  }
  return into;
}

function fixed(node: Node, scope: Scope): Got<number> {
  const got = value(node, scope);
  if (Array.isArray(got) || !Number.isFinite(got)) {
    const loose = [...names(node)].filter((n) => !(scope.vars && n in scope.vars));
    return bad(loose.length ? `${loose[0]} has no value, so this is not a sequence yet.` : 'That part does not work out to a number.');
  }
  return good(got);
}

/** `m·n + k`, which is all a wave or a step may have inside it. */
function straight(node: Node, of: string, scope: Scope): Got<{ m: number; k: number }> {
  const seq = readSeq(node, of, scope);
  if (!seq.ok) return seq;
  const { beats, spikes } = tidy(seq.it);
  if (spikes.length) return bad('A spike cannot go inside a function.');
  let m = 0;
  let k = 0;
  for (const b of beats) {
    if (b.r !== 1 || b.w !== 0 || b.delay !== 0 || b.k > 1) return bad('This wants a straight line in n inside it, like 2n - 1.');
    if (b.k === 0) k += b.c;
    else m += b.c;
  }
  return good({ m, k });
}

/** A wave with a negative frequency is the same wave: cos is even, sin is odd. */
function wave(c: number, w: number, kind: 'cos' | 'sin'): { c: number; w: number; wave: 'cos' | 'sin' } {
  if (w >= 0) return { c, w, wave: kind };
  return { c: kind === 'cos' ? c : -c, w: -w, wave: kind };
}

/** Two waves multiplied, as the sum of two waves — the identity Laplace needs too. */
function timesWave(w1: number, k1: 'cos' | 'sin', w2: number, k2: 'cos' | 'sin'): { c: number; w: number; wave: 'cos' | 'sin' }[] {
  if (w1 === 0 && w2 === 0) return k1 === 'cos' && k2 === 'cos' ? [{ c: 1, w: 0, wave: 'cos' }] : [{ c: 0, w: 0, wave: 'cos' }];
  if (w1 === 0) return k1 === 'cos' ? [{ c: 1, w: w2, wave: k2 }] : [{ c: 0, w: 0, wave: 'cos' }];
  if (w2 === 0) return k2 === 'cos' ? [{ c: 1, w: w1, wave: k1 }] : [{ c: 0, w: 0, wave: 'cos' }];
  const sum = w1 + w2;
  const gap = w1 - w2;
  if (k1 === 'cos' && k2 === 'cos') return [wave(0.5, gap, 'cos'), wave(0.5, sum, 'cos')];
  if (k1 === 'sin' && k2 === 'sin') return [wave(0.5, gap, 'cos'), wave(-0.5, sum, 'cos')];
  if (k1 === 'sin') return [wave(0.5, sum, 'sin'), wave(0.5, gap, 'sin')];
  return [wave(0.5, sum, 'sin'), wave(-0.5, gap, 'sin')];
}

/** The same beat, written from a later start — the binomial, the ratio's law, the angle sum. */
function shifted(b: Beat, to: number): Beat[] {
  const gap = to - b.delay;
  if (gap <= 0) return [{ ...b, delay: to }];
  const out: Beat[] = [];
  const grow = b.r ** gap;
  const cosine = b.w === 0 ? 1 : Math.cos(b.w * gap);
  const sine = b.w === 0 ? 0 : Math.sin(b.w * gap);
  const over = (n: number) => {
    let f = 1;
    for (let i = 2; i <= n; i += 1) f *= i;
    return f;
  };
  for (let j = 0; j <= b.k; j += 1) {
    const choose = (over(b.k) / (over(j) * over(b.k - j))) * gap ** (b.k - j);
    const scale = b.c * choose * grow;
    if (b.w === 0) {
      if (b.wave === 'cos') out.push(beat(scale, j, b.r, 0, 'cos', to));
      continue;
    }
    if (b.wave === 'cos') {
      out.push(beat(scale * cosine, j, b.r, b.w, 'cos', to));
      out.push(beat(-scale * sine, j, b.r, b.w, 'sin', to));
    } else {
      out.push(beat(scale * cosine, j, b.r, b.w, 'sin', to));
      out.push(beat(scale * sine, j, b.r, b.w, 'cos', to));
    }
  }
  return out;
}

function timesBeat(p: Beat, q: Beat): Beat[] {
  const delay = Math.max(p.delay, q.delay);
  const out: Beat[] = [];
  for (const left of shifted(p, delay)) {
    for (const right of shifted(q, delay)) {
      for (const w of timesWave(left.w, left.wave, right.w, right.wave)) {
        out.push(beat(left.c * right.c * w.c, left.k + right.k, left.r * right.r, w.w, w.wave, delay));
      }
    }
  }
  return out;
}

function timesSeq(a: Seq, b: Seq): Got<Seq> {
  if (a.spikes.length || b.spikes.length) {
    const kick = a.spikes.length ? a : b;
    const other = a.spikes.length ? b : a;
    if (kick.beats.length || other.spikes.length) return bad('A spike times a sequence is not something this reads.');
    const plain = other.beats.every((p) => p.k === 0 && p.r === 1 && p.w === 0 && p.delay === 0);
    if (!plain) return bad('A spike can be scaled by a number, not multiplied by a sequence.');
    const k = other.beats.reduce((sum, p) => sum + p.c, 0);
    return good({ beats: [], spikes: kick.spikes.map((s) => ({ ...s, c: s.c * k })) });
  }
  const beats: Beat[] = [];
  for (const p of a.beats) for (const q of b.beats) beats.push(...timesBeat(p, q));
  return good({ beats, spikes: [] });
}

const negated = (seq: Seq): Seq => ({
  beats: seq.beats.map((b) => ({ ...b, c: -b.c })),
  spikes: seq.spikes.map((s) => ({ ...s, c: -s.c })),
});

const plus = (a: Seq, b: Seq): Seq => ({ beats: [...a.beats, ...b.beats], spikes: [...a.spikes, ...b.spikes] });

const STEP = new Set(['u', 'step', 'heaviside']);
const KICK = new Set(['δ', 'delta', 'dirac', 'impulse']);

/** What somebody typed, read as a sequence in n. */
export function readSeq(node: Node, of = 'n', scope: Scope = {}): Got<Seq> {
  if (!mentions(node, of)) {
    const got = fixed(node, scope);
    return got.ok ? good({ beats: [beat(got.it)], spikes: [] }) : got;
  }
  switch (node.kind) {
    case 'name':
      return good({ beats: [beat(1, 1)], spikes: [] });
    case 'neg': {
      const body = readSeq(node.body, of, scope);
      return body.ok ? good(negated(body.it)) : body;
    }
    case 'op': {
      if (node.op === '+' || node.op === '-') {
        const left = readSeq(node.left, of, scope);
        if (!left.ok) return left;
        const right = readSeq(node.right, of, scope);
        if (!right.ok) return right;
        return good(plus(left.it, node.op === '-' ? negated(right.it) : right.it));
      }
      if (node.op === '*') {
        const left = readSeq(node.left, of, scope);
        if (!left.ok) return left;
        const right = readSeq(node.right, of, scope);
        if (!right.ok) return right;
        return timesSeq(left.it, right.it);
      }
      if (node.op === '/') {
        if (mentions(node.right, of)) return bad(`Dividing by something with ${of} in it is not in this family.`);
        const by = fixed(node.right, scope);
        if (!by.ok) return by;
        if (Math.abs(by.it) < TINY) return bad('That divides by zero.');
        const left = readSeq(node.left, of, scope);
        if (!left.ok) return left;
        return timesSeq(left.it, { beats: [beat(1 / by.it)], spikes: [] });
      }
      return readPower(node.left, node.right, of, scope);
    }
    case 'call':
      return readCall(node.name, node.args, of, scope);
    case 'apply': {
      const own = scope.funs?.[node.name];
      if (!own && node.args.length === 1 && !STEP.has(node.name) && !KICK.has(node.name) && scope.vars && node.name in scope.vars) {
        return readSeq({ kind: 'op', op: '*', left: { kind: 'name', name: node.name }, right: node.args[0] }, of, scope);
      }
      return readCall(node.name, node.args, of, scope);
    }
    default:
      return bad('This is not something the z-transform reads.');
  }
}

function readPower(base: Node, power: Node, of: string, scope: Scope): Got<Seq> {
  if (!mentions(power, of)) {
    const k = fixed(power, scope);
    if (!k.ok) return k;
    if (!Number.isInteger(k.it) || k.it < 0 || k.it > 12) return bad('A power in this family is a whole number of times, 0 to 12.');
    const body = readSeq(base, of, scope);
    if (!body.ok) return body;
    let out: Seq = { beats: [beat(1)], spikes: [] };
    for (let i = 0; i < k.it; i += 1) {
      const next = timesSeq(out, body.it);
      if (!next.ok) return next;
      out = next.it;
    }
    return good(out);
  }
  // `0.5^n` and `(-2)^n`: a number to the beat, which is the whole subject.
  if (mentions(base, of)) return bad(`Something with ${of} in it raised to a power of ${of} has no transform here.`);
  const k = fixed(base, scope);
  if (!k.ok) return k;
  if (Math.abs(k.it) < TINY) return bad('Zero to a power of n is not a sequence this reads.');
  const line = straight(power, of, scope);
  if (!line.ok) return line;
  if (!Number.isInteger(line.it.m)) return bad('A ratio wants a whole number of n in its power, like 2^{3n}.');
  const r = k.it ** line.it.m;
  const front = k.it ** line.it.k;
  return good({ beats: [beat(front, 0, Math.abs(r), r < 0 ? Math.PI : 0)], spikes: [] });
}

function shiftPoint(args: Node[], of: string, scope: Scope, what: string): Got<number> {
  if (args.length !== 1) return bad(`${what} takes one thing in its brackets.`);
  const line = straight(args[0], of, scope);
  if (!line.ok) return line;
  if (Math.abs(line.it.m - 1) > TINY) return bad(`${what} is written about n itself — u(n - 2), not u(2n).`);
  const at = -line.it.k;
  if (at < -TINY) return bad(`${what} before n = 0 is already on, so it changes nothing.`);
  if (Math.abs(at - Math.round(at)) > 1e-9) return bad(`${what} wants a whole number of beats — there is no n = 1.5.`);
  return good(Math.max(0, Math.round(at)));
}

function readCall(name: string, args: Node[], of: string, scope: Scope): Got<Seq> {
  if (STEP.has(name)) {
    const at = shiftPoint(args, of, scope, 'A step');
    return at.ok ? good({ beats: [beat(1, 0, 1, 0, 'cos', at.it)], spikes: [] }) : at;
  }
  if (KICK.has(name)) {
    const at = shiftPoint(args, of, scope, 'A spike');
    return at.ok ? good({ beats: [], spikes: [{ c: 1, at: at.it }] }) : at;
  }
  if (args.length !== 1) return bad(`${name} takes one thing in its brackets here.`);
  const line = straight(args[0], of, scope);
  if (!line.ok) return line;
  const { m, k } = line.it;
  if (name === 'cos' || name === 'sin') {
    const first = wave(name === 'cos' ? Math.cos(k) : Math.cos(k), m, name);
    const second = wave(name === 'cos' ? -Math.sin(k) : Math.sin(k), m, name === 'cos' ? 'sin' : 'cos');
    return good({
      beats: [beat(first.c, 0, 1, first.w, first.wave), beat(second.c, 0, 1, second.w, second.wave)],
      spikes: [],
    });
  }
  return bad(`${name}(${of}) is outside the family this transforms — powers, ratios, sines and steps.`);
}

/** What somebody typed, transformed — the whole of one direction. */
export function transform(node: Node, of = 'n', scope: Scope = {}): Got<Zed> {
  const seq = readSeq(node, of, scope);
  return seq.ok ? good(forward(seq.it)) : seq;
}

/** What somebody typed as a function of z, read back into `w` where the algebra is. */
export function readZed(node: Node, of = 'z', scope: Scope = {}): Got<Zed> {
  const asZ = readRational(node, of, scope);
  if (!asZ.ok) return asZ;
  // Written in z and worked in w: reversing the coefficients is the change of
  // variable, and the power of z left over is a delay.
  const out: Zed = [];
  for (const { num, den } of asZ.it) {
    const top = pTrim(num);
    const bottom = pTrim(den);
    const lift = Math.max(top.length - 1, bottom.length - 1);
    const raise = (poly: Poly, by: number) => [...new Array<number>(by).fill(0), ...poly];
    out.push({
      delay: 0,
      num: pTrim(raise([...top].reverse(), lift - (top.length - 1))),
      den: pTrim(raise([...bottom].reverse(), lift - (bottom.length - 1))),
    });
  }
  return good(out);
}

/** A rational function of z, as polynomials — the only shape with an inverse. */
function readRational(node: Node, of: string, scope: Scope): Got<{ num: Poly; den: Poly }[]> {
  if (!mentions(node, of)) {
    const got = fixed(node, scope);
    return got.ok ? good([{ num: [got.it], den: [1] }]) : got;
  }
  switch (node.kind) {
    case 'name':
      return good([{ num: [0, 1], den: [1] }]);
    case 'neg': {
      const body = readRational(node.body, of, scope);
      return body.ok ? good(body.it.map((p) => ({ ...p, num: pScale(p.num, -1) }))) : body;
    }
    case 'op': {
      if (node.op === '+' || node.op === '-') {
        const left = readRational(node.left, of, scope);
        if (!left.ok) return left;
        const right = readRational(node.right, of, scope);
        if (!right.ok) return right;
        const other = node.op === '-' ? right.it.map((p) => ({ ...p, num: pScale(p.num, -1) })) : right.it;
        return good(one([...left.it, ...other]));
      }
      if (node.op === '*') {
        const left = readRational(node.left, of, scope);
        if (!left.ok) return left;
        const right = readRational(node.right, of, scope);
        if (!right.ok) return right;
        const out: { num: Poly; den: Poly }[] = [];
        for (const p of left.it) for (const q of right.it) out.push({ num: pMul(p.num, q.num), den: pMul(p.den, q.den) });
        return good(one(out));
      }
      if (node.op === '/') {
        const left = readRational(node.left, of, scope);
        if (!left.ok) return left;
        const right = readRational(node.right, of, scope);
        if (!right.ok) return right;
        const by = one(right.it)[0];
        if (pTrim(by.num).length === 1 && Math.abs(by.num[0]) < TINY) return bad('That divides by zero.');
        const top = one(left.it)[0];
        return good([{ num: pMul(top.num, by.den), den: pMul(top.den, by.num) }]);
      }
      return ratPower(node.left, node.right, of, scope);
    }
    case 'apply': {
      const plain = node.args.length === 1 && !node.power;
      if (plain && !scope.funs?.[node.name]) {
        return readRational({ kind: 'op', op: '*', left: { kind: 'name', name: node.name }, right: node.args[0] }, of, scope);
      }
      if (node.args.length === 1 && node.power && !scope.funs?.[node.name]) {
        return readRational(
          { kind: 'op', op: '*', left: { kind: 'name', name: node.name }, right: { kind: 'op', op: '^', left: node.args[0], right: node.power } },
          of,
          scope,
        );
      }
      return bad(`${node.name}(${of}) has no inverse in the family this reads.`);
    }
    default:
      return bad(`Only a fraction in ${of} has a sequence behind it.`);
  }
}

/** Every piece over one denominator. */
function one(parts: { num: Poly; den: Poly }[]): { num: Poly; den: Poly }[] {
  let out = { num: [0] as Poly, den: [1] as Poly };
  for (const p of parts) out = { num: pAdd(pMul(out.num, p.den), pMul(p.num, out.den)), den: pMul(out.den, p.den) };
  return [out];
}

function ratPower(base: Node, power: Node, of: string, scope: Scope): Got<{ num: Poly; den: Poly }[]> {
  if (mentions(power, of)) return bad(`A power of ${of} raised to a power of ${of} is not read here.`);
  const n = fixed(power, scope);
  if (!n.ok) return n;
  if (!Number.isInteger(n.it) || Math.abs(n.it) > 12) return bad('A power of z here is a whole number of times, at most 12.');
  const body = readRational(base, of, scope);
  if (!body.ok) return body;
  const first = one(body.it)[0];
  const times = Math.abs(n.it);
  const up = n.it >= 0 ? first : { num: first.den, den: first.num };
  return good([{ num: pPow(up.num, times), den: pPow(up.den, times) }]);
}

// ── Writing it down ──────────────────────────────────────────────────────

function beatText(b: Beat, of: string): string {
  const inner = b.delay > TINY ? `(${of} - ${numberText(b.delay)})` : of;
  const parts: string[] = [];
  if (b.k === 1) parts.push(inner);
  else if (b.k > 1) parts.push(`${inner}^{${b.k}}`);
  if (Math.abs(b.r - 1) > TINY) parts.push(`${numberText(b.r)}^{${inner}}`);
  if (Math.abs(b.w) > TINY) parts.push(`\\${b.wave}(${Math.abs(b.w - 1) < TINY ? '' : numberText(b.w)}${inner})`);
  const size = Math.abs(b.c);
  const front = parts.length === 0 ? numberText(size) : Math.abs(size - 1) < TINY ? '' : numberText(size);
  const tail = b.delay > TINY ? `\\,u[${of} - ${numberText(b.delay)}]` : '';
  return `${front}${parts.join('')}${tail}`;
}

function joined(pieces: { negative: boolean; text: string }[]): string {
  if (!pieces.length) return '0';
  let out = (pieces[0].negative ? '-' : '') + pieces[0].text;
  for (const piece of pieces.slice(1)) out += `${piece.negative ? ' - ' : ' + '}${piece.text}`;
  return out;
}

/** A sequence, as LaTeX — square brackets, because a sequence is indexed rather than called. */
export function latexSeq(seq: Seq, of = 'n'): string {
  const clean = tidy(seq);
  return joined([
    ...clean.spikes.map((s) => ({
      negative: s.c < 0,
      text: `${Math.abs(Math.abs(s.c) - 1) < TINY ? '' : numberText(Math.abs(s.c))}\\delta[${s.at > TINY ? `${of} - ${numberText(s.at)}` : of}]`,
    })),
    ...clean.beats.map((b) => ({ negative: b.c < 0, text: beatText(b, of) })),
  ]);
}

function latexPoly(poly: Poly, of: string): string {
  const pieces: { negative: boolean; text: string }[] = [];
  for (let i = poly.length - 1; i >= 0; i -= 1) {
    const c = poly[i];
    if (Math.abs(c) < TINY) continue;
    const size = Math.abs(c);
    const power = i === 0 ? '' : i === 1 ? of : `${of}^{${i}}`;
    const front = i === 0 || Math.abs(size - 1) > TINY ? numberText(size) : '';
    pieces.push({ negative: c < 0, text: `${front}${power}` });
  }
  return joined(pieces);
}

/**
 * The bottom of a fraction in z: its factors where they are known.
 *
 * A factor in w reverses into its factor in z — `(1 - rw)` is `(z - r)` over a
 * z, and `(1 - 2r\cos\omega\,w + r^2w^2)` is `z^2 - 2r\cos\omega\,z + r^2`
 * over two — so the whole change of variable is done factor by factor and the
 * powers of z left over are gathered into one, along with the delay.
 */
function bottomText(step: Step, of: string): string {
  const { den } = inZ(step);
  const bottom = pTrim(den);
  const known = step.factors;
  if (!known || !known.length) return latexPoly(bottom, of);
  const parts: string[] = [];
  // Brackets round the only thing under the line are noise: `z - 0.5`, not
  // `(z - 0.5)`. They earn their place the moment there are two of them or a
  // power over one.
  let degree = 0;
  for (const f of known) {
    const poly = pTrim(f.poly);
    degree += (poly.length - 1) * f.power;
    const text = latexPoly([...poly].reverse(), of);
    const wrapped = / [+-] /.test(text) ? `(${text})` : text;
    parts.push(f.power === 1 ? wrapped : `${wrapped}^{${f.power}}`);
  }
  const spare = bottom.length - 1 - degree;
  if (spare > 0) parts.unshift(spare === 1 ? of : `${of}^{${spare}}`);
  if (parts.length === 1 && known.length === 1 && known[0].power === 1 && spare <= 0) {
    return latexPoly([...pTrim(known[0].poly)].reverse(), of);
  }
  return parts.join('');
}

/** A transform, written in z — which is the form every table is printed in. */
export function latexZed(zed: Zed, of = 'z'): string {
  if (!zed.length) return '0';
  return joined(
    zed.map((step) => {
      const { num, den } = inZ(step);
      const top = latexPoly(pTrim(num), of);
      const negative = top.startsWith('-');
      const size = negative ? top.slice(1) : top;
      const bottom = pTrim(den);
      const flat = bottom.length === 1 && Math.abs(bottom[0] - 1) < TINY;
      return { negative, text: flat ? size : `\\frac{${size}}{${bottomText(step, of)}}` };
    }),
  );
}
