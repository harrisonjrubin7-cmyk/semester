/**
 * Fourier: the harmonics a repeating thing is made of, and the spectrum a
 * settling one has.
 *
 * `lib/laplace.ts` takes a signal that starts at zero and turns it into a
 * function of s. This is the other half of the same subject and it is two
 * different objects, so it is two different things to type:
 *
 *   `fourier(\text{sign}(\sin(t)), 2\pi)`   the series — a periodic function
 *                                           as a sum of sines and cosines
 *   `F{e^{-2t}}`                            the transform — a settling signal
 *                                           as a spread over frequency
 *
 * ## The series, and why it is numerical
 *
 * A Fourier series is an integral per coefficient, and the functions people
 * actually take the series of are the ones with corners and jumps in them: a
 * square wave, a sawtooth, a rectified sine. None of those is in the family
 * `lib/laplace.ts` transforms, and all of them are things `lib/calc.ts` can
 * work out at a number. So the coefficients are integrated rather than looked
 * up, which makes this work on anything the calculator can evaluate — `|t|`,
 * `\text{sign}`, `\text{floor}`, a formula somebody wrote — rather than on a
 * table's worth of shapes.
 *
 * The honest difficulty is that Simpson's rule across a jump is bad
 * arithmetic: the error is first order in the step, so a square wave's `b_1`
 * would come out at four figures rather than twelve. So the jumps are found
 * first — sampled, then bisected to the last bit of the float — and each
 * smooth piece is integrated on its own. That is why `\text{sign}(\sin(t))`
 * gives `4/\pi` to ten places here rather than to four.
 *
 * ## The transform, and what it refuses
 *
 * For a signal that starts at zero and settles, the Fourier transform is the
 * Laplace transform read up the imaginary axis: `F(\omega) = F_L(i\omega)`.
 * That is not a shortcut, it is the definition — the two integrals are the
 * same integral once `s = i\omega` — so the whole of `lib/laplace.ts` is the
 * engine here and there is no second table.
 *
 * It follows that the transform exists only where the signal settles. `F{1}`
 * and `F{\sin(t)}` have poles on the axis, and their transforms are deltas
 * rather than functions; those are refused with the sentence that says so
 * rather than answered with the part that happens to be a function. An even
 * signal written `f(|t|)` is the one two-sided shape handled, because it is
 * its one-sided half read twice: `F(\omega) = 2\,\mathrm{Re}[G(i\omega)]`.
 *
 * What comes back is complex, so what is drawn is its size `|F(\omega)|` —
 * the spectrum — and the reading says as much rather than leaving somebody to
 * assume the picture is the transform itself.
 */

import { value, type Node, type Scope } from './calc';
import { forward, poles, readFn, type Got, type Transform } from './laplace';

// ── The series ───────────────────────────────────────────────────────────

/** One harmonic: `a\cos(n\omega t) + b\sin(n\omega t)`. */
export interface Harmonic {
  n: number;
  a: number;
  b: number;
}

/** A function as its harmonics, over one period. */
export interface Series {
  /** The width of one repeat, and the interval integrated over: `-period/2` to `period/2`. */
  period: number;
  /** `a_0/2` — the average, which is the term with no wave in it. */
  mean: number;
  terms: Harmonic[];
}

/** How many harmonics, when nobody said. Enough to show a square wave's corners forming. */
export const HARMONICS = 8;

/**
 * Where a function jumps, to the last bit of the float.
 *
 * Bisection on which side the middle belongs to, which works because a jump is
 * exactly the place where that question has an answer. Sixty halvings take an
 * interval of a hundredth down below the precision of a double, so the pieces
 * either side are integrated over their real ends rather than over an interval
 * that straddles the step.
 */
function jumpBetween(f: (t: number) => number, lo: number, hi: number): number {
  const low = f(lo);
  const high = f(hi);
  let left = lo;
  let right = hi;
  for (let i = 0; i < 60; i += 1) {
    const mid = (left + right) / 2;
    const v = f(mid);
    if (Math.abs(v - low) <= Math.abs(v - high)) left = mid;
    else right = mid;
  }
  return (left + right) / 2;
}

/**
 * The interval, cut where the function jumps.
 *
 * A jump is told from a steep piece by comparing with the rest of the
 * function: a step is many times the typical change between neighbouring
 * samples, and a slope — however steep — is not, once there are a thousand of
 * them. The middle of the sorted changes is the yardstick rather than the mean,
 * because the mean of a list containing a jump is dragged by the jump.
 */
