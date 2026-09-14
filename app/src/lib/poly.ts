/**
 * The arithmetic three transforms share: complex numbers, polynomials, and
 * taking a fraction apart.
 *
 * `lib/laplace.ts` needed this first — a transform is a rational function and
 * coming back from one is a partial fraction — and then `lib/discrete.ts`
 * needed exactly the same of it, one variable along: the z-transform is a
 * rational function of `z` and coming back from *that* is the same split over
 * the same roots. Two copies of a root finder is two root finders that drift,
 * so there is one, here, and the two transforms are the two things that read
 * it rather than two things that have their own.
 *
 * Nothing here knows what a transform is. It is polynomials and complex
 * numbers, which is why it can be shared without either file having to know
 * about the other.
 *
 * ## The one judgement call in it
 *
 * A repeated root is never found exactly. `gathered` says what is done about
 * that, and the short version is that the answer is checked rather than
 * trusted: the factors are multiplied back out and compared with the
 * polynomial they came from, and a gathering that does not reproduce it is
 * dropped for a tighter one. A wrong multiplicity is a wrong answer, and
 * guessing one is worse than a clumsier partial fraction that is right.
 */

// ── Numbers with two parts ───────────────────────────────────────────────

/** Below this, a number is zero: a coefficient that survived rounding, not a quantity. */
const TINY = 1e-9;

export interface Complex {
  re: number;
  im: number;
}

/** The short name this file's own arithmetic is written in. */
type Cx = Complex;

export const cx = (re: number, im = 0): Cx => ({ re, im });
export const cadd = (a: Cx, b: Cx): Cx => ({ re: a.re + b.re, im: a.im + b.im });
export const csub = (a: Cx, b: Cx): Cx => ({ re: a.re - b.re, im: a.im - b.im });
export const cmul = (a: Cx, b: Cx): Cx => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
export const cabs = (a: Cx): number => Math.hypot(a.re, a.im);

export function cdiv(a: Cx, b: Cx): Cx {
  const d = b.re * b.re + b.im * b.im;
  if (d === 0) return cx(NaN, NaN);
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}

// ── Polynomials, lowest power first ──────────────────────────────────────

/** `[1, 0, 2]` is `1 + 2s²`. Ascending because that is the order the algebra wants. */
export type Poly = number[];
export type CPoly = Cx[];

export const pTrim = (a: Poly): Poly => {
  const out = [...a];
  while (out.length > 1 && Math.abs(out[out.length - 1]) < TINY) out.pop();
  return out;
};

export function pAdd(a: Poly, b: Poly): Poly {
  const out: Poly = [];
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) out.push((a[i] ?? 0) + (b[i] ?? 0));
  return out;
}

export function pMul(a: Poly, b: Poly): Poly {
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i += 1) for (let j = 0; j < b.length; j += 1) out[i + j] += a[i] * b[j];
  return out;
}

export const pScale = (a: Poly, k: number): Poly => a.map((v) => v * k);

export function pPow(a: Poly, n: number): Poly {
  let out: Poly = [1];
  for (let i = 0; i < n; i += 1) out = pMul(out, a);
  return out;
}

/** Horner, from the top down. */
export function pAt(a: Poly, x: number): number {
  let out = 0;
  for (let i = a.length - 1; i >= 0; i -= 1) out = out * x + a[i];
  return out;
}

/** Long division, for a numerator that is not smaller than its denominator. */
export function pDivide(num: Poly, den: Poly): { quotient: Poly; remainder: Poly } {
  const d = pTrim(den);
  const r = [...pTrim(num)];
  const quotient = new Array<number>(Math.max(1, r.length - d.length + 1)).fill(0);
  const lead = d[d.length - 1];
  for (let i = r.length - d.length; i >= 0; i -= 1) {
    const k = r[i + d.length - 1] / lead;
    quotient[i] = k;
    for (let j = 0; j < d.length; j += 1) r[i + j] -= k * d[j];
  }
  return { quotient: pTrim(quotient), remainder: pTrim(r.slice(0, Math.max(1, d.length - 1))) };
}

export function qMul(a: CPoly, b: CPoly): CPoly {
  const out: CPoly = new Array(a.length + b.length - 1).fill(0).map(() => cx(0));
  for (let i = 0; i < a.length; i += 1) for (let j = 0; j < b.length; j += 1) out[i + j] = cadd(out[i + j], cmul(a[i], b[j]));
  return out;
}

