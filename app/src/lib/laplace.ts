/**
 * The Laplace transform, and the way back.
 *
 * `lib/ode.ts` walks a differential equation and draws the curve it makes. The
 * curve is right — it is checked against answers with closed forms — and it is
 * still not what a methods course asks for on the page. The page asks for the
 * formula: `y = 4e^{-0.075t}\cos(0.997t) + …`, which a numerical walk does not
 * have and cannot be asked for. Laplace is how that formula is got, and it is
 * the one piece of symbolic work this app does.
 *
 * ## Why this is not the symbolic algebra `lib/calc.ts` refuses
 *
 * `lib/calc.ts` says at the top that it does not rearrange, and that a program
 * which half-solved would be worse than none. That still holds. What makes
 * this different is that it is not general: it works over one family of
 * functions and is *closed* over it, so there is no half-solved case to fall
 * into. The family is
 *
 *     c · (t − d)^n · e^{a(t − d)} · cos or sin of b(t − d) · u(t − d)
 *
 * — a constant, a power of t, an exponential, a wave, and a delay. Sums of
 * those are exactly the functions whose transforms are rational in s, and
 * rational functions of s are exactly what comes back. Anything outside it is
 * refused by name rather than approximated: `\ln(t)` has a transform and it is
 * not in this family, so the answer is a sentence saying so.
 *
 * That is the whole design. A term goes in, a rational function comes out; a
 * rational function goes in, terms come back. Two directions over one family.
 *
 * ## Where the arithmetic is numerical, and why that is honest
 *
 * Going back requires the denominator's roots, and there is no formula for
 * them past the quartic. So the roots are found numerically (Durand–Kerner),
 * clustered to recover repeated ones, and then *checked*: the factors are
 * multiplied back out and compared with the polynomial they came from. If they
 * do not reproduce it the multiplicities are dropped rather than trusted.
 *
 * This means a coefficient can read `0.9999999` where a textbook writes `1`,
 * and the printer rounds for display. It does not mean the answer is a guess:
 * every result in `laplace.test.ts` is checked against a closed form worked by
 * hand, and the solved equations are checked a second way — against the
 * numerical walk in `lib/ode.ts`, which knows nothing about any of this.
 *
 * ## What it is used for
 *
 * Three things, all on the graph list:
 *
 *   `L{t^2 e^{-t}}`          the transform, read and drawn against s
 *   `L^{-1}{1/(s^2 + 4)}`    the way back, read and drawn against t
 *   `y'' = -4y`, `y(0) = 1`  the exact solution beside the walked curve
 *
 * The third is the reason for the first two.
 */

import { value, type Node, type Scope } from './calc';

/** Below this, a number is zero: a coefficient that survived rounding, not a quantity. */
const TINY = 1e-9;

// ── Numbers with two parts ───────────────────────────────────────────────

interface Cx {
  re: number;
  im: number;
}

const cx = (re: number, im = 0): Cx => ({ re, im });
const cadd = (a: Cx, b: Cx): Cx => ({ re: a.re + b.re, im: a.im + b.im });
const csub = (a: Cx, b: Cx): Cx => ({ re: a.re - b.re, im: a.im - b.im });
const cmul = (a: Cx, b: Cx): Cx => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const cabs = (a: Cx): number => Math.hypot(a.re, a.im);

function cdiv(a: Cx, b: Cx): Cx {
  const d = b.re * b.re + b.im * b.im;
  if (d === 0) return cx(NaN, NaN);
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}

// ── Polynomials, lowest power first ──────────────────────────────────────

/** `[1, 0, 2]` is `1 + 2s²`. Ascending because that is the order the algebra wants. */
export type Poly = number[];
type CPoly = Cx[];

const pTrim = (a: Poly): Poly => {
  const out = [...a];
  while (out.length > 1 && Math.abs(out[out.length - 1]) < TINY) out.pop();
  return out;
};

function pAdd(a: Poly, b: Poly): Poly {
  const out: Poly = [];
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) out.push((a[i] ?? 0) + (b[i] ?? 0));
  return out;
}

function pMul(a: Poly, b: Poly): Poly {
  const out = new Array<number>(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i += 1) for (let j = 0; j < b.length; j += 1) out[i + j] += a[i] * b[j];
  return out;
}

const pScale = (a: Poly, k: number): Poly => a.map((v) => v * k);