function cuts(f: (t: number) => number, from: number, to: number): number[] {
  const count = 1200;
  const step = (to - from) / count;
  const at: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= count; i += 1) {
    const t = from + i * step;
    at.push(t);
    ys.push(f(t));
  }
  const gaps: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const gap = Math.abs(ys[i + 1] - ys[i]);
    if (Number.isFinite(gap)) gaps.push(gap);
  }
  if (!gaps.length) return [];
  const sorted = [...gaps].sort((p, q) => p - q);
  const middle = sorted[Math.floor(sorted.length / 2)];
  const spread = Math.max(...ys.filter(Number.isFinite).map(Math.abs), 1);
  const big = Math.max(12 * middle, 1e-6 * spread);
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    if (!Number.isFinite(ys[i]) || !Number.isFinite(ys[i + 1])) continue;
    if (Math.abs(ys[i + 1] - ys[i]) <= big) continue;
    const where = jumpBetween(f, at[i], at[i + 1]);
    if (where > from + 1e-12 && where < to - 1e-12) out.push(where);
  }
  return out;
}

/** Simpson's rule over one smooth piece, as points and the weights they carry. */
function panelled(from: number, to: number, panels: number): { ts: number[]; ws: number[] } {
  const even = panels % 2 ? panels + 1 : panels;
  const h = (to - from) / even;
  const ts: number[] = [];
  const ws: number[] = [];
  for (let i = 0; i <= even; i += 1) {
    ts.push(from + i * h);
    ws.push(((i === 0 || i === even ? 1 : i % 2 ? 4 : 2) * h) / 3);
  }
  return { ts, ws };
}

/**
 * The whole interval as points and weights, with the jumps as piece ends.
 *
 * Worked once and used for every coefficient: the function is evaluated here
 * and nowhere else, so seventeen integrals cost one pass over the expression
 * rather than seventeen.
 */
function weighed(f: (t: number) => number, from: number, to: number): { ts: number[]; ws: number[]; fs: number[] } {
  const edges = [from, ...cuts(f, from, to), to];
  const width = to - from;
  const ts: number[] = [];
  const ws: number[] = [];
  const fs: number[] = [];
  for (let i = 0; i < edges.length - 1; i += 1) {
    const lo = edges[i];
    const hi = edges[i + 1];
    if (hi - lo <= width * 1e-12) continue;
    const share = Math.max(64, Math.round((2048 * (hi - lo)) / width));
    const piece = panelled(lo, hi, share);
    /*
     * A piece's own ends are read a hair inside it.
     *
     * At a jump the function is whichever side the arithmetic lands on —
     * `\text{sign}(\sin(t))` is 0 at t = 0, which is neither of its two
     * values — and Simpson's rule gives that one sample a third of a panel's
     * weight. That one point was worth three ten-thousandths in `b_1`, which
     * is the whole of what finding the jumps was meant to buy. Stepping in by
     * a millionth of the piece takes the limit from the correct side and costs
     * nothing the answer can see.
     */
    const step = Math.min(width * 1e-9, (hi - lo) * 1e-6);
    for (let k = 0; k < piece.ts.length; k += 1) {
      const t = piece.ts[k];
      const inside = k === 0 ? t + step : k === piece.ts.length - 1 ? t - step : t;
      const v = f(inside);
      ts.push(t);
      ws.push(piece.ws[k]);
      fs.push(Number.isFinite(v) ? v : 0);
    }
  }
  return { ts, ws, fs };
}

/**
 * A function as its harmonics, over one period.
 *
 * Integrated over `-period/2` to `period/2` rather than `0` to `period`, which
 * is the convention a textbook states when it gives a function by a formula:
 * the series of `t` over `(-\pi, \pi)` is the sawtooth everybody means, and
 * the series of `t` over `(0, 2\pi)` is a different one. A function that
 * actually repeats gives the same answer either way; a formula does not, so
 * the interval is said out loud in the reading rather than assumed.
 */