export function qPow(a: CPoly, n: number): CPoly {
  let out: CPoly = [cx(1)];
  for (let i = 0; i < n; i += 1) out = qMul(out, a);
  return out;
}

export function qAt(a: CPoly, z: Cx): Cx {
  let out = cx(0);
  for (let i = a.length - 1; i >= 0; i -= 1) out = cadd(cmul(out, z), a[i]);
  return out;
}

export function factorial(n: number): number {
  let out = 1;
  for (let i = 2; i <= n; i += 1) out *= i;
  return out;
}


// ── Roots, and taking a fraction apart ───────────────────────────────────
/**
 * The roots of a polynomial, all at once.
 *
 * Durand–Kerner: start the roots spread round a circle and push each one by
 * the polynomial's value there divided by its distance from the others, which
 * converges on all of them together. There is no formula past the quartic, so
 * a numerical method is not a shortcut here — it is the only way.
 */
export function roots(den: Poly): Cx[] {
  const a = pTrim(den);
  const degree = a.length - 1;
  if (degree < 1) return [];
  const monic = a.map((v) => v / a[degree]);
  let guess: Cx[] = [];
  for (let i = 0; i < degree; i += 1) {
    const angle = (2 * Math.PI * i) / degree + 0.4;
    guess.push(cx(0.9 * Math.cos(angle), 0.9 * Math.sin(angle)));
  }
  const poly: CPoly = monic.map((v) => cx(v));
  for (let pass = 0; pass < 500; pass += 1) {
    let moved = 0;
    const next: Cx[] = [];
    for (let i = 0; i < degree; i += 1) {
      let below = cx(1);
      for (let j = 0; j < degree; j += 1) if (j !== i) below = cmul(below, csub(guess[i], guess[j]));
      const step = cdiv(qAt(poly, guess[i]), below);
      if (!Number.isFinite(step.re) || !Number.isFinite(step.im)) return guess;
      next.push(csub(guess[i], step));
      moved = Math.max(moved, cabs(step));
    }
    guess = next;
    if (moved < 1e-15) break;
  }
  return guess.map(flattened);
}

/** A root whose imaginary part is rounding rather than a frequency. */
const flattened = (z: Cx): Cx => (Math.abs(z.im) < 1e-7 * Math.max(1, cabs(z)) ? cx(z.re, 0) : z);

/**
 * A root that is known to be repeated, sharpened.
 *
 * Durand–Kerner slows to a crawl at a repeated root — `(s+1)^3` comes back as
 * three roots in a ring of about a ten-thousandth about −1, which is nowhere
 * near enough to put back into a partial fraction. Newton's step multiplied by
 * the multiplicity fixes that: it is quadratic again once the count is known,
 * and four or five passes take the ring down to the last bit of the float.
 */
function polished(den: Poly, root: Cx, times: number): Cx {
  const poly: CPoly = den.map((v) => cx(v));
  const slope: CPoly = den.slice(1).map((v, i) => cx(v * (i + 1)));
  let z = root;
  for (let pass = 0; pass < 60; pass += 1) {
    const below = qAt(slope, z);
    if (cabs(below) < 1e-300) break;
    const step = cmul(cx(times), cdiv(qAt(poly, z), below));
    if (!Number.isFinite(step.re) || !Number.isFinite(step.im)) break;
    z = csub(z, step);
    if (cabs(step) < 1e-16 * Math.max(1, cabs(z))) break;
  }
  return flattened(z);
}

/** Roots within a radius of each other, taken as one root occurring that many times. */
function clustered(found: Cx[], near: number): { root: Cx; times: number }[] {
  const out: { root: Cx; times: number }[] = [];
  for (const z of found) {
    const had = near > 0 ? out.find((g) => cabs(csub(g.root, z)) < near * Math.max(1, cabs(z))) : undefined;
    if (had) {
      had.root = {
        re: (had.root.re * had.times + z.re) / (had.times + 1),
        im: (had.root.im * had.times + z.im) / (had.times + 1),
      };
      had.times += 1;
    } else out.push({ root: { ...z }, times: 1 });
  }
  return out;
}