function pPow(a: Poly, n: number): Poly {
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
function pDivide(num: Poly, den: Poly): { quotient: Poly; remainder: Poly } {
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

function qMul(a: CPoly, b: CPoly): CPoly {
  const out: CPoly = new Array(a.length + b.length - 1).fill(0).map(() => cx(0));
  for (let i = 0; i < a.length; i += 1) for (let j = 0; j < b.length; j += 1) out[i + j] = cadd(out[i + j], cmul(a[i], b[j]));
  return out;
}

function qPow(a: CPoly, n: number): CPoly {
  let out: CPoly = [cx(1)];
  for (let i = 0; i < n; i += 1) out = qMul(out, a);
  return out;
}

function qAt(a: CPoly, z: Cx): Cx {
  let out = cx(0);
  for (let i = a.length - 1; i >= 0; i -= 1) out = cadd(cmul(out, z), a[i]);
  return out;
}

function factorial(n: number): number {
  let out = 1;
  for (let i = 2; i <= n; i += 1) out *= i;
  return out;
}

// ── What a time function is ──────────────────────────────────────────────

/**
 * One piece of a function of t: `c (t−d)^n e^{a(t−d)} cos or sin of b(t−d)`,
 * switched on at `t = d`.
 *
 * `b = 0` with `wave: 'cos'` is the plain `c t^n e^{at}`, which is why there is
 * no separate kind for it — a constant, a ramp, a decay and an oscillation are
 * the same shape at different settings, and every rule below is written once
 * because of that.
 */
export interface Term {
  c: number;
  n: number;
  a: number;
  b: number;
  wave: 'cos' | 'sin';
  delay: number;
}

/** `c δ(t − at)` — a kick, not a function. Carried separately because it cannot be drawn. */
export interface Impulse {
  c: number;
  at: number;
}

export interface Fn {
  terms: Term[];
  impulses: Impulse[];
}

/** `e^{-delay·s} · num(s)/den(s)` — one piece of a transform. */
export interface Piece {
  delay: number;
  num: Poly;
  den: Poly;
  /**
   * The denominator's factors, where they are known rather than found.
   *
   * Going out, every denominator is built as a product of `(s − a)` and
   * `((s − a)² + b²)` and it is thrown away to multiply them out: `(s + 1)^3`
   * printed as `s^3 + 3s^2 + 3s + 1` is the same function and is not the one
   * anybody wants to read, and it is the form the next step needs factored
   * again. So the factors are carried rather than recovered.
   */
  factors?: { poly: Poly; power: number }[];
}

/** A transform: a sum of pieces, one per distinct delay. */
export type Transform = Piece[];

export type Got<T> = { ok: true; it: T } | { ok: false; fault: string };

const term = (c: number, n = 0, a = 0, b = 0, wave: 'cos' | 'sin' = 'cos', delay = 0): Term => ({ c, n, a, b, wave, delay });
const constant = (c: number): Fn => ({ terms: [term(c)], impulses: [] });

/** What the function is worth at a time. Before its delay it is nothing, which is the whole point of u(t). */
export function at(fn: Fn, t: number): number {
  let out = 0;
  for (const p of fn.terms) {
    if (t < p.delay) continue;
    const s = t - p.delay;
    const wave = p.b === 0 ? (p.wave === 'cos' ? 1 : 0) : p.wave === 'cos' ? Math.cos(p.b * s) : Math.sin(p.b * s);
    out += p.c * (p.n === 0 ? 1 : s ** p.n) * Math.exp(p.a * s) * wave;
  }
  return out;
}

/** What a transform is worth at a value of s — for drawing it, poles and all. */
export function atS(rat: Transform, s: number): number {
  let out = 0;
  for (const piece of rat) out += Math.exp(-piece.delay * s) * (pAt(piece.num, s) / pAt(piece.den, s));
  return out;
}

/** Terms too small to matter, dropped; the rest gathered where they are the same shape. */
export function tidy(fn: Fn): Fn {
  const seen = new Map<string, Term>();
  for (const p of fn.terms) {
    if (Math.abs(p.c) < 1e-7) continue;
    if (p.b === 0 && p.wave === 'sin') continue;
    const key = [p.n, round(p.a), round(p.b), p.wave, round(p.delay)].join('|');
    const had = seen.get(key);
    if (had) had.c += p.c;
    else seen.set(key, { ...p });
  }
  const terms = [...seen.values()].filter((p) => Math.abs(p.c) >= 1e-7);
  // Slowest decay first, which is how an answer is written: the term that is
  // still there at the end of the page leads, and `e^{-t} - e^{-2t}` reads the
  // way it is spoken rather than starting with a minus sign.
  terms.sort((p, q) => p.delay - q.delay || q.a - p.a || p.n - q.n || (p.wave === q.wave ? 0 : p.wave === 'cos' ? -1 : 1));
  return { terms, impulses: fn.impulses.filter((i) => Math.abs(i.c) >= 1e-7) };
}

const round = (v: number) => Number(v.toPrecision(9));

// ── Reading a function of t out of what somebody typed ───────────────────

/** Whether a name appears anywhere in the tree — which decides what is a constant here. */
function mentions(node: Node, name: string): boolean {
  switch (node.kind) {
    case 'name':
      return node.name === name;
    case 'num':
      return false;
    case 'list':
      return node.items.some((i) => mentions(i, name));
    case 'range':
      return mentions(node.from, name) || (node.second ? mentions(node.second, name) : false) || mentions(node.to, name);
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
    case 'big':
      return mentions(node.from, name) || mentions(node.to, name) || mentions(node.body, name);
  }
}

/** Every name in the tree, so a refusal can say which letter it could not place. */
function names(node: Node, into: Set<string> = new Set()): Set<string> {
  switch (node.kind) {
    case 'name':
      into.add(node.name);
      break;
    case 'list':
      node.items.forEach((i) => names(i, into));
      break;
    case 'range':
      names(node.from, into);
      if (node.second) names(node.second, into);
      names(node.to, into);
      break;
    case 'neg':
    case 'fact':
    case 'percent':
    case 'abs':
      names(node.body, into);
      break;
    case 'op':
      names(node.left, into);
      names(node.right, into);
      break;
    case 'call':
      node.args.forEach((a) => names(a, into));
      break;
    case 'apply':
      node.args.forEach((a) => names(a, into));
      if (node.power) names(node.power, into);
      break;
    case 'big':
      names(node.from, into);
      names(node.to, into);
      names(node.body, into);
      break;
    default:
      break;
  }
  return into;
}

/** The names this transforms by rule rather than by arithmetic. */
const FAMILY = new Set(['u', 'step', 'heaviside', 'δ', 'delta', 'dirac', 'impulse', 'exp', 'sin', 'cos', 'sinh', 'cosh']);

/**
 * `a(x + 1)`, `f(t)` and `u(t - 2)` all arrive wearing the same brackets.
 *
 * `lib/calc.ts` leaves that choice until there is a scope to make it against,
 * and this makes the same one the same way: a letter somebody gave a value to
 * is that value times the bracket, a function somebody defined above is its
 * own body with the argument put in, and what is left is for the table. So
 * `s (s + 2)^2` is a product and `u(t - 2)` is a step, without either having
 * to be written differently.
 */
function opened(node: Node & { kind: 'apply' }, scope: Scope): Node | null {
  const raised = (body: Node): Node =>
    node.power === undefined ? body : { kind: 'op', op: '^', left: body, right: node.power };
  const own = scope.funs?.[node.name];
  if (own && own.params.length === node.args.length) {
    let body = own.body;
    for (let i = 0; i < own.params.length; i += 1) body = put(body, own.params[i], node.args[i]);
    return raised(body);
  }
  if (own || node.args.length !== 1) return null;
  if (!(scope.vars && node.name in scope.vars) && FAMILY.has(node.name)) return null;
  // The power is the bracket's, not the product's: see the note on `apply` in
  // `lib/calc.ts`. `s(s + 2)^2` is s times the square, which is the shape half
  // the exercises in a Laplace chapter are written in.
  return { kind: 'op', op: '*', left: { kind: 'name', name: node.name }, right: raised(node.args[0]) };
}

const bad = (fault: string): Got<never> => ({ ok: false, fault });
const good = <T,>(it: T): Got<T> => ({ ok: true, it });

/** A sub-expression with no t in it, worked out. Sliders and `\pi` arrive through here. */
function fixed(node: Node, scope: Scope): Got<number> {
  const got = value(node, scope);
  if (Array.isArray(got) || !Number.isFinite(got)) {
    const loose = [...names(node)].filter((n) => !(scope.vars && n in scope.vars));
    return bad(
      loose.length
        ? `${loose[0]} has no value, so this is not a transform yet.`
        : 'That part does not work out to a number.',
    );
  }
  return good(got);
}

/** `m·t + k`, where an argument has to be straight for the rule to apply. */
function straight(node: Node, of: string, scope: Scope): Got<{ m: number; k: number }> {
  const fn = readFn(node, of, scope);
  if (!fn.ok) return fn;
  const { terms, impulses } = tidy(fn.it);
  if (impulses.length) return bad('An impulse cannot go inside a function.');
  let m = 0;
  let k = 0;
  for (const p of terms) {
    if (p.a !== 0 || p.b !== 0 || p.delay !== 0 || p.n > 1) return bad('This wants a straight line in t inside it, like 2t - 1.');
    if (p.n === 0) k += p.c;
    else m += p.c;
  }
  return good({ m, k });
}

/** Two of the family multiplied — which stays in the family, and that is the point. */
function timesTerm(p: Term, q: Term): Term[] {
  const delay = Math.max(p.delay, q.delay);
  const out: Term[] = [];
  for (const left of shifted(p, delay)) {
    for (const right of shifted(q, delay)) {
      const c = left.c * right.c;
      const n = left.n + right.n;
      const a = left.a + right.a;
      for (const w of timesWave(left.b, left.wave, right.b, right.wave)) {
        out.push(term(c * w.c, n, a, w.b, w.wave, delay));
      }
    }
  }
  return out;
}

/**
 * Two waves multiplied, as the sum of two waves.
 *
 * `\cos(2t)\cos(3t)` is not in the family and `\frac{1}{2}\cos(t) +
 * \frac{1}{2}\cos(5t)` is the same function and is. This is the identity every
 * textbook prints and the reason products of the family stay in it.
 */
function timesWave(b1: number, w1: 'cos' | 'sin', b2: number, w2: 'cos' | 'sin'): { c: number; b: number; wave: 'cos' | 'sin' }[] {
  if (b1 === 0 && b2 === 0) return w1 === 'cos' && w2 === 'cos' ? [{ c: 1, b: 0, wave: 'cos' }] : [{ c: 0, b: 0, wave: 'cos' }];
  if (b1 === 0) return w1 === 'cos' ? [{ c: 1, b: b2, wave: w2 }] : [{ c: 0, b: 0, wave: 'cos' }];
  if (b2 === 0) return w2 === 'cos' ? [{ c: 1, b: b1, wave: w1 }] : [{ c: 0, b: 0, wave: 'cos' }];
  const sum = b1 + b2;
  const difference = b1 - b2;
  if (w1 === 'cos' && w2 === 'cos') return [wave(0.5, difference, 'cos'), wave(0.5, sum, 'cos')];
  if (w1 === 'sin' && w2 === 'sin') return [wave(0.5, difference, 'cos'), wave(-0.5, sum, 'cos')];
  if (w1 === 'sin') return [wave(0.5, sum, 'sin'), wave(0.5, difference, 'sin')];
  return [wave(0.5, sum, 'sin'), wave(-0.5, difference, 'sin')];
}

/** A wave with a negative frequency is the same wave: cos is even, sin is odd. */
function wave(c: number, b: number, kind: 'cos' | 'sin'): { c: number; b: number; wave: 'cos' | 'sin' } {
  if (b >= 0) return { c, b, wave: kind };
  return { c: kind === 'cos' ? c : -c, b: -b, wave: kind };
}

/**
 * The same term, written from a later start.
 *
 * `e^{-t}` switched on at `t = 2` is `e^{-2}e^{-(t-2)}` — the same function,
 * said in the variable the second shifting theorem wants. Every factor has an
 * addition formula, so this is the binomial, the exponential's law, and the
 * angle-sum identity, applied once each.
 */
function shifted(p: Term, to: number): Term[] {
  const gap = to - p.delay;
  if (gap <= 0) return [{ ...p, delay: to }];
  const out: Term[] = [];
  const grow = Math.exp(p.a * gap);
  const cosine = p.b === 0 ? 1 : Math.cos(p.b * gap);
  const sine = p.b === 0 ? 0 : Math.sin(p.b * gap);
  for (let k = 0; k <= p.n; k += 1) {
    const binomial = (factorial(p.n) / (factorial(k) * factorial(p.n - k))) * gap ** (p.n - k);
    const scale = p.c * binomial * grow;
    if (p.b === 0) {
      if (p.wave === 'cos') out.push(term(scale, k, p.a, 0, 'cos', to));
      continue;
    }
    if (p.wave === 'cos') {
      out.push(term(scale * cosine, k, p.a, p.b, 'cos', to));
      out.push(term(-scale * sine, k, p.a, p.b, 'sin', to));
    } else {
      out.push(term(scale * cosine, k, p.a, p.b, 'sin', to));
      out.push(term(scale * sine, k, p.a, p.b, 'cos', to));
    }
  }
  return out;
}

function timesFn(a: Fn, b: Fn): Got<Fn> {
  if (a.impulses.length || b.impulses.length) {
    const kick = a.impulses.length ? a : b;
    const other = a.impulses.length ? b : a;
    if (kick.terms.length || other.impulses.length) return bad('An impulse times a function is not something this reads.');
    const plain = other.terms.every((p) => p.n === 0 && p.a === 0 && p.b === 0 && p.delay === 0);
    if (!plain) return bad('An impulse can be scaled by a number, not multiplied by a function.');
    const k = other.terms.reduce((sum, p) => sum + p.c, 0);
    return good({ terms: [], impulses: kick.impulses.map((i) => ({ ...i, c: i.c * k })) });
  }
  const terms: Term[] = [];
  for (const p of a.terms) for (const q of b.terms) terms.push(...timesTerm(p, q));
  return good({ terms, impulses: [] });
}

const negated = (fn: Fn): Fn => ({
  terms: fn.terms.map((p) => ({ ...p, c: -p.c })),
  impulses: fn.impulses.map((i) => ({ ...i, c: -i.c })),
});

const plus = (a: Fn, b: Fn): Fn => ({ terms: [...a.terms, ...b.terms], impulses: [...a.impulses, ...b.impulses] });

/**
 * What somebody typed, read as a function of t.
 *
 * Everything that does not mention t is worked out by `lib/calc.ts` and
 * arrives as a number, which is how `\frac{1}{2}`, `3\pi` and a slider called
 * `a` all work without a rule of their own. What is left is the family, and
 * anything outside it comes back as a sentence naming the piece.
 */
export function readFn(node: Node, of: string, scope: Scope = {}): Got<Fn> {
  if (!mentions(node, of)) {
    const got = fixed(node, scope);
    return got.ok ? good(constant(got.it)) : got;
  }
  switch (node.kind) {
    case 'name':
      return good({ terms: [term(1, 1)], impulses: [] });
    case 'neg': {
      const body = readFn(node.body, of, scope);
      return body.ok ? good(negated(body.it)) : body;
    }
    case 'op':
      return readOp(node, of, scope);
    case 'call':
      return readCall(node.name, node.args, of, scope);
    case 'apply': {
      const plain = opened(node, scope);
      return plain ? readFn(plain, of, scope) : readCall(node.name, node.args, of, scope);
    }
    case 'abs':
      return bad('An absolute value has no transform in this family.');
    default:
      return bad('This is not something the transform reads.');
  }
}

function readOp(node: Node & { kind: 'op' }, of: string, scope: Scope): Got<Fn> {
  if (node.op === '+' || node.op === '-') {
    const left = readFn(node.left, of, scope);
    if (!left.ok) return left;
    const right = readFn(node.right, of, scope);
    if (!right.ok) return right;
    return good(plus(left.it, node.op === '-' ? negated(right.it) : right.it));
  }
  if (node.op === '*') {
    const left = readFn(node.left, of, scope);
    if (!left.ok) return left;
    const right = readFn(node.right, of, scope);
    if (!right.ok) return right;
    return timesFn(left.it, right.it);
  }
  if (node.op === '/') {
    if (mentions(node.right, of)) return bad(`Dividing by something with ${of} in it is not in this family.`);
    const by = fixed(node.right, scope);
    if (!by.ok) return by;
    if (Math.abs(by.it) < TINY) return bad('That divides by zero.');
    const left = readFn(node.left, of, scope);
    if (!left.ok) return left;
    return timesFn(left.it, constant(1 / by.it));
  }
  return readPower(node.left, node.right, of, scope);
}

function readPower(base: Node, power: Node, of: string, scope: Scope): Got<Fn> {
  if (!mentions(power, of)) {
    const n = fixed(power, scope);
    if (!n.ok) return n;
    if (!Number.isInteger(n.it) || n.it < 0 || n.it > 12) {
      return bad('A power in this family is a whole number of times, 0 to 12.');
    }
    const body = readFn(base, of, scope);
    if (!body.ok) return body;
    let out = constant(1);
    for (let i = 0; i < n.it; i += 1) {
      const next = timesFn(out, body.it);
      if (!next.ok) return next;
      out = next.it;
    }
    return good(out);
  }
  // `2^t` and `e^{-3t}` are the same rule: a constant raised to a straight line.
  if (mentions(base, of)) return bad(`Something with ${of} in it raised to a power of ${of} has no transform here.`);
  const k = fixed(base, scope);
  if (!k.ok) return k;
  if (k.it <= 0) return bad('Only a positive number can be raised to a power of t here.');
  const line = straight(power, of, scope);
  if (!line.ok) return line;
  return good({ terms: [term(k.it ** line.it.k, 0, line.it.m * Math.log(k.it))], impulses: [] });
}

/** `u(t - 2)` and `δ(t - 2)`: the argument a shift and a kick both want. */
function shiftPoint(args: Node[], of: string, scope: Scope, what: string): Got<number> {
  if (args.length !== 1) return bad(`${what} takes one thing in its brackets.`);
  const line = straight(args[0], of, scope);
  if (!line.ok) return line;
  if (Math.abs(line.it.m - 1) > TINY) return bad(`${what} is written about t itself — u(t - 2), not u(2t).`);
  const at = -line.it.k;
  if (at < -TINY) return bad(`${what} before t = 0 is already on, so it changes nothing.`);
  return good(Math.max(0, at));
}

function readCall(name: string, args: Node[], of: string, scope: Scope): Got<Fn> {
  const STEP = new Set(['u', 'step', 'heaviside']);
  const KICK = new Set(['δ', 'delta', 'dirac', 'impulse']);
  if (STEP.has(name)) {
    const at = shiftPoint(args, of, scope, 'A step');
    return at.ok ? good({ terms: [term(1, 0, 0, 0, 'cos', at.it)], impulses: [] }) : at;
  }
  if (KICK.has(name)) {
    const at = shiftPoint(args, of, scope, 'An impulse');
    return at.ok ? good({ terms: [], impulses: [{ c: 1, at: at.it }] }) : at;
  }
  if (args.length !== 1) return bad(`${name} takes one thing in its brackets here.`);
  const line = straight(args[0], of, scope);
  if (!line.ok) return line;
  const { m, k } = line.it;
  switch (name) {
    case 'exp':
      return good({ terms: [term(Math.exp(k), 0, m)], impulses: [] });
    case 'sin':
      // `\sin(mt + k)` is a wave with a phase, and a phase is a cos and a sin.
      return good({
        terms: [wavesOf(Math.cos(k), m, 'sin'), wavesOf(Math.sin(k), m, 'cos')],
        impulses: [],
      });
    case 'cos':
      return good({
        terms: [wavesOf(Math.cos(k), m, 'cos'), wavesOf(-Math.sin(k), m, 'sin')],
        impulses: [],
      });
    case 'sinh':
      return good({
        terms: [term(Math.exp(k) / 2, 0, m), term(-Math.exp(-k) / 2, 0, -m)],
        impulses: [],
      });
    case 'cosh':
      return good({
        terms: [term(Math.exp(k) / 2, 0, m), term(Math.exp(-k) / 2, 0, -m)],
        impulses: [],
      });
    default:
      return bad(`${name}(${of}) is outside the family this transforms — powers, exponentials, sines and steps.`);
  }
}

function wavesOf(c: number, b: number, kind: 'cos' | 'sin'): Term {
  const w = wave(c, b, kind);
  return term(w.c, 0, 0, w.b, w.wave);
}

// ── Forwards: a function of t, as a function of s ────────────────────────

/** The quadratic (or linear) factor a term's denominator is a power of. */
function baseOf(p: Term): { key: string; poly: Poly; power: number } {
  if (Math.abs(p.b) < TINY) {
    return { key: `r${round(p.a)}`, poly: [-p.a, 1], power: p.n + 1 };
  }
  return { key: `c${round(p.a)}:${round(Math.abs(p.b))}`, poly: [p.a * p.a + p.b * p.b, -2 * p.a, 1], power: p.n + 1 };
}

/**
 * The numerator one term contributes, over its own denominator.
 *
 * With `D = (s − a − ib)^{n+1}`, the transform of `t^n e^{at}\cos(bt)` is
 * `n!·Re(D)` over `D·D̄`, and of the sine `−n!·Im(D)` over the same — one
 * formula covering every n, every damping and every frequency, rather than a
 * table with a row for each. `D·D̄` is `((s−a)² + b²)^{n+1}`, which is real,
 * which is why the answer is.
 */
function numeratorOf(p: Term): Poly {
  const scale = p.c * factorial(p.n);
  if (Math.abs(p.b) < TINY) return p.wave === 'cos' ? [scale] : [0];
  const d = qPow([cx(-p.a, -p.b), cx(1)], p.n + 1);
  return d.map((z) => (p.wave === 'cos' ? scale * z.re : -scale * z.im));
}

/**
 * The transform of a function of t.
 *
 * One fraction per delay, over the lowest denominator that holds every term of
 * it — the product of the distinct factors at the highest power any term
 * needs. Not the product of all of them, which would put `s^6` under an answer
 * whose denominator is `s^2`.
 */
export function forward(fn: Fn): Transform {
  const out: Transform = [];
  const groups = new Map<number, Term[]>();
  for (const p of tidy(fn).terms) {
    const key = round(p.delay);
    const had = groups.get(key);
    if (had) had.push(p);
    else groups.set(key, [p]);
  }
  for (const [delay, terms] of groups) {
    const bases = new Map<string, { poly: Poly; power: number }>();
    for (const p of terms) {
      const base = baseOf(p);
      const had = bases.get(base.key);
      if (!had || had.power < base.power) bases.set(base.key, { poly: base.poly, power: base.power });
    }
    let den: Poly = [1];
    for (const b of bases.values()) den = pMul(den, pPow(b.poly, b.power));
    let num: Poly = [0];
    for (const p of terms) {
      const base = baseOf(p);
      const held = bases.get(base.key);
      let over: Poly = [1];
      for (const [key, b] of bases) {
        over = pMul(over, pPow(b.poly, key === base.key ? (held?.power ?? 0) - base.power : b.power));
      }
      num = pAdd(num, pMul(numeratorOf(p), over));
    }
    out.push({
      delay,
      num: pTrim(num),
      den: pTrim(den),
      factors: [...bases.values()].map((b) => ({ poly: b.poly, power: b.power })),
    });
  }
  for (const kick of fn.impulses) out.push({ delay: kick.at, num: [kick.c], den: [1] });
  return out;
}

/** What somebody typed, transformed — the whole of one direction. */
export function transform(node: Node, of = 't', scope: Scope = {}): Got<Transform> {
  const fn = readFn(node, of, scope);
  return fn.ok ? good(forward(fn.it)) : fn;
}

// ── Reading a function of s out of what somebody typed ───────────────────

const piece = (num: Poly, den: Poly = [1], delay = 0): Piece => ({ delay, num, den });

function timesPiece(a: Piece, b: Piece): Piece {
  return { delay: a.delay + b.delay, num: pMul(a.num, b.num), den: pMul(a.den, b.den) };
}

/** Every piece over one denominator — what dividing by a sum needs. */
function asOne(rat: Transform): Got<Piece> {
  if (rat.some((p) => p.delay > TINY)) return bad('Dividing by a delayed transform is not something this reads.');
  let out = piece([0]);
  for (const p of rat) out = { delay: 0, num: pAdd(pMul(out.num, p.den), pMul(p.num, out.den)), den: pMul(out.den, p.den) };
  return good(out);
}

/**
 * What somebody typed, read as a function of s.
 *
 * A rational function, times an `e^{-cs}` where there is one. Nothing else has
 * an inverse in the family, and a fraction is what comes out of the other
 * direction, so this is the shape that closes the loop.
 */
export function readRat(node: Node, of = 's', scope: Scope = {}): Got<Transform> {
  if (!mentions(node, of)) {
    const got = fixed(node, scope);
    return got.ok ? good([piece([got.it])]) : got;
  }
  switch (node.kind) {
    case 'name':
      return good([piece([0, 1])]);
    case 'neg': {
      const body = readRat(node.body, of, scope);
      return body.ok ? good(body.it.map((p) => ({ ...p, num: pScale(p.num, -1) }))) : body;
    }
    case 'call':
    case 'apply': {
      if (node.kind === 'apply') {
        const plain = opened(node, scope);
        if (plain) return readRat(plain, of, scope);
      }
      if (node.name !== 'exp' || node.args.length !== 1) {
        return bad(`${node.name}(${of}) has no inverse in the family this reads.`);
      }
      return delayOf(node.args[0], of, scope);
    }
    case 'op': {
      if (node.op === '+' || node.op === '-') {
        const left = readRat(node.left, of, scope);
        if (!left.ok) return left;
        const right = readRat(node.right, of, scope);
        if (!right.ok) return right;
        const other = node.op === '-' ? right.it.map((p) => ({ ...p, num: pScale(p.num, -1) })) : right.it;
        return good([...left.it, ...other]);
      }
      if (node.op === '*') {
        const left = readRat(node.left, of, scope);
        if (!left.ok) return left;
        const right = readRat(node.right, of, scope);
        if (!right.ok) return right;
        const out: Transform = [];
        for (const p of left.it) for (const q of right.it) out.push(timesPiece(p, q));
        return good(out);
      }
      if (node.op === '/') {
        const left = readRat(node.left, of, scope);
        if (!left.ok) return left;
        const right = readRat(node.right, of, scope);
        if (!right.ok) return right;
        const by = asOne(right.it);
        if (!by.ok) return by;
        if (pTrim(by.it.num).length === 1 && Math.abs(by.it.num[0]) < TINY) return bad('That divides by zero.');
        return good(left.it.map((p) => timesPiece(p, { delay: 0, num: by.it.den, den: by.it.num })));
      }
      return ratPower(node.left, node.right, of, scope);
    }
    default:
      return bad('This is not a transform this reads.');
  }
}

function ratPower(base: Node, power: Node, of: string, scope: Scope): Got<Transform> {
  if (mentions(power, of)) {
    if (mentions(base, of)) return bad(`A power of ${of} raised to a power of ${of} is not read here.`);
    const k = fixed(base, scope);
    if (!k.ok) return k;
    if (Math.abs(k.it - Math.E) > 1e-9) return bad('Only e may be raised to a power of s — that is the delay.');
    return delayOf(power, of, scope);
  }
  const n = fixed(power, scope);
  if (!n.ok) return n;
  if (!Number.isInteger(n.it) || Math.abs(n.it) > 12) return bad('A power of s here is a whole number of times, at most 12.');
  const body = readRat(base, of, scope);
  if (!body.ok) return body;
  const one = asOne(body.it);
  if (!one.ok) return one;
  const times = Math.abs(n.it);
  const up = n.it >= 0 ? one.it : { delay: 0, num: one.it.den, den: one.it.num };
  return good([{ delay: 0, num: pPow(up.num, times), den: pPow(up.den, times) }]);
}

/** `e^{-2s}` — a delay of two, and a refusal for anything that would grow. */
function delayOf(power: Node, of: string, scope: Scope): Got<Transform> {
  const line = straight(power, of, scope);
  if (!line.ok) return line;
  if (line.it.m > TINY) return bad('A transform cannot grow like e^{2s} — a delay is e^{-2s}.');
  return good([piece([Math.exp(line.it.k)], [1], -line.it.m)]);
}

// ── Backwards: a function of s, as a function of t ───────────────────────

/**
 * The roots of a polynomial, all at once.
 *
 * Durand–Kerner: start the roots spread round a circle and push each one by
 * the polynomial's value there divided by its distance from the others, which
 * converges on all of them together. There is no formula past the quartic, so
 * a numerical method is not a shortcut here — it is the only way.
 */
function roots(den: Poly): Cx[] {
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
function gathered(found: Cx[], den: Poly): { root: Cx; times: number }[] {
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
 */
function back(num: Poly, den: Poly): Got<Fn> {
  const top = pTrim(num);
  const bottom = pTrim(den);
  if (bottom.length === 1) {
    if (Math.abs(bottom[0]) < TINY) return bad('That divides by zero.');
    if (top.length === 1) return good({ terms: [], impulses: [{ c: top[0] / bottom[0], at: 0 }] });
    return bad('A transform that grows with s comes back as the slope of an impulse, which is not a curve.');
  }
  let rest = top;
  const impulses: Impulse[] = [];
  if (top.length >= bottom.length) {
    const split = pDivide(top, bottom);
    if (split.quotient.length > 1) {
      return bad('This one comes back as the slope of an impulse, which is not a curve.');
    }
    if (Math.abs(split.quotient[0]) > 1e-9) impulses.push({ c: split.quotient[0], at: 0 });
    rest = split.remainder;
  }
  if (pTrim(rest).length === 1 && Math.abs(pTrim(rest)[0]) < TINY) return good({ terms: [], impulses });
  const groups = gathered(roots(bottom), bottom);
  const degree = bottom.length - 1;
  const poly: CPoly = bottom.map((v) => cx(v));
  const columns: { root: Cx; power: number; coefficients: CPoly }[] = [];
  for (const g of groups) {
    let left = poly;
    for (let i = 1; i <= g.times; i += 1) {
      left = without(left, g.root);
      columns.push({ root: g.root, power: i, coefficients: left });
    }
  }
  if (columns.length !== degree) return bad('The bottom of this fraction did not come apart.');
  const matrix: Cx[][] = [];
  for (let row = 0; row < degree; row += 1) matrix.push(columns.map((c) => c.coefficients[row] ?? cx(0)));
  const want: Cx[] = [];
  for (let row = 0; row < degree; row += 1) want.push(cx(rest[row] ?? 0));
  const answer = solved(matrix, want);
  if (!answer) return bad('The bottom of this fraction did not come apart.');

  const terms: Term[] = [];
  for (let i = 0; i < columns.length; i += 1) {
    const { root, power } = columns[i];
    const A = answer[i];
    const over = factorial(power - 1);
    if (Math.abs(root.im) < TINY) {
      terms.push(term(A.re / over, power - 1, root.re));
      continue;
    }
    // A conjugate pair is one oscillation, counted once: the two halves add to
    // twice the real part, which is a cosine and a sine of the same frequency.
    if (root.im < 0) continue;
    terms.push(term((2 * A.re) / over, power - 1, root.re, root.im, 'cos'));
    terms.push(term((-2 * A.im) / over, power - 1, root.re, root.im, 'sin'));
  }
  return good(tidy({ terms, impulses }));
}

/** A transform, turned back into the function of t it came from. */
export function inverse(rat: Transform): Got<Fn> {
  let out: Fn = { terms: [], impulses: [] };
  for (const p of rat) {
    const got = back(p.num, p.den);
    if (!got.ok) return got;
    out = plus(out, {
      terms: got.it.terms.map((q) => ({ ...q, delay: q.delay + p.delay })),
      impulses: got.it.impulses.map((k) => ({ ...k, at: k.at + p.delay })),
    });
  }
  return good(tidy(out));
}

// ── The reason for the other two: solving an equation exactly ────────────

/** The same tree with one name replaced — how `y` and `y'` are taken out to leave the forcing. */
function put(node: Node, name: string, to: Node): Node {
  switch (node.kind) {
    case 'name':
      return node.name === name ? to : node;
    case 'list':
      return { kind: 'list', items: node.items.map((i) => put(i, name, to)) };
    case 'range':
      return {
        kind: 'range',
        from: put(node.from, name, to),
        second: node.second ? put(node.second, name, to) : null,
        to: put(node.to, name, to),
      };
    case 'neg':
      return { kind: 'neg', body: put(node.body, name, to) };
    case 'fact':
      return { kind: 'fact', body: put(node.body, name, to) };
    case 'percent':
      return { kind: 'percent', body: put(node.body, name, to) };
    case 'abs':
      return { kind: 'abs', body: put(node.body, name, to) };
    case 'op':
      return { kind: 'op', op: node.op, left: put(node.left, name, to), right: put(node.right, name, to) };
    case 'call':
      return { kind: 'call', name: node.name, args: node.args.map((a) => put(a, name, to)) };
    case 'apply':
      return {
        kind: 'apply',
        name: node.name,
        args: node.args.map((a) => put(a, name, to)),
        ...(node.power ? { power: put(node.power, name, to) } : {}),
      };
    case 'big':
      return {
        kind: 'big',
        op: node.op,
        index: node.index,
        from: put(node.from, name, to),
        to: put(node.to, name, to),
        body: put(node.body, name, to),
      };
    default:
      return node;
  }
}

const ZERO: Node = { kind: 'num', value: 0 };

/** The right-hand side of `y'' = …` at one place, with the unknown and its rate held. */
function rateAt(body: Node, of: string, scope: Scope, x: number, y: number, v: number): number {
  const got = value(body, { ...scope, vars: { ...scope.vars, [of]: x, y, "y'": v } });
  return Array.isArray(got) ? NaN : got;
}

/**
 * `y'' = a y + b y' + f(t)`, if that is what was written.
 *
 * The coefficients are read off rather than matched against a shape, because
 * the shapes a student writes are endless — `-4y`, `-(y + 3y')/2`,
 * `k^2 y - c y'` — and all of them are the same equation. So the right-hand
 * side is sampled: `a` is what changes when y moves by one, `b` is what
 * changes when the rate does, and `f` is what is left with both at zero. Then
 * the three are put back together and checked against the equation at points
 * nobody used to build them. A logistic equation fails that check, and is told
 * so rather than solved wrongly.
 */
export function linearOde(body: Node, of: string, scope: Scope): Got<{ a: number; b: number; force: Node }> {
  const force = put(put(body, 'y', ZERO), "y'", ZERO);
  const base = (x: number) => rateAt(force, of, scope, x, 0, 0);
  const a = rateAt(body, of, scope, 0, 1, 0) - base(0);
  const b = rateAt(body, of, scope, 0, 0, 1) - base(0);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return bad('This equation does not work out to numbers.');
  const places: [number, number, number][] = [
    [0.37, 1.4, -0.6],
    [1.13, -2.2, 0.9],
    [2.71, 0.5, 1.7],
    [-0.8, 3.1, -1.2],
  ];
  for (const [x, y, v] of places) {
    const want = a * y + b * v + base(x);
    const got = rateAt(body, of, scope, x, y, v);
    if (!Number.isFinite(got) || !Number.isFinite(want)) continue;
    if (Math.abs(got - want) > 1e-7 * (1 + Math.abs(want))) {
      return bad('Laplace wants y and its rate to appear straight, with constants in front of them.');
    }
  }
  return good({ a, b, force });
}

/**
 * The exact solution of a linear equation with constant coefficients.
 *
 * The whole method in six lines, which is the argument for it: transform both
 * sides, and the derivatives become multiplications, so the differential
 * equation becomes an ordinary one. Solve that for `Y`, which is division.
 * Come back, which is the partial fraction above. The initial conditions are
 * not applied at the end — they are in the algebra from the first line, which
 * is the part that makes this quicker than the classical method rather than
 * merely different.
 */
export function solveIvp(opts: {
  order: 1 | 2;
  a: number;
  b: number;
  force: Transform;
  y0: number;
  v0: number;
}): Got<Fn> {
  const { order, a, b, y0, v0 } = opts;
  // `s - a` for the first-order equation, `s² - bs - a` for the second.
  const q: Poly = order === 1 ? [-a, 1] : [-a, -b, 1];
  const start: Poly = order === 1 ? [y0] : [v0 - b * y0, y0];
  const y: Transform = [
    ...opts.force.map((p) => ({ delay: p.delay, num: p.num, den: pMul(p.den, q) })),
    { delay: 0, num: start, den: q },
  ];
  return inverse(y);
}

/** The equation and its conditions, read off the list and solved. Everything joined up. */
export function exactly(opts: {
  body: Node;
  of: string;
  order: 1 | 2;
  y0: number;
  v0: number;
  scope: Scope;
}): Got<Fn> {
  const read = linearOde(opts.body, opts.of, opts.scope);
  if (!read.ok) return read;
  const force = readFn(read.it.force, opts.of, opts.scope);
  if (!force.ok) return force;
  return solveIvp({
    order: opts.order,
    a: read.it.a,
    b: read.it.b,
    force: forward(force.it),
    y0: opts.y0,
    v0: opts.v0,
  });
}

// ── Writing it down ──────────────────────────────────────────────────────

/**
 * A number, at the precision an answer has rather than the precision a float has.
 *
 * Six figures: enough that `0.997494` is not rounded to `1` and somebody can
 * see the damping has moved the frequency, and few enough that a coefficient
 * that ought to be 4 does not print as `3.99999999999999`.
 */
function numberText(v: number): string {
  const near = Number(v.toPrecision(10));
  if (Math.abs(near - Math.round(near)) < 1e-9) return String(Math.round(near));
  return String(Number(v.toPrecision(6)));
}

/** `2t` rather than `1t`, and `-t` rather than `-1t`. */
function frontText(v: number): string {
  if (Math.abs(v - 1) < TINY) return '';
  if (Math.abs(v + 1) < TINY) return '-';
  return numberText(v);
}

function termText(p: Term, of: string): string {
  const inner = p.delay > TINY ? `(${of} - ${numberText(p.delay)})` : of;
  const parts: string[] = [];
  if (p.n === 1) parts.push(inner);
  else if (p.n > 1) parts.push(`${inner}^{${p.n}}`);
  if (Math.abs(p.a) > TINY) parts.push(`e^{${frontText(p.a)}${inner}}`);
  if (Math.abs(p.b) > TINY) parts.push(`\\${p.wave}(${frontText(p.b)}${inner})`);
  const size = Math.abs(p.c);
  const front = parts.length === 0 ? numberText(size) : Math.abs(size - 1) < TINY ? '' : numberText(size);
  const tail = p.delay > TINY ? `\\,u(${of} - ${numberText(p.delay)})` : '';
  return `${front}${parts.join('')}${tail}`;
}

/** A sum written the way a sum is written: minus signs rather than plus-a-negative. */
function joined(pieces: { negative: boolean; text: string }[]): string {
  if (!pieces.length) return '0';
  let out = (pieces[0].negative ? '-' : '') + pieces[0].text;
  for (const piece of pieces.slice(1)) out += `${piece.negative ? ' - ' : ' + '}${piece.text}`;
  return out;
}

/** A function of t, as LaTeX the rest of the app already draws. */
export function latexFn(fn: Fn, of = 't'): string {
  const clean = tidy(fn);
  const pieces = [
    ...clean.impulses.map((k) => ({
      negative: k.c < 0,
      text: `${Math.abs(Math.abs(k.c) - 1) < TINY ? '' : numberText(Math.abs(k.c))}\\delta(${k.at > TINY ? `${of} - ${numberText(k.at)}` : of})`,
    })),
    ...clean.terms.map((p) => ({ negative: p.c < 0, text: termText(p, of) })),
  ];
  return joined(pieces);
}

/** A polynomial, highest power first, which is how one is read. */
export function latexPoly(poly: Poly, of = 's'): string {
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

/** The bottom of a fraction: its factors where they are known, multiplied out where they are not. */
function bottomText(p: Piece, of: string): string {
  const den = pTrim(p.den);
  const factors = p.factors;
  if (!factors || !factors.length) return latexPoly(den, of);
  if (factors.length === 1 && factors[0].power === 1) return latexPoly(factors[0].poly, of);
  return factors
    .map((f) => {
      const text = latexPoly(f.poly, of);
      const wrapped = / [+-] /.test(text) ? `(${text})` : text;
      return f.power === 1 ? wrapped : `${wrapped}^{${f.power}}`;
    })
    .join('');
}

/** A transform, as LaTeX — a fraction per delay, with the delay in front of it. */
export function latexTransform(rat: Transform, of = 's'): string {
  if (!rat.length) return '0';
  const pieces = rat.map((p) => {
    const den = pTrim(p.den);
    const num = latexPoly(pTrim(p.num), of);
    const negative = num.startsWith('-');
    const size = negative ? num.slice(1) : num;
    const flat = den.length === 1 && Math.abs(den[0] - 1) < TINY;
    const body = flat ? size : `\\frac{${size}}{${bottomText(p, of)}}`;
    if (p.delay <= TINY) return { negative, text: body };
    const wrapped = flat && / [+-] /.test(size) ? `(${size})` : body;
    return { negative, text: `e^{-${numberText(p.delay)}${of}}${wrapped}` };
  });
  return joined(pieces);
}