export function harmonicsOf(f: (t: number) => number, period: number, count = HARMONICS): Series {
  const half = period / 2;
  const { ts, ws, fs } = weighed(f, -half, half);
  const w0 = (2 * Math.PI) / period;
  let total = 0;
  for (let i = 0; i < ts.length; i += 1) total += ws[i] * fs[i];
  const terms: Harmonic[] = [];
  for (let n = 1; n <= count; n += 1) {
    let a = 0;
    let b = 0;
    for (let i = 0; i < ts.length; i += 1) {
      const angle = n * w0 * ts[i];
      a += ws[i] * fs[i] * Math.cos(angle);
      b += ws[i] * fs[i] * Math.sin(angle);
    }
    terms.push({ n, a: (2 * a) / period, b: (2 * b) / period });
  }
  return { period, mean: total / period, terms };
}

/** The sum of the harmonics at a time — the curve that is drawn over the function. */
export function partial(series: Series, t: number): number {
  const w0 = (2 * Math.PI) / series.period;
  let out = series.mean;
  for (const h of series.terms) out += h.a * Math.cos(h.n * w0 * t) + h.b * Math.sin(h.n * w0 * t);
  return out;
}

/** How big one harmonic is, whatever its phase — the height of its line in a spectrum. */
export const amplitude = (h: Harmonic): number => Math.hypot(h.a, h.b);

// ── The transform ────────────────────────────────────────────────────────

interface Cx {
  re: number;
  im: number;
}

/** A polynomial at `iω`, which is where the powers of i go round. */
function atImaginary(poly: number[], w: number): Cx {
  let re = 0;
  let im = 0;
  for (let k = 0; k < poly.length; k += 1) {
    const size = poly[k] * w ** k;
    const turn = k % 4;
    if (turn === 0) re += size;
    else if (turn === 1) im += size;
    else if (turn === 2) re -= size;
    else im -= size;
  }
  return { re, im };
}

/** `F(ω)` of a causal signal, which is its Laplace transform up the imaginary axis. */
export function spectrumAt(rat: Transform, w: number, even = false): Cx {
  let re = 0;
  let im = 0;
  for (const piece of rat) {
    const top = atImaginary(piece.num, w);
    const bottom = atImaginary(piece.den, w);
    const size = bottom.re * bottom.re + bottom.im * bottom.im;
    if (size === 0) return { re: NaN, im: NaN };
    let x = (top.re * bottom.re + top.im * bottom.im) / size;
    let y = (top.im * bottom.re - top.re * bottom.im) / size;
    if (piece.delay !== 0) {
      // `e^{-i\omega d}` — a delay is a turn of the phase and nothing else,
      // which is the one fact about delays worth carrying away from this.
      const angle = -piece.delay * w;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      [x, y] = [x * c - y * s, x * s + y * c];
    }
    re += x;
    im += y;
  }
  // An even signal is its right half read twice, and the halves' imaginary
  // parts cancel — which is why an even function has a real spectrum.
  return even ? { re: 2 * re, im: 0 } : { re, im };
}

/** How big the spectrum is at a frequency — the picture, since the transform itself is complex. */
export const sizeAt = (rat: Transform, w: number, even = false): number => {
  const z = spectrumAt(rat, w, even);
  return Math.hypot(z.re, z.im);
};

/** Which way it is turned at a frequency, in radians. */
export const phaseAt = (rat: Transform, w: number, even = false): number => {
  const z = spectrumAt(rat, w, even);
  return Math.atan2(z.im, z.re);
};

/** A number, at the precision an answer has rather than a float's. */
function numberText(v: number): string {
  const near = Number(v.toPrecision(10));
  if (Math.abs(near - Math.round(near)) < 1e-9) return String(Math.round(near));
  return String(Number(v.toPrecision(6)));
}

/** `3\pi` rather than `9.42478`, where that is what the number is. */
function turnText(v: number): string {
  const over = v / Math.PI;
  if (Math.abs(over - Math.round(over)) < 1e-9 && Math.abs(over) >= 1 && Math.abs(over) < 1000) {
    const k = Math.round(over);
    return `${k === 1 ? '' : k === -1 ? '-' : k}\\pi`;
  }
  return numberText(v);
}