/** Whether multiplying the factors back out gives the polynomial they came from. */
function reproduces(groups: { root: Cx; times: number }[], den: Poly): boolean {
  const top = pTrim(den);
  const lead = top[top.length - 1];
  const size = top.reduce((m, v) => Math.max(m, Math.abs(v)), 1);
  let made: CPoly = [cx(lead)];
  for (const g of groups) made = qMul(made, qPow([cx(-g.root.re, -g.root.im), cx(1)], g.times));
  if (made.length !== top.length) return false;
  for (let i = 0; i < top.length; i += 1) {
    if (Math.abs(made[i].re - top[i]) > 1e-8 * size) return false;
    if (Math.abs(made[i].im) > 1e-8 * size) return false;
  }
  return true;
}

/**
 * The roots gathered into the distinct ones and how many times each occurs.
 *
 * A repeated root is never found exactly, so nearby roots are gathered,
 * sharpened, and then *checked* — the factors are multiplied back out and
 * compared with the polynomial they came from. A radius that gathered too much
 * fails that check and the next one down is tried, ending at a radius of
 * nothing, which is every root on its own. A wrong multiplicity is a wrong
 * answer, and guessing one is worse than a clumsier partial fraction that is
 * right.
 */
export function gathered(found: Cx[], den: Poly): { root: Cx; times: number }[] {
  for (const near of [1e-2, 1e-3, 1e-4, 0]) {
    const groups = clustered(found, near).map((g) => ({ ...g, root: polished(den, g.root, g.times) }));
    if (reproduces(groups, den)) return groups;
  }
  return found.map((z) => ({ root: z, times: 1 }));
}

/** `den(s)` with one root taken out, once — synthetic division, exactly. */
function without(poly: CPoly, root: Cx): CPoly {
  const out: CPoly = new Array(Math.max(1, poly.length - 1)).fill(0).map(() => cx(0));
  let carry = cx(0);
  for (let i = poly.length - 1; i >= 1; i -= 1) {
    carry = cadd(poly[i], cmul(carry, root));
    out[i - 1] = carry;
  }
  return out;
}

/** A square complex system, by elimination with the biggest pivot available. */
function solved(matrix: Cx[][], rhs: Cx[]): Cx[] | null {
  const n = rhs.length;
  const m = matrix.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < n; col += 1) {
    let best = col;
    for (let row = col + 1; row < n; row += 1) if (cabs(m[row][col]) > cabs(m[best][col])) best = row;
    if (cabs(m[best][col]) < 1e-12) return null;
    [m[col], m[best]] = [m[best], m[col]];
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const k = cdiv(m[row][col], m[col][col]);
      for (let j = col; j <= n; j += 1) m[row][j] = csub(m[row][j], cmul(k, m[col][j]));
    }
  }
  return m.map((row, i) => cdiv(row[n], m[i][i]));
}

/**
 * One fraction, split and turned back into terms.
 *
 * The split is a linear system rather than the residue formula: with the basis
 * `den(s)/(s − r)^i` written out as polynomials, the coefficients are whatever
 * combination of them reproduces the numerator, which is one solve. The
 * residue formula needs derivatives at repeated roots and loses accuracy at
 * every one of them.
 *
 * Nothing in it is about time or about s: it takes a fraction and gives back
 * which simple fractions add up to it, which is what both transforms want of
 * it and all either of them wants.
 */
export function partialFractions(num: Poly, den: Poly): { root: Complex; power: number; coef: Complex }[] | null {
  const bottom = pTrim(den);
  const degree = bottom.length - 1;
  if (degree < 1) return null;
  const groups = gathered(roots(bottom), bottom);
  const poly: CPoly = bottom.map((v) => cx(v));
  const columns: { root: Cx; power: number; coefficients: CPoly }[] = [];
  for (const g of groups) {
    let left = poly;
    for (let i = 1; i <= g.times; i += 1) {
      left = without(left, g.root);
      columns.push({ root: g.root, power: i, coefficients: left });
    }
  }
  if (columns.length !== degree) return null;
  const matrix: Cx[][] = [];
  for (let row = 0; row < degree; row += 1) matrix.push(columns.map((c) => c.coefficients[row] ?? cx(0)));
  const want: Cx[] = [];
  for (let row = 0; row < degree; row += 1) want.push(cx(num[row] ?? 0));
  const answer = solved(matrix, want);
  if (!answer) return null;
  return columns.map((c, i) => ({ root: c.root, power: c.power, coef: answer[i] }));
}