/** A polynomial in `iω`, with the brackets that power needs. */
function spectrumPoly(poly: number[]): string {
  const parts: { negative: boolean; text: string }[] = [];
  for (let i = poly.length - 1; i >= 0; i -= 1) {
    const c = poly[i];
    if (Math.abs(c) < 1e-9) continue;
    const size = Math.abs(c);
    const power = i === 0 ? '' : i === 1 ? 'i\\omega' : `(i\\omega)^{${i}}`;
    const front = i === 0 || Math.abs(size - 1) > 1e-9 ? numberText(size) : '';
    parts.push({ negative: c < 0, text: `${front}${power}` });
  }
  if (!parts.length) return '0';
  let out = (parts[0].negative ? '-' : '') + parts[0].text;
  for (const part of parts.slice(1)) out += `${part.negative ? ' - ' : ' + '}${part.text}`;
  return out;
}

/** The transform as a formula in `iω` — which is the Laplace one with s replaced. */
export function latexSpectrum(rat: Transform, even = false): string {
  const parts = rat.map((piece) => {
    const den = spectrumPoly(piece.den);
    const num = spectrumPoly(piece.num);
    const body = den === '1' ? num : `\\frac{${num}}{${den}}`;
    return piece.delay === 0 ? body : `e^{-${numberText(piece.delay)}i\\omega}${den === '1' && / [+-] /.test(num) ? `(${num})` : body}`;
  });
  const sum = parts.join(' + ');
  return even ? `2\\,\\mathrm{Re}\\left[${sum}\\right]` : sum;
}

/** What the harmonics come to, written out — the first few of them, and a sign there are more. */
export function latexSeries(series: Series, of = 't', show = 5): string {
  const w0 = (2 * Math.PI) / series.period;
  const biggest = Math.max(Math.abs(series.mean), ...series.terms.map(amplitude), 1e-12);
  const small = 1e-6 * biggest;
  const parts: { negative: boolean; text: string }[] = [];
  if (Math.abs(series.mean) > small) parts.push({ negative: series.mean < 0, text: numberText(Math.abs(series.mean)) });
  let more = false;
  for (const h of series.terms) {
    const freq = turnText(h.n * w0);
    // `\pi t` rather than `\pit`, which is a command nobody has heard of.
    const angle = freq === '1' ? of : `${/[A-Za-z]$/.test(freq) ? `${freq} ` : freq}${of}`;
    for (const [size, wave] of [
      [h.a, '\\cos'],
      [h.b, '\\sin'],
    ] as [number, string][]) {
      if (Math.abs(size) <= small) continue;
      if (parts.length >= show) {
        more = true;
        continue;
      }
      const front = Math.abs(Math.abs(size) - 1) < 1e-9 ? '' : numberText(Math.abs(size));
      parts.push({ negative: size < 0, text: `${front}${wave}(${angle})` });
    }
  }
  if (!parts.length) return '0';
  let out = (parts[0].negative ? '-' : '') + parts[0].text;
  for (const part of parts.slice(1)) out += `${part.negative ? ' - ' : ' + '}${part.text}`;
  return more ? `${out} + \\cdots` : out;
}

// ── Reading one off what somebody typed ──────────────────────────────────

const bad = (fault: string): Got<never> => ({ ok: false, fault });

/**
 * `e^{-2|t|}` halved: an even function is its right-hand side, read twice.
 *
 * Only where *every* t is inside a `|·|`, because that is what makes the claim
 * true. `e^{-|t|}\cos(2t)` is even as well and is not read here — a rule that
 * is right about the cases it takes and silent about the rest is worth more
 * than one that is usually right.
 */
export function folded(node: Node, of: string): Node | null {
  let found = false;
  const walk = (n: Node): Node | null => {
    switch (n.kind) {
      case 'name':
        return n.name === of ? null : n;
      case 'num':
        return n;
      case 'abs': {
        if (n.body.kind === 'name' && n.body.name === of) {
          found = true;
          return n.body;
        }
        const inner = walk(n.body);
        return inner ? { kind: 'abs', body: inner } : null;
      }
      case 'neg': {
        const inner = walk(n.body);
        return inner ? { kind: 'neg', body: inner } : null;
      }
      case 'op': {
        const left = walk(n.left);
        const right = walk(n.right);
        return left && right ? { kind: 'op', op: n.op, left, right } : null;
      }
      case 'call': {
        const args = n.args.map(walk);
        return args.every((a) => a !== null) ? { kind: 'call', name: n.name, args: args as Node[] } : null;
      }
      case 'apply': {
        const args = n.args.map(walk);
        if (!args.every((a) => a !== null)) return null;
        const power = n.power ? walk(n.power) : undefined;
        if (n.power && !power) return null;
        return { kind: 'apply', name: n.name, args: args as Node[], ...(power ? { power } : {}) };
      }
      default:
        return null;
    }
  };
  const out = walk(node);
  return found && out ? out : null;
}

/** A transform, and whether it was read off an even function's right-hand half. */
export interface Spectrum {
  rat: Transform;
  even: boolean;
}

/**
 * The Fourier transform of what somebody typed.
 *
 * Refused where the signal does not settle, and the refusal is the teaching:
 * `F{\sin(t)}` has poles on the axis, its transform is a pair of deltas rather
 * than a function, and answering with the part that happens to be a function
 * would be the wrong answer told confidently.
 */
export function spectrumOf(node: Node, of: string, scope: Scope = {}): Got<Spectrum> {
  const half = folded(node, of);
  const read = readFn(half ?? node, of, scope);
  if (!read.ok) return read;
  const rat = forward(read.it);
  const worst = poles(rat).reduce((most, p) => Math.max(most, p.re), -Infinity);
  if (worst > -1e-7) {
    return bad(
      worst > 1e-7
        ? 'This grows rather than settles, so it has no Fourier transform.'
        : 'This never dies away, so its transform is an impulse in frequency rather than a function. Laplace is the tool for it.',
    );
  }
  return { ok: true, it: { rat, even: half !== null } };
}

/** A function of t off the list, ready to be sampled — how a series gets its integrand. */
export function sampler(body: Node, of: string, scope: Scope): (t: number) => number {
  return (t: number) => {
    const got = value(body, { ...scope, vars: { ...scope.vars, [of]: t } });
    return Array.isArray(got) ? (got[0] ?? NaN) : got;
  };
}

// ── The discrete one: the transform you actually compute ─────────────────

/**
 * The DFT, which is the only one of the three that runs on data.
 *
 * The series above wants a formula to integrate and the transform wants one to
 * look up. What somebody actually has is a column of numbers — a reading each
 * month, a price each day, forty samples off a sensor — and the question they
 * have about it is the same question: what frequencies is this made of. That
 * is this one, and it is finite, exact, and has nothing to refuse.
 *
 * It is also the same object as the z-transform, read at particular places:
 * `X[k]` is `X(z)` at `z = e^{2\pi ik/N}`, which is to say the transform of
 * `lib/discrete.ts` sampled at N points evenly round the unit circle. The two
 * files are not joined in code — there would be nothing to share but a loop —
 * but that is why the pole readings there and the peaks here say the same
 * things about the same sequence.
 */
export interface Bin {
  re: number;
  im: number;
}

/** The sum written out: N terms for each of N answers. Slow, and the definition. */
export function slowDft(xs: Bin[], sign = -1): Bin[] {
  const n = xs.length;
  const out: Bin[] = [];
  for (let k = 0; k < n; k += 1) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i += 1) {
      const angle = (sign * 2 * Math.PI * k * i) / n;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      re += xs[i].re * c - xs[i].im * s;
      im += xs[i].re * s + xs[i].im * c;
    }
    out.push({ re, im });
  }
  return out;
}

/**
 * The same answer by halves, where the count allows it.
 *
 * Cooley–Tukey: the even-numbered samples and the odd-numbered ones are two
 * transforms of half the size, and the whole is those two with a turn applied
 * to the second. That is the fast Fourier transform, and it is the reason
 * anybody can take the spectrum of a thousand points on a phone.
 *
 * It only applies when the count is a power of two, so `dft` falls back to the
 * sum above, and the two are checked against each other in the tests. A fast
 * method that quietly disagreed with its own definition would be the worst
 * thing in this file.
 */
function fastDft(xs: Bin[], sign: number): Bin[] {
  const n = xs.length;
  if (n === 1) return [{ ...xs[0] }];
  const even = fastDft(xs.filter((_, i) => i % 2 === 0), sign);
  const odd = fastDft(xs.filter((_, i) => i % 2 === 1), sign);
  const out: Bin[] = new Array(n).fill(0).map(() => ({ re: 0, im: 0 }));
  for (let k = 0; k < n / 2; k += 1) {
    const angle = (sign * 2 * Math.PI * k) / n;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const turned = { re: odd[k].re * c - odd[k].im * s, im: odd[k].re * s + odd[k].im * c };
    out[k] = { re: even[k].re + turned.re, im: even[k].im + turned.im };
    out[k + n / 2] = { re: even[k].re - turned.re, im: even[k].im - turned.im };
  }
  return out;
}

const halves = (n: number) => n > 0 && (n & (n - 1)) === 0;

const both = (xs: Bin[], sign: number): Bin[] => (halves(xs.length) ? fastDft(xs, sign) : slowDft(xs, sign));

/** The frequencies a run of numbers is made of. */
export function dft(xs: number[]): Bin[] {
  return both(xs.map((v) => ({ re: v, im: 0 })), -1);
}

/**
 * And back again.
 *
 * Not on the screen — there is no notation for a column of complex numbers to
 * type in — but it is the check that the forward one is right, which is worth
 * more here than a screen would be. It is the same sum with the turn going the
 * other way, over N.
 */
export function idft(bins: Bin[]): number[] {
  return icdft(bins).map((b) => b.re);
}

/**
 * The inverse with its imaginary half kept.
 *
 * `idft` throws that half away because a run of real numbers is what went in
 * and what comes back. `lib/hilbert.ts` wants the other half: it builds a
 * spectrum that is deliberately *not* symmetric, and the imaginary part of
 * what comes back from one of those is the whole answer.
 */
export function icdft(bins: Bin[]): Bin[] {
  const n = bins.length;
  return both(bins, 1).map((b) => ({ re: b.re / n, im: b.im / n }));
}

/** How big a bin is — the height of its line in a spectrum. */
export const sizeOf = (b: Bin): number => Math.hypot(b.re, b.im);

/**
 * The bins written as the waves they are.
 *
 * A column of complex numbers is the answer and is not a reading. The same
 * numbers as amplitudes and phases is the `Series` the rest of this file
 * already prints and sums, so the DFT of a run of data reads out in exactly
 * the notation the continuous series does — which is the point, since they are
 * the same statement about the same thing.
 *
 * Bin k and bin N−k are one wave counted twice for real data, so the pair is
 * folded into one harmonic. The last bin of an even-length run has no partner
 * and is not doubled, which is the fiddly line every implementation gets wrong
 * once.
 */
export function seriesOf(xs: number[]): Series {
  const n = xs.length;
  const bins = dft(xs);
  const terms: Harmonic[] = [];
  const last = Math.floor(n / 2);
  for (let k = 1; k <= last; k += 1) {
    const pair = n % 2 === 0 && k === last ? 1 : 2;
    terms.push({ n: k, a: (pair * bins[k].re) / n, b: (-pair * bins[k].im) / n });
  }
  return { period: n, mean: bins[0].re / n, terms };
}

/** Which bin carries the most, and what that means in cycles across the run. */
export function loudest(xs: number[]): { k: number; size: number } | null {
  const bins = dft(xs);
  const n = bins.length;
  let best = -1;
  let size = 0;
  for (let k = 1; k <= Math.floor(n / 2); k += 1) {
    if (sizeOf(bins[k]) > size) {
      size = sizeOf(bins[k]);
      best = k;
    }
  }
  return best < 0 ? null : { k: best, size };
}

/** What somebody typed, as the run of numbers to transform. */
export function samplesOf(
  body: Node,
  count: Node | null,
  scope: Scope,
): { ok: true; it: number[] } | { ok: false; fault: string } {
  const bad = (fault: string) => ({ ok: false as const, fault });
  if (!count) {
    const got = value(body, scope);
    if (!Array.isArray(got)) {
      return bad('A transform of data wants the data: a list like [1, 0, -1, 0], or a formula and how many samples.');
    }
    if (got.length < 2) return bad('Two samples is the fewest there is anything to say about.');
    if (got.length > 4096) return bad('Four thousand samples is as many as this takes at once.');
    if (got.some((v) => !Number.isFinite(v))) return bad('Some of those are not numbers.');
    return { ok: true, it: got };
  }
  const asked = value(count, scope);
  const many = Array.isArray(asked) ? NaN : asked;
  if (!Number.isInteger(many) || many < 2 || many > 4096) {
    return bad('How many samples is a whole number from 2 to 4096.');
  }
  const f = sampler(body, 'n', scope);
  const out: number[] = [];
  for (let i = 0; i < many; i += 1) {
    const v = f(i);
    if (!Number.isFinite(v)) return bad(`There is no value at n = ${i}.`);
    out.push(v);
  }
  return { ok: true, it: out };
}
