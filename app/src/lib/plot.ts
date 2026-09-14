/**
 * Drawing what the calculator works out.
 *
 * A graph is the one thing a phone can do that a printed textbook cannot, and
 * it is how a demand curve, a normal distribution and a discounted cash flow
 * stop being three formulas and start being three shapes. `lib/calc.ts` reads
 * the notation and works it out at a number; this turns that into a line, and
 * then into the handful of facts somebody actually wants off a graph — where
 * it crosses zero, where it turns, where two curves meet, and what the area
 * under it comes to.
 *
 * Everything here is pure: numbers in, numbers out, no DOM and no clock, so it
 * can be tested properly. `components/Plot.tsx` draws it and handles the
 * dragging; `components/Grapher.tsx` is the list of expressions beside it.
 *
 * ## What a line of the list can be
 *
 * The same box takes all of them, because a student writing `y = 2x + 3` and a
 * student writing `m = 2` are doing the same thing and should not have to
 * choose a kind first:
 *
 *   `y = 2x + 3`            a curve
 *   `2x + 3`                the same curve, since a bare expression is a y
 *   `x = 4`                 a vertical line
 *   `x^2 + y^2 = 25`        a relation, drawn wherever it holds
 *   `f(x) = x^2 - 4`        a definition, usable by every line below it
 *   `a = 2`                 a parameter, with a slider
 *   `(2, 3)`               a point
 *
 * ## The two heuristics, said out loud
 *
 * Sampling a function and joining the dots is honest until the function has a
 * pole in it: `1/x` sampled either side of zero joins +∞ to −∞ with a vertical
 * line that looks like part of the curve and is not. So a jump larger than the
 * window, across a change of sign, breaks the line rather than drawing it —
 * which is what a textbook does too.
 *
 * A relation has no such sampling. `x^2 + y^2 = 25` is not a function of x at
 * all, so it is drawn by marching squares: evaluate `left − right` over a
 * grid, and draw the boundary where it changes sign. That is why a relation's
 * line is a little coarser than a function's, and why it is worth saying so
 * here rather than having somebody wonder.
 */

import { free, read, value, type Node, type Scope, type Val } from './calc';
import {
  at as beatAt,
  atZ,
  inverse as unZed,
  latexSeq,
  latexZed,
  poleText as zPoleText,
  poles as zPoles,
  readZed,
  transform as zTransform,
} from './discrete';
import {
  HARMONICS,
  dft,
  latexSeries as latexHarmonics,
  loudest,
  samplesOf,
  seriesOf,
  sizeOf,
  harmonicsOf,
  latexSpectrum,
  partial,
  sampler,
  sizeAt,
  spectrumOf,
} from './fourier';
import {
  at as timeAt,
  atS,
  inverse,
  latexFn,
  latexTransform,
  poleText,
  poles,
  readFn,
  readRat,
  transform,
} from './laplace';

export interface Point {
  x: number;
  y: number;
}

/** What is being looked at, in the graph's own units. */
export interface Frame {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Ten by ten, which is where every graphing calculator ever made opens. */
export const HOME: Frame = { x0: -10, x1: 10, y0: -10, y1: 10 };

export type Line =
  | { kind: 'blank' }
  | { kind: 'fault'; says: string }
  /** `a = 2` — a number with a name, and a slider if it is a plain one. */
  | { kind: 'value'; name: string; body: Node }
  /** `f(x) = x^2` — usable by every other line. */
  | { kind: 'fun'; name: string; params: string[]; body: Node }
  /** `y = …` and `x = …`, and the bare expression that means the first. */
  | { kind: 'curve'; of: 'y' | 'x'; body: Node }
  /** `x^2 + y^2 = 25`, held as `left − right` and drawn where it is zero. */
  | { kind: 'relation'; body: Node }
  /**
   * `r = 2 + 2\cos(\theta)` — a distance from the origin at each angle.
   *
   * Only where the right-hand side actually mentions θ. `r = 5` stays what it
   * has always been here, a parameter with a slider, because that is what the
   * circle example uses it for and silently turning somebody's slider into a
   * curve would be the worse surprise of the two.
   */
  | { kind: 'polar'; body: Node }
  /** `(\cos(t), \sin(t))` — a point that moves, drawn as the path it takes. */
  | { kind: 'parametric'; x: Node; y: Node }
  /**
   * `z = x^2 - y^2` — a height over every point of the floor.
   *
   * Not a curve and not drawn as one: the picture of it has a camera in it,
   * and the whole of that lives in `lib/surface.ts`. It is read here because
   * one list takes every kind of thing somebody writes, whatever draws it.
   */
  | { kind: 'surface'; body: Node }
  /**
   * `(y, -x)` — a vector at every point of the window.
   *
   * The same brackets as a point and as a parametric curve, told apart by the
   * same rule: the letters in it. `t` makes it a path, `x` or `y` makes it a
   * field — which is the picture a phase diagram and a flow are — and neither
   * makes it the fixed point it looks like.
   */
  | { kind: 'field'; x: Node; y: Node }
  /**
   * `y' = x + y` — how fast y changes at every point, rather than what it is.
   *
   * Drawn as the slope field and the solutions through it. Solved by walking,
   * never symbolically: see `lib/ode.ts`.
   */
  | { kind: 'ode'; body: Node; of: 'x' | 'y'; order: 1 | 2 }
  /**
   * `y(0) = 1` — where a solution is known to pass, which picks one out of the
   * family. `y'(0) = 0` is the same thing for the rate, which is the second
   * condition a second-order equation needs.
   */
  | { kind: 'start'; of: 'x' | 'y'; rate: boolean; at: Node; value: Node }
  /**
   * `L{t^2}` — the Laplace transform of what is in the brackets.
   *
   * Read against s rather than x, and drawn there: the pole of `\frac{1}{s-2}`
   * is a thing to see, and a transform nobody can look at is a table entry
   * rather than a picture. See `lib/laplace.ts`.
   */
  | { kind: 'transform'; body: Node }
  /** `L^{-1}{1/(s^2 + 4)}` — the way back, read and drawn against t. */
  | { kind: 'inverse'; body: Node }
  /**
   * `conv(t, e^{-t})` — one function convolved with another.
   *
   * A function of t like any other and drawn like one; it is its own kind
   * because `conv` is not arithmetic `lib/calc.ts` can do at a point, and a
   * line that read as a curve would draw nothing and say nothing.
   */
  | { kind: 'convolution'; body: Node }
  /**
   * `H = \frac{1}{s^2 + 0.3s + 1}` — a system, written as what it does.
   *
   * Told from a parameter called H by the same rule that tells `r = 5` from a
   * polar curve: what is in it. An `H =` with an s on the right is a transfer
   * function; without one it is the letter H with a value, and a slider.
   */
  | { kind: 'transfer'; body: Node }
  /**
   * `F{e^{-2t}}` — the Fourier transform, read and drawn against ω.
   *
   * Drawn as its size, because the transform is complex and a complex function
   * is two curves or a lie. The reading says which. See `lib/fourier.ts`.
   */
  | { kind: 'spectrum'; body: Node }
  /**
   * `fourier(f(t), 2\pi)` — a repeating thing as the waves it is made of.
   *
   * The period is the second argument because a series has no meaning without
   * one, and the count of harmonics is the third because the picture of a
   * series forming is the reason to draw it at all.
   */
  | { kind: 'harmonics'; body: Node; period: Node; count: Node | null }
  /**
   * `Z{0.5^n}` — the z-transform, read and drawn against z.
   *
   * Laplace for a thing that happens on the beat rather than continuously: a
   * balance each month, a reading each second. See `lib/discrete.ts`.
   */
  | { kind: 'ztransform'; body: Node }
  /**
   * `Z^{-1}{z/(z - 0.5)}` — the sequence behind a transform.
   *
   * Drawn as points on the integers with a stem to each, because that is what
   * a sequence is: joining them with a line would draw a value at n = 1.5,
   * which is not a thing that exists.
   */
  | { kind: 'sequence'; body: Node }
  /**
   * `dft([1, 0, -1, 0])` — the frequencies a run of numbers is made of.
   *
   * The one transform on this list that runs on data rather than on a formula,
   * which is what somebody actually has. Drawn as the size of each bin against
   * its number, in stems, because a spectrum of data is a set of readings and
   * not a curve.
   */
  | { kind: 'bins'; body: Node; count: Node | null }
  | { kind: 'point'; x: Node; y: Node };

/** The letter a polar curve turns through, and the one a parametric curve runs on. */
export const ANGLE = 'θ';
export const TIME = 't';
/** What a transform is a function of — the other axis `L{}` and `L^{-1}{}` share. */
export const FREQUENCY = 's';
/** What a Fourier transform is a function of — the other frequency, and a different axis. */
export const OMEGA = 'ω';
/** What a z-transform is a function of, and the letter its sequences are counted in. */
export const ZED = 'z';
export const BEAT = 'n';

/**
 * How far round θ and t go, in half-turns.
 *
 * A circle closes in one turn and a five-petalled rose needs one; a spiral and
 * a Lissajous figure need several, and sampling further than the curve goes
 * costs detail everywhere else. Two turns is the default because it draws both
 * `\sin(\theta)`'s two-lobed rose and `\sin(2\theta)`'s four-petalled one
 * completely, and the screen offers the rest.
 */
export const TURNS: readonly number[] = [1, 2, 4, 6, 12];

// ── Reading a line of the list ───────────────────────────────────────────

const INEQUALITY = /(<=|>=|≤|≥|≠|<|>|\\le\b|\\ge\b|\\neq?\b|\\lt\b|\\gt\b)/;

/**
 * `y'`, `dy/dx` and `\frac{dy}{dx}` on the left of an `=`: a rate, not a product.
 *
 * Read off the text rather than through the expression parser, because none of
 * the three is an expression: an apostrophe is not an operator, and `dy/dx`
 * through the parser is d times y over d times x, which is 1 and is not what
 * anybody wrote.
 */
const RATE =
  /^\s*(?:([xy])\s*('{1,2})|d(\^?2\s*)?([xy])\s*\/\s*d\s*[xt](\^?2)?|\\frac\s*\{\s*d(?:\^?2)?\s*([xy])\s*\}\s*\{\s*d\s*[xt](?:\^?2)?\s*\})\s*$/;

/** `y(0)`, and `y'(0)` for the rate: where a solution is known to pass. */
const START = /^\s*([xy])\s*('?)\s*\(([^()]*)\)\s*$/;

/**
 * `L{f(t)}` and `L^{-1}{F(s)}`, in the four ways somebody writes them.
 *
 * Off the text, like `RATE` above and for the same reason: `L{t^2}` through
 * the expression parser is a letter beside a group, which is a multiplication,
 * and the braces of `\mathcal{L}\{…\}` are LaTeX's rather than the
 * expression's. The `^{-1}` is the only thing separating the two directions,
 * so it is what the first group catches.
 */
const LAPLACE =
  /^\s*(?:\\mathcal\s*\{\s*L\s*\}|L|laplace)\s*(\^\s*\{?\s*-\s*1\s*\}?)?\s*\\?\{([\s\S]*?)\\?\}\s*$/;

/** `F{f(t)}` — the Fourier transform, in the ways somebody writes it. */
const FOURIER = /^\s*(?:\\mathcal\s*\{\s*F\s*\}|F)\s*\\?\{([\s\S]*?)\\?\}\s*$/;

/** `Z{x[n]}` and `Z^{-1}{X(z)}` — the z-transform, the same shape as the Laplace pair. */
const ZEDDED =
  /^\s*(?:\\mathcal\s*\{\s*Z\s*\}|Z|ztransform)\s*(\^\s*\{?\s*-\s*1\s*\}?)?\s*\\?\{([\s\S]*?)\\?\}\s*$/;

/** `fourier(f, T)` and `fourier(f, T, n)`: a Fourier series, told by its name and its arguments. */
const HARMONIC = new Set(['fourier', 'harmonics']);

/** `dft([…])` and `fft(x[n], N)`: the transform of a run of numbers. */
const BINNED = new Set(['dft', 'fft']);

/** `conv(f, g)` at the start of a line: a convolution, which is a function of t. */
const CONVOLVE = /^\s*(?:conv|convolve|convolution)\s*\(/;

/** `H` and `H(s)` on the left of an `=`: a transfer function, where there is an s on the right. */
const TRANSFER = /^\s*H\s*(?:\(\s*s\s*\))?\s*$/;

/** `f(x)` and `g(x, y)` on the left of an `=`: a definition, not a product. */
const DEFINES = /^\s*([A-Za-z][A-Za-z0-9]*)\s*\(\s*([A-Za-z][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z][A-Za-z0-9_]*)*)\s*\)\s*$/;

/**
 * `(2, 3)` — a point, and `([1, 2, 3], [4, 5, 6])`, which is a scatter.
 *
 * Split on the comma that is not inside anything, for the same reason `equals`
 * counts depth: a pair of lists has commas of its own, and a plot of somebody's
 * data is the thing most worth being able to type.
 */
function pointParts(text: string): [string, string] | null {
  if (!text.startsWith('(') || !text.endsWith(')')) return null;
  const inner = text.slice(1, -1);
  let depth = 0;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if ('([{'.includes(ch)) depth += 1;
    else if (')]}'.includes(ch)) depth -= 1;
    else if (ch === ',' && depth === 0) {
      const left = inner.slice(0, i).trim();
      const right = inner.slice(i + 1).trim();
      return left && right ? [left, right] : null;
    }
    if (depth < 0) return null;
  }
  return null;
}

/**
 * Where the `=` is, if there is exactly one that is not inside anything.
 *
 * Brackets and braces are counted so that the `i=1` inside `\sum_{i=1}^{n}` is
 * left where it belongs — it is the sum's own counter, not a relation.
 */
function equals(source: string): number {
  let depth = 0;
  let at = -1;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if ('([{'.includes(ch)) depth += 1;
    else if (')]}'.includes(ch)) depth -= 1;
    else if (ch === '=' && depth === 0) {
      if (at >= 0) return -2;
      at = i;
    }
  }
  return at;
}

/**
 * What is on the right of a formula's `=`, which is the part there is to work out.
 *
 * `E_d = \frac{…}{…}` handed to the calculator whole would ask for a value for
 * `E_d` — the very thing being worked out — so what goes in the box is what
 * follows the sign. A formula with no `=` in it is already the answer's side.
 */
export function rightOf(source: string): string {
  const at = equals(source);
  return at >= 0 ? source.slice(at + 1).trim() : source.trim();
}

function node(source: string): { node: Node } | { says: string } {
  const got = read(source);
  return got.ok ? { node: got.node } : { says: got.fault };
}

/**
 * One line of the expression list, read.
 *
 * Never throws and never guesses: an unfinished expression is a `fault` with a
 * sentence on it, which the list shows beside the line rather than in place of
 * the graph.
 */
export function readLine(source: string): Line {
  const text = source.trim();
  if (!text) return { kind: 'blank' };
  if (INEQUALITY.test(text)) {
    return { kind: 'fault', says: 'Inequalities are not drawn yet — write it with an = and read the line it gives.' };
  }

  const laplace = LAPLACE.exec(text);
  if (laplace) {
    const inner = node(laplace[2]);
    if ('says' in inner) return { kind: 'fault', says: inner.says };
    return laplace[1] ? { kind: 'inverse', body: inner.node } : { kind: 'transform', body: inner.node };
  }

  const zedded = ZEDDED.exec(text);
  if (zedded) {
    const inner = node(zedded[2]);
    if ('says' in inner) return { kind: 'fault', says: inner.says };
    return zedded[1] ? { kind: 'sequence', body: inner.node } : { kind: 'ztransform', body: inner.node };
  }

  const fourier = FOURIER.exec(text);
  if (fourier) {
    const inner = node(fourier[1]);
    if ('says' in inner) return { kind: 'fault', says: inner.says };
    return { kind: 'spectrum', body: inner.node };
  }

  const point = pointParts(text);
  if (point) {
    const x = node(point[0]);
    const y = node(point[1]);
    if ('says' in x) return { kind: 'fault', says: x.says };
    if ('says' in y) return { kind: 'fault', says: y.says };
    /*
     * Three things wear these brackets, and the letters inside decide which.
     *
     * `t` is a path — a point that moves. `x` or `y` is a field — a vector at
     * every point of the window, which is the picture a phase diagram and a
     * flow are. Neither is a fixed point, which is what is left.
     *
     * `t` wins where both appear: a path drawn at each point of a field is not
     * a picture of anything, and the moving point is what was written.
     */
    const letters = [...free(x.node), ...free(y.node)];
    if (letters.includes(TIME)) return { kind: 'parametric', x: x.node, y: y.node };
    if (letters.includes('x') || letters.includes('y')) return { kind: 'field', x: x.node, y: y.node };
    return { kind: 'point', x: x.node, y: y.node };
  }

  const at = equals(text);
  if (at === -2) return { kind: 'fault', says: 'Two = signs in one line. Write one relation per line.' };

  if (at < 0) {
    const got = node(text);
    if ('says' in got) return { kind: 'fault', says: got.says };
    if (CONVOLVE.test(text)) return { kind: 'convolution', body: got.node };
    const call = got.node;
    if ((call.kind === 'apply' || call.kind === 'call') && BINNED.has(call.name)) {
      if (call.args.length < 1 || call.args.length > 2) {
        return { kind: 'fault', says: 'A discrete transform wants the data: dft([1, 0, -1, 0]), or a formula and how many samples.' };
      }
      return { kind: 'bins', body: call.args[0], count: call.args[1] ?? null };
    }
    if ((call.kind === 'apply' || call.kind === 'call') && HARMONIC.has(call.name)) {
      if (call.args.length < 2 || call.args.length > 3) {
        return { kind: 'fault', says: 'A Fourier series wants the function and its period: fourier(f(t), 2\\pi).' };
      }
      return { kind: 'harmonics', body: call.args[0], period: call.args[1], count: call.args[2] ?? null };
    }
    return { kind: 'curve', of: 'y', body: got.node };
  }

  const left = text.slice(0, at).trim();
  const right = text.slice(at + 1).trim();
  if (!left || !right) return { kind: 'fault', says: 'An = wants something on both sides of it.' };

  const defines = DEFINES.exec(left);
  const rhs = node(right);
  if ('says' in rhs) return { kind: 'fault', says: rhs.says };

  // Before `DEFINES`, which would otherwise read `H(s) = …` as a function
  // called H of one parameter — true, and not the reading anybody wants.
  if (TRANSFER.test(left) && free(rhs.node).includes(FREQUENCY)) {
    return { kind: 'transfer', body: rhs.node };
  }

  const rate = RATE.exec(left);
  if (rate) {
    const of = (rate[1] ?? rate[4] ?? rate[6] ?? 'y') as 'x' | 'y';
    // `y''` and `d^2y/dx^2` are second order; everything else here is first.
    const order = rate[2] === "''" || rate[3] !== undefined || rate[5] !== undefined || /\^?2/.test(left) ? 2 : 1;
    return { kind: 'ode', body: rhs.node, of, order: order === 2 ? 2 : 1 };
  }

  const start = START.exec(left);
  if (start) {
    const at = node(start[3]);
    if ('says' in at) return { kind: 'fault', says: at.says };
    return {
      kind: 'start',
      of: start[1] as 'x' | 'y',
      rate: start[2] === "'",
      at: at.node,
      value: rhs.node,
    };
  }

  if (defines) {
    return {
      kind: 'fun',
      name: defines[1],
      params: defines[2].split(',').map((p) => p.trim()),
      body: rhs.node,
    };
  }

  const lhs = node(left);
  if ('says' in lhs) return { kind: 'fault', says: lhs.says };

  if (lhs.node.kind === 'name') {
    const name = lhs.node.name;
    if (name === 'y' || name === 'x') return { kind: 'curve', of: name, body: rhs.node };
    if (name === 'z') return { kind: 'surface', body: rhs.node };
    if (name === 'r' && free(rhs.node).includes(ANGLE)) return { kind: 'polar', body: rhs.node };
    return { kind: 'value', name, body: rhs.node };
  }

  return { kind: 'relation', body: { kind: 'op', op: '-', left: lhs.node, right: rhs.node } };
}

/**
 * Every definition in the list, as one scope.
 *
 * Two passes, so a line may use a parameter defined below it — which is what
 * happens the moment somebody adds a slider under a curve that wants it, and
 * an order-dependent list would make them cut and paste to fix.
 */
export function scopeOf(lines: Line[], degrees = false): Scope {
  const funs: Record<string, { params: string[]; body: Node }> = {};
  for (const line of lines) {
    if (line.kind === 'fun') funs[line.name] = { params: line.params, body: line.body };
  }
  const vars: Record<string, Val> = {};
  for (let pass = 0; pass < 2; pass += 1) {
    for (const line of lines) {
      if (line.kind !== 'value') continue;
      const got = value(line.body, { vars, funs, degrees });
      if (Array.isArray(got) || Number.isFinite(got)) vars[line.name] = got;
    }
  }
  return { vars, funs, degrees };
}

/** What a line still needs before it can be drawn — what the list says in red. */
export function missing(line: Line, scope: Scope): string[] {
  // The letters the drawing itself supplies: x and y across the window, θ round
  // the turn, t along the run. Reporting those as unset would ask somebody to
  // give a value to the very thing being varied.
  const has = (name: string) => name === 'x' || name === 'y' || name === ANGLE || name === TIME;
  /*
   * A step and an impulse look like unset letters and are not.
   *
   * `u(t - 2)` is `u` beside a bracket to everything that reads the notation,
   * which is the right reading everywhere else — `lib/laplace.ts` is the one
   * place that knows better. Reporting `u` as a letter with no value would ask
   * somebody to give the step function a number.
   */
  const table = (name: string) =>
    ['u', 'step', 'heaviside', 'δ', 'delta', 'dirac', 'impulse', 'conv', 'convolve', 'convolution'].includes(name);
  switch (line.kind) {
    case 'transform':
      return free(line.body, scope).filter((n) => n !== TIME && !table(n));
    case 'inverse':
    case 'transfer':
      return free(line.body, scope).filter((n) => n !== FREQUENCY && !table(n));
    case 'convolution':
    case 'spectrum':
      return free(line.body, scope).filter((n) => n !== TIME && !table(n));
    case 'ztransform':
      return free(line.body, scope).filter((n) => n !== BEAT && !table(n));
    case 'sequence':
      return free(line.body, scope).filter((n) => n !== ZED && !table(n));
    case 'bins':
      return [...free(line.body, scope), ...(line.count ? free(line.count, scope) : [])].filter(
        (n) => n !== BEAT && !table(n),
      );
    case 'harmonics':
      return [
        ...free(line.body, scope).filter((n) => n !== TIME),
        ...free(line.period, scope),
        ...(line.count ? free(line.count, scope) : []),
      ].filter((n) => !table(n));
    case 'curve':
      return free(line.body, scope).filter((n) => !has(n));
    case 'relation':
      return free(line.body, scope).filter((n) => !has(n));
    case 'polar':
    case 'surface':
      return free(line.body, scope).filter((n) => !has(n));
    case 'ode':
      /*
       * A second-order equation supplies its own rate.
       *
       * `y'' = -y - 0.15y'` has `y'` in it as an ordinary quantity and the
       * walk binds it at every step — so asking somebody to give it a value
       * would be asking them to fill in the thing being solved for. A
       * first-order equation supplies no such thing, and a `y'` on its
       * right-hand side there is a genuine mistake worth reporting.
       */
      return free(line.body, scope).filter((n) => !has(n) && !(line.order === 2 && n === "y'"));
    case 'start':
      return [...free(line.at, scope), ...free(line.value, scope)].filter((n) => !has(n));
    case 'parametric':
    case 'field':
    case 'point':
      return [...free(line.x, scope), ...free(line.y, scope)].filter((n) => !has(n));
    case 'value':
      return free(line.body, scope);
    case 'fun':
      return free(line.body, scope, line.params);
    default:
      return [];
  }
}

/**
 * What a transform line comes to: the answer, and the function to draw it by.
 *
 * One place rather than two, because the sentence under the line and the curve
 * beside it are the same piece of arithmetic and a picture that disagreed with
 * the reading over it would be the worst of the three outcomes.
 */
export function answered(
  line: Line,
  scope: Scope,
):
  | { lead: string; latex: string; over: string; at: (v: number) => number; note?: string; upto?: number }
  | { says: string }
  | null {
  const shown = (fn: Parameters<typeof timeAt>[0], lead: string, note?: string) => ({
    lead,
    latex: latexFn(fn, TIME),
    over: TIME,
    at: (t: number) => timeAt(fn, t),
    note: note ?? (fn.impulses.length ? 'The impulse in it is not drawn — an impulse has no height to draw.' : undefined),
  });
  if (line.kind === 'transform') {
    const got = transform(line.body, TIME, scope);
    if (!got.ok) return { says: got.fault };
    return {
      lead: 'It comes to',
      latex: latexTransform(got.it, FREQUENCY),
      over: FREQUENCY,
      at: (s: number) => atS(got.it, s),
      note: poleText(poles(got.it)),
    };
  }
  if (line.kind === 'inverse') {
    const rat = readRat(line.body, FREQUENCY, scope);
    if (!rat.ok) return { says: rat.fault };
    const got = inverse(rat.it);
    if (!got.ok) return { says: got.fault };
    return shown(got.it, 'It comes to');
  }
  if (line.kind === 'convolution') {
    const got = readFn(line.body, TIME, scope);
    if (!got.ok) return { says: got.fault };
    return shown(got.it, 'It comes to');
  }
  if (line.kind === 'spectrum') {
    const got = spectrumOf(line.body, TIME, scope);
    if (!got.ok) return { says: got.fault };
    const { rat, even } = got.it;
    return {
      lead: 'Its spectrum is',
      latex: latexSpectrum(rat, even),
      over: OMEGA,
      at: (w: number) => sizeAt(rat, w, even),
      note: 'A transform is complex, so what is drawn is its size.',
    };
  }
  if (line.kind === 'harmonics') {
    const number = (node: Node) => {
      const got = value(node, scope);
      return Array.isArray(got) ? (got[0] ?? NaN) : got;
    };
    const period = number(line.period);
    if (!Number.isFinite(period) || period <= 0) return { says: 'A Fourier series wants a period bigger than nothing.' };
    const asked = line.count ? number(line.count) : HARMONICS;
    const count = Math.max(1, Math.min(200, Math.round(Number.isFinite(asked) ? asked : HARMONICS)));
    const made = harmonicsOf(sampler(line.body, TIME, scope), period, count);
    return {
      lead: `${count} harmonics of it, over ${neat(-period / 2, period)} to ${neat(period / 2, period)}:`,
      latex: latexHarmonics(made, TIME),
      over: TIME,
      at: (t: number) => partial(made, t),
      /*
       * The one thing about a series that catches everybody.
       *
       * `fourier(t, 2\pi)` draws a sawtooth, and the function under it is a
       * straight line: a series represents the *repeat* of what is on the
       * interval, not the formula beyond it. The picture shows that plainly
       * once both are on it, and the sentence says it so nobody has to work
       * out which of the two lines is the answer.
       */
      note: 'The function is faint under it. Outside that interval a series repeats, which is what makes it a series.',
    };
  }
  if (line.kind === 'bins') {
    const xs = samplesOf(line.body, line.count, scope);
    if (!xs.ok) return { says: xs.fault };
    const bins = dft(xs.it);
    const top = loudest(xs.it);
    const many = xs.it.length;
    return {
      lead: `${many} samples, as the waves in them:`,
      // A transform of N samples has N bins and no more. It repeats after
      // that, and drawing the repeat would offer a reading of data nobody gave.
      upto: many - 1,
      latex: latexHarmonics(seriesOf(xs.it), BEAT),
      over: 'k',
      at: (k: number) => sizeOf(bins[((Math.round(k) % many) + many) % many]),
      note: top
        ? `Biggest at k = ${top.k}, which is ${top.k} ${top.k === 1 ? 'cycle' : 'cycles'} across the ${many}. Drawn as the size of each bin, which is the same either side of ${many / 2} because the data is real.`
        : 'Every bin but the average is empty: this run does not go up and down at all.',
    };
  }
  if (line.kind === 'ztransform') {
    const got = zTransform(line.body, BEAT, scope);
    if (!got.ok) return { says: got.fault };
    return {
      lead: 'It comes to',
      latex: latexZed(got.it, ZED),
      over: ZED,
      at: (z: number) => atZ(got.it, z),
      note: zPoleText(zPoles(got.it)),
    };
  }
  if (line.kind === 'sequence') {
    const zed = readZed(line.body, ZED, scope);
    if (!zed.ok) return { says: zed.fault };
    const got = unZed(zed.it);
    if (!got.ok) return { says: got.fault };
    const seq = got.it;
    return {
      lead: 'The sequence behind it is',
      latex: latexSeq(seq, BEAT),
      over: BEAT,
      at: (n: number) => beatAt(seq, n),
      note: 'Drawn as the beats it is, rather than joined into a curve it is not.',
    };
  }
  if (line.kind === 'transfer') {
    const rat = readRat(line.body, FREQUENCY, scope);
    if (!rat.ok) return { says: rat.fault };
    const got = inverse(rat.it);
    if (!got.ok) return { says: got.fault };
    // The impulse response, because it is `H` itself read the other way. The
    // poles are what the sentence is for: they say how the thing behaves
    // without anybody having to read the curve.
    return shown(got.it, 'Kicked once, it does', poleText(poles(rat.it)));
  }
  return null;
}

// ── Turning it into lines on a page ──────────────────────────────────────

const flat = (v: Val): number[] => (Array.isArray(v) ? v : [v]);

/** What is drawn for one line of the list: polylines, and loose points. */
export interface Drawn {
  paths: Point[][];
  points: Point[];
  /** A field's arrows, where the line is one. See `lib/fields.ts`. */
  arrows?: Arrow[];
  /**
   * How strongly to draw each path, where they are not all equal.
   *
   * Contour lines want this and nothing else does: twelve levels of one
   * function in one colour are unreadable unless the line says which level it
   * is. Absent means every path is drawn at full strength.
   */
  shades?: number[];
}

/** One arrow of a field: where it starts, where it points, and the two barbs. */
export interface Arrow {
  from: Point;
  to: Point;
  /** The two barb ends; the head is drawn as barb → tip → barb. */
  head: [Point, Point];
  /** How long this one is against the longest, 0 to 1 — what the ink says. */
  strength: number;
}

const EMPTY: Drawn = { paths: [], points: [] };

/**
 * A function sampled across a range, broken where it jumps.
 *
 * The break is the whole of the difficulty. `tan x` and `1/x` run to infinity
 * and come back on the other side, and a sampler that joins every pair of
 * neighbours draws a vertical line through the asymptote that a student will
 * read as part of the curve. So a step larger than the window, across a change
 * of sign, ends the line and starts another — the same thing a textbook does,
 * and the reason the gaps in `tan x` look right here.
 *
 * A list-valued function — `y = a x` with `a = [1, 2, 3]` — comes back as one
 * path per member, which is how a family of curves is drawn from one line.
 */
export function series(
  at: (t: number) => Val,
  from: number,
  to: number,
  steps: number,
  window: number,
): Point[][] {
  const rows: { t: number; vs: number[] }[] = [];
  let widest = 0;
  for (let i = 0; i <= steps; i += 1) {
    const t = from + ((to - from) * i) / steps;
    const vs = flat(at(t));
    widest = Math.max(widest, vs.length);
    rows.push({ t, vs });
  }
  const limit = window * 4;
  const out: Point[][] = [];
  for (let b = 0; b < widest; b += 1) {
    let run: Point[] = [];
    let last: number | null = null;
    for (const { t, vs } of rows) {
      const v = vs[b];
      const usable = v !== undefined && Number.isFinite(v);
      const jumped = usable && last !== null && Math.abs(v - last) > limit && Math.sign(v) !== Math.sign(last);
      if (!usable || jumped) {
        if (run.length > 1) out.push(run);
        run = [];
        last = null;
        if (!usable) continue;
      }
      run.push({ x: t, y: v });
      last = v;
    }
    if (run.length > 1) out.push(run);
  }
  return out;
}

/**
 * The boundary of a relation, by marching squares.
 *
 * `x^2 + y^2 = 25` is not a function of x — for most x there are two ys and
 * for some there are none — so nothing can be sampled along. Instead
 * `left − right` is evaluated over a grid and the line is drawn where it
 * changes sign, interpolated along the edge of each cell so the circle comes
 * out round rather than stepped.
 *
 * Coarser than a sampled function, necessarily: the detail it can show is the
 * size of a cell. `cells` is what buys that detail, and it costs its square in
 * evaluations, which is why the screen uses a number it can redraw while a
 * finger is moving.
 */
export function contour(at: (x: number, y: number) => number, frame: Frame, cells: number): Point[][] {
  const w = (frame.x1 - frame.x0) / cells;
  const h = (frame.y1 - frame.y0) / cells;
  const grid: number[][] = [];
  for (let i = 0; i <= cells; i += 1) {
    const row: number[] = [];
    for (let j = 0; j <= cells; j += 1) row.push(at(frame.x0 + i * w, frame.y0 + j * h));
    grid.push(row);
  }

  const out: Point[][] = [];
  const cross = (a: number, b: number, lo: number, span: number): number =>
    lo + span * (Math.abs(a) / (Math.abs(a) + Math.abs(b) || 1));

  for (let i = 0; i < cells; i += 1) {
    for (let j = 0; j < cells; j += 1) {
      const x = frame.x0 + i * w;
      const y = frame.y0 + j * h;
      const corners = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]];
      if (corners.some((c) => !Number.isFinite(c))) continue;
      const edges: Point[] = [];
      // Bottom, right, top, left — each edge that changes sign carries one
      // point, and a cell with two of them carries the segment between.
      if (Math.sign(corners[0]) !== Math.sign(corners[1])) {
        edges.push({ x: cross(corners[0], corners[1], x, w), y });
      }
      if (Math.sign(corners[1]) !== Math.sign(corners[2])) {
        edges.push({ x: x + w, y: cross(corners[1], corners[2], y, h) });
      }
      if (Math.sign(corners[3]) !== Math.sign(corners[2])) {
        edges.push({ x: cross(corners[3], corners[2], x, w), y: y + h });
      }
      if (Math.sign(corners[0]) !== Math.sign(corners[3])) {
        edges.push({ x, y: cross(corners[0], corners[3], y, h) });
      }
      // Two crossings is a segment. Four is a saddle, drawn as the two
      // segments that join adjacent edges, which is the reading that keeps a
      // curve continuous at a crossing point.
      if (edges.length === 2) out.push(edges);
      else if (edges.length === 4) {
        out.push([edges[0], edges[1]]);
        out.push([edges[2], edges[3]]);
      }
    }
  }
  return out;
}

/**
 * A curve walked along its own parameter rather than across the window.
 *
 * What polar and parametric have in common, and what makes them different from
 * everything else here: nothing about the window decides where the pen goes.
 * A cardioid comes back to where it started and a Lissajous figure crosses
 * itself, so there is no "for each x" to sample over — there is a run of the
 * parameter, and the curve is wherever that run puts it.
 *
 * Two consequences worth stating. The whole run is drawn whether or not it is
 * on screen, so zooming out finds the rest of a spiral rather than redrawing
 * it. And the line breaks only where a value is not a number — an asymptote in
 * `r = 1/\theta` — because a big step between two samples is how a fast curve
 * looks, not how a discontinuity looks.
 *
 * Lists pair up, so `(\cos(t), a\sin(t))` with `a = [1, 2, 3]` is three
 * ellipses, the same way a list draws a family anywhere else.
 */
export function along(
  at: (t: number) => { xs: number[]; ys: number[] },
  from: number,
  to: number,
  steps: number,
): Point[][] {
  const rows: { xs: number[]; ys: number[] }[] = [];
  let widest = 0;
  for (let i = 0; i <= steps; i += 1) {
    const got = at(from + ((to - from) * i) / steps);
    widest = Math.max(widest, got.xs.length, got.ys.length);
    rows.push(got);
  }
  const out: Point[][] = [];
  for (let b = 0; b < widest; b += 1) {
    let run: Point[] = [];
    for (const { xs, ys } of rows) {
      const x = xs[b] ?? xs[0];
      const y = ys[b] ?? ys[0];
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        if (run.length > 1) out.push(run);
        run = [];
        continue;
      }
      run.push({ x, y });
    }
    if (run.length > 1) out.push(run);
  }
  return out;
}

/**
 * How many points across the window a curve is sampled at, a relation's grid,
 * and the steps along a turn.
 *
 * `turns` is in half-turns of π, and `steps` is per turn: a cardioid at 360
 * points a turn has a point every degree, which is smooth at any zoom the
 * window is likely to be at and cheap enough to redraw while a finger moves.
 */
export interface Detail {
  /** Points across the window, for a function of x. */
  columns: number;
  /** The grid a relation's boundary is found on. */
  cells: number;
  /** Points per turn, for a polar or parametric curve. */
  steps: number;
  /** How far θ and t run, in half-turns of π. */
  turns: number;
}

export const DETAIL: Detail = { columns: 480, cells: 90, steps: 360, turns: 2 };

/** One line of the list, as what a plot draws for it. */
export function draw(line: Line, scope: Scope, frame: Frame, detail: Detail = DETAIL): Drawn {
  switch (line.kind) {
    case 'curve': {
      const over = line.of === 'y' ? 'x' : 'y';
      const from = line.of === 'y' ? frame.x0 : frame.y0;
      const to = line.of === 'y' ? frame.x1 : frame.y1;
      const window = line.of === 'y' ? frame.y1 - frame.y0 : frame.x1 - frame.x0;
      const at = (t: number) => value(line.body, { ...scope, vars: { ...scope.vars, [over]: t } });
      const paths = series(at, from, to, detail.columns, window);
      return {
        paths: line.of === 'y' ? paths : paths.map((p) => p.map((q) => ({ x: q.y, y: q.x }))),
        points: [],
      };
    }
    case 'relation': {
      const at = (x: number, y: number) => {
        const got = value(line.body, { ...scope, vars: { ...scope.vars, x, y } });
        return Array.isArray(got) ? (got[0] ?? NaN) : got;
      };
      return { paths: contour(at, frame, detail.cells), points: [] };
    }
    case 'polar': {
      const turns = detail.turns * Math.PI;
      const at = (angle: number) => {
        const rs = flat(value(line.body, { ...scope, vars: { ...scope.vars, [ANGLE]: angle } }));
        // A negative r is not a mistake and not an absence: it is the point on
        // the opposite ray, which is what makes `r = \cos(2\theta)`'s missing
        // petals appear rather than the curve simply stopping.
        return {
          xs: rs.map((r) => r * Math.cos(angle)),
          ys: rs.map((r) => r * Math.sin(angle)),
        };
      };
      return { paths: along(at, 0, turns, Math.round(detail.steps * detail.turns)), points: [] };
    }
    case 'parametric': {
      const turns = detail.turns * Math.PI;
      const at = (t: number) => {
        const vars = { ...scope.vars, [TIME]: t };
        return { xs: flat(value(line.x, { ...scope, vars })), ys: flat(value(line.y, { ...scope, vars })) };
      };
      return { paths: along(at, 0, turns, Math.round(detail.steps * detail.turns)), points: [] };
    }
    case 'harmonics': {
      const got = answered(line, scope);
      if (!got || 'says' in got) return EMPTY;
      const window = frame.y1 - frame.y0;
      // The function faint and the sum full, in one drawing: a series is only
      // interesting beside the thing it is approximating, and two lines in two
      // colours would say they were two unrelated curves.
      const under = series(sampler(line.body, TIME, scope), frame.x0, frame.x1, detail.columns, window);
      const over = series(got.at, frame.x0, frame.x1, detail.columns, window);
      return {
        paths: [...under, ...over],
        points: [],
        // Half strength rather than the contour map's third: this one is a
        // reference to read the sum against, not a level competing with eleven
        // others, and at a third it disappeared into the grid on a phone.
        shades: [...under.map(() => 0.5), ...over.map(() => 1)],
      };
    }
    case 'bins':
    case 'sequence': {
      const got = answered(line, scope);
      if (!got || 'says' in got) return EMPTY;
      /*
       * A sequence is points, and a stem to each of them.
       *
       * The stems are what make a row of dots readable as values rather than
       * as a scatter, and they are the picture every signals textbook draws.
       * They are paths because a path is what the plot knows how to draw; each
       * is two points and no more.
       */
      const points: Point[] = [];
      const paths: Point[][] = [];
      const last = Math.min(Math.floor(frame.x1), got.upto ?? Infinity);
      for (let n = Math.max(0, Math.ceil(frame.x0)); n <= last && points.length < 400; n += 1) {
        const y = got.at(n);
        if (!Number.isFinite(y)) continue;
        points.push({ x: n, y });
        paths.push([
          { x: n, y: 0 },
          { x: n, y },
        ]);
      }
      return { paths, points };
    }
    case 'transform':
    case 'inverse':
    case 'convolution':
    case 'spectrum':
    case 'ztransform':
    case 'transfer': {
      const got = answered(line, scope);
      if (!got || 'says' in got) return EMPTY;
      const window = frame.y1 - frame.y0;
      return { paths: series(got.at, frame.x0, frame.x1, detail.columns, window), points: [] };
    }
    case 'point': {
      const xs = flat(value(line.x, scope));
      const ys = flat(value(line.y, scope));
      const count = Math.max(xs.length, ys.length);
      const points: Point[] = [];
      for (let i = 0; i < count; i += 1) {
        const x = xs[i] ?? xs[0];
        const y = ys[i] ?? ys[0];
        if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
      }
      return { paths: [], points };
    }
    default:
      return EMPTY;
  }
}

/** A line as a function of x, where it is one — what the readings below need. */
export function asFunction(line: Line, scope: Scope): ((x: number) => number) | null {
  if (line.kind !== 'curve' || line.of !== 'y') return null;
  return (x: number) => {
    const got = value(line.body, { ...scope, vars: { ...scope.vars, x } });
    return Array.isArray(got) ? (got[0] ?? NaN) : got;
  };
}

// ── The readings somebody actually wants off a graph ─────────────────────

export interface Feature {
  kind: 'zero' | 'peak' | 'dip';
  x: number;
  y: number;
}

/** Where a sign change sits, to the width of a pixel and then some. */
function bisect(f: (x: number) => number, lo: number, hi: number): number {
  let a = lo;
  let b = hi;
  let fa = f(a);
  for (let i = 0; i < 60; i += 1) {
    const mid = (a + b) / 2;
    const fm = f(mid);
    if (fm === 0 || !Number.isFinite(fm)) return mid;
    if (Math.sign(fm) === Math.sign(fa)) {
      a = mid;
      fa = fm;
    } else b = mid;
  }
  return (a + b) / 2;
}

/**
 * The zeros and the turning points, across the window.
 *
 * A zero is a change of sign refined by bisection, which is exact to the
 * arithmetic and cannot miss one that the sampling saw. A turning point is a
 * sample higher (or lower) than both its neighbours, refined by walking in
 * from either side — deliberately not by differentiating, since the whole
 * point is that it works for a function nobody has a derivative for.
 *
 * What it cannot do is find what it never sampled: a zero between two samples
 * that does not change the sign — a double root, `(x-2)^2` — is not here.
 * Saying so is better than an approximation that finds it sometimes.
 */
export function features(f: (x: number) => number, frame: Frame, steps = 600): Feature[] {
  const out: Feature[] = [];
  const width = frame.x1 - frame.x0;
  const at = (i: number) => frame.x0 + (width * i) / steps;
  let prev = f(at(0));
  for (let i = 1; i <= steps; i += 1) {
    const x = at(i);
    const v = f(x);
    if (Number.isFinite(prev) && Number.isFinite(v) && Math.sign(prev) !== Math.sign(v) && prev !== 0) {
      // A pole changes sign too, and is not a zero: the values either side of
      // it are enormous rather than small, which is how they are told apart.
      const jump = Math.abs(v - prev);
      if (jump < (frame.y1 - frame.y0) * 2) {
        const root = bisect(f, at(i - 1), x);
        out.push({ kind: 'zero', x: root, y: 0 });
      }
    }
    prev = v;
  }

  for (let i = 1; i < steps; i += 1) {
    const [a, b, c] = [f(at(i - 1)), f(at(i)), f(at(i + 1))];
    if (![a, b, c].every(Number.isFinite)) continue;
    if (b > a && b > c) out.push(turn(f, at(i - 1), at(i + 1), true));
    else if (b < a && b < c) out.push(turn(f, at(i - 1), at(i + 1), false));
  }
  return out;
}

/** A turning point, closed in on by thirds — no derivative needed. */
function turn(f: (x: number) => number, lo: number, hi: number, up: boolean): Feature {
  let a = lo;
  let b = hi;
  for (let i = 0; i < 60; i += 1) {
    const m1 = a + (b - a) / 3;
    const m2 = b - (b - a) / 3;
    const better = up ? f(m1) < f(m2) : f(m1) > f(m2);
    if (better) a = m1;
    else b = m2;
  }
  const x = (a + b) / 2;
  return { kind: up ? 'peak' : 'dip', x, y: f(x) };
}

/** Where two curves cross, which is every supply-and-demand question ever set. */
export function meet(
  f: (x: number) => number,
  g: (x: number) => number,
  frame: Frame,
  steps = 600,
): Point[] {
  const diff = (x: number) => f(x) - g(x);
  return features(diff, frame, steps)
    .filter((s) => s.kind === 'zero')
    .map((s) => ({ x: s.x, y: f(s.x) }));
}

/**
 * The area under a curve between two values, by Simpson's rule.
 *
 * Consumer surplus, total revenue, a probability under a density — the three
 * places an economics or statistics course asks for an integral, and all three
 * are smooth enough that Simpson over a thousand strips is correct to more
 * figures than anybody reports. Signed, because the area under the axis is a
 * negative contribution and pretending otherwise would give the wrong surplus.
 */
export function area(f: (x: number) => number, from: number, to: number, strips = 1000): number {
  const n = strips % 2 === 0 ? strips : strips + 1;
  const h = (to - from) / n;
  if (!Number.isFinite(h) || h === 0) return 0;
  let total = f(from) + f(to);
  for (let i = 1; i < n; i += 1) {
    const v = f(from + i * h);
    if (!Number.isFinite(v)) return NaN;
    total += v * (i % 2 === 0 ? 2 : 4);
  }
  return (total * h) / 3;
}

/** The slope at a point, by a symmetric difference — the tangent a trace shows. */
export function slopeAt(f: (x: number) => number, x: number): number {
  const h = Math.max(Math.abs(x), 1) * 1e-6;
  return (f(x + h) - f(x - h)) / (2 * h);
}

/**
 * A number as a graph should report it.
 *
 * Two faults, both of them in the first version of this screen. `sin x` was
 * said to cross zero at `-1.44560289665e-20`, which is zero — it is the
 * bisection's last halving, and printing it makes the app look as though it
 * cannot count. And `π` was reported as `-9.42477796077`, twelve figures of a
 * number that was read off a curve a few hundred pixels wide, which is nine
 * figures of false precision.
 *
 * So: anything smaller than a millionth of the window is zero, and everything
 * else is six significant figures. `lib/calc.ts` keeps its twelve — an
 * arithmetic answer is exact and should be shown as it is — and this is the
 * measurement, which is not.
 */
export function neat(v: number, span: number): number {
  if (!Number.isFinite(v)) return v;
  const grain = Math.abs(span) / 1e6;
  if (Math.abs(v) < grain) return 0;
  return Number(v.toPrecision(6));
}

/** The sampled point nearest a place on the page — what a trace lands on. */
export function nearest(paths: Point[][], to: Point, scale: Point): Point | null {
  let best: Point | null = null;
  let far = Infinity;
  for (const path of paths) {
    for (const p of path) {
      const dx = (p.x - to.x) / scale.x;
      const dy = (p.y - to.y) / scale.y;
      const d = dx * dx + dy * dy;
      if (d < far) {
        far = d;
        best = p;
      }
    }
  }
  return best;
}

// ── The window itself ────────────────────────────────────────────────────

/** The gap between gridlines: 1, 2 or 5 times a power of ten, and never zero. */
export function step(span: number, target: number): number {
  if (!Number.isFinite(span) || span <= 0) return 1;
  const rough = span / Math.max(1, target);
  const power = 10 ** Math.floor(Math.log10(rough));
  const scaled = rough / power;
  const nice = scaled >= 5 ? 5 : scaled >= 2 ? 2 : 1;
  return nice * power;
}

/** Every gridline between two values, at that gap. */
export function ticks(min: number, max: number, target: number): number[] {
  const gap = step(max - min, target);
  const out: number[] = [];
  const first = Math.ceil(min / gap);
  const count = Math.floor(max / gap) - first;
  /*
   * A window dragged a long way from the origin at a tight zoom asks for more
   * lines than there are pixels — and at 1e16 gridlines apart, `i += 1` does
   * not change `i` at all, so the loop never ends and the tab goes with it.
   * Both are the same cap: past four hundred there is nothing to draw anyway.
   */
  if (!Number.isFinite(count) || count < 0 || count > 400) return out;
  for (let i = 0; i <= count; i += 1) out.push(Number(((first + i) * gap).toPrecision(12)));
  return out;
}

/** A gridline's label, at the precision its own gap deserves and no more. */
export function tickText(v: number, gap: number): string {
  if (v === 0) return '0';
  const places = Math.max(0, Math.min(6, -Math.floor(Math.log10(gap))));
  const rounded = Number(v.toFixed(places));
  if (Math.abs(rounded) >= 10_000 || (Math.abs(rounded) < 0.001 && rounded !== 0)) {
    return rounded.toExponential(1).replace('e', 'e');
  }
  return rounded.toString();
}

/** Closer in or further out, about a point — the wheel, the pinch, the buttons. */
export function zoomed(frame: Frame, by: number, about?: Point): Frame {
  const cx = about?.x ?? (frame.x0 + frame.x1) / 2;
  const cy = about?.y ?? (frame.y0 + frame.y1) / 2;
  return {
    x0: cx + (frame.x0 - cx) * by,
    x1: cx + (frame.x1 - cx) * by,
    y0: cy + (frame.y0 - cy) * by,
    y1: cy + (frame.y1 - cy) * by,
  };
}

/** The window moved, in the graph's own units. */
export function panned(frame: Frame, dx: number, dy: number): Frame {
  return { x0: frame.x0 + dx, x1: frame.x1 + dx, y0: frame.y0 + dy, y1: frame.y1 + dy };
}

/**
 * The window stretched to the shape of the box it is drawn in.
 *
 * Without this a circle is an ellipse and a 45° line is not at 45°, because
 * the window is square and the box on a phone is not. The x range is kept —
 * it is the one somebody chose by dragging — and y is grown or shrunk about
 * its own centre to match the pixels.
 */
export function squared(frame: Frame, width: number, height: number): Frame {
  if (!(width > 0) || !(height > 0)) return frame;
  const span = ((frame.x1 - frame.x0) * height) / width;
  const cy = (frame.y0 + frame.y1) / 2;
  return { ...frame, y0: cy - span / 2, y1: cy + span / 2 };
}

/**
 * The window that shows what is actually drawn.
 *
 * The square window is right for a circle and wrong for a normal density: a
 * bell whose peak is 0.4 drawn on a window ten units tall is a flat line along
 * the axis, which is the correct picture of the wrong thing. So the x range is
 * kept — it is the one somebody chose — and y is set from what the curves
 * actually do across it, with a margin so the peak is not on the edge.
 *
 * Returns the frame unchanged when there is nothing drawn, rather than
 * collapsing to a point around no data.
 */
export function fitted(frame: Frame, drawn: Drawn[]): Frame {
  let low = Infinity;
  let high = -Infinity;
  for (const d of drawn) {
    for (const path of [...d.paths, d.points]) {
      for (const p of path) {
        if (p.x < frame.x0 || p.x > frame.x1 || !Number.isFinite(p.y)) continue;
        low = Math.min(low, p.y);
        high = Math.max(high, p.y);
      }
    }
  }
  if (!Number.isFinite(low) || !Number.isFinite(high)) return frame;
  // A flat line has no extent of its own; give it a window rather than a line.
  const span = high - low || Math.max(1, Math.abs(high) * 0.2);
  const margin = span * 0.12;
  return { ...frame, y0: low - margin, y1: high + margin };
}

/** Whether a window has collapsed or run off the end of what a double can hold. */
export function usable(frame: Frame): boolean {
  const w = frame.x1 - frame.x0;
  const h = frame.y1 - frame.y0;
  return Number.isFinite(w) && Number.isFinite(h) && w > 1e-9 && h > 1e-9 && w < 1e12 && h < 1e12;
}

// ── The list, as the app keeps it ────────────────────────────────────────

/**
 * One row of the expression list.
 *
 * Kept in the store rather than in the screen, for the reason the tab itself
 * is kept there: a graph somebody built for Thursday's problem set should
 * still be there on Thursday, and a screen that empties itself when you go and
 * look at the formula you were copying is a screen nobody trusts with the
 * second line.
 */
export interface PlotLine {
  id: string;
  text: string;
  /** Off hides the curve and keeps the line, which is how two answers are compared. */
  on: boolean;
}

/**
 * Somewhere to start, in the subjects these courses are actually about.
 *
 * The blank box is why graphing calculators go unused — knowing that the
 * notation exists is a different skill from knowing what to draw with it — so
 * the tab opens on four things a first-year econ, statistics or methods course
 * asks for in its second week, each of which is also a lesson in what the box
 * takes: a parameter and a slider, a pair of curves that cross, a relation
 * that is not a function, and a family drawn from a list.
 */
export const EXAMPLES: { name: string; says: string; lines: string[] }[] = [
  {
    name: 'Supply and demand',
    says: 'Two lines and the price where they cross.',
    lines: ['y = 20 - 2x', 'y = 2 + x'],
  },
  {
    name: 'A normal curve',
    says: 'The bell, with its mean and spread on sliders.',
    lines: ['\\mu = 0', 's = 1', 'y = \\frac{1}{s\\sqrt{2\\pi}} e^{-\\frac{(x - \\mu)^2}{2s^2}}'],
  },
  {
    name: 'A circle',
    says: 'A relation rather than a function — two ys for most x.',
    lines: ['r = 5', 'x^2 + y^2 = r^2'],
  },
  {
    name: 'A family of curves',
    says: 'One line, drawn once for every value in a list.',
    lines: ['a = [1, 1.5, ..., 4]', 'y = a \\sin(x)'],
  },
  {
    name: 'A rose',
    says: 'A polar curve: how far from the origin, at each angle.',
    lines: ['r = 4\\sin(2\\theta)'],
  },
  {
    name: 'A Lissajous figure',
    says: 'A point that moves — x and y each written in t.',
    lines: ['a = 3', '(5\\sin(a t), 5\\sin(2t))'],
  },
  {
    name: 'A saddle',
    says: 'A surface: a height over every point of the floor, turned with a finger.',
    lines: ['z = x^2 - y^2'],
  },
  {
    name: 'A differential equation',
    says: 'The slope field, and the one solution through a point you name.',
    lines: ["y' = y - x", 'y(0) = 1'],
  },
  {
    name: 'Growth that levels off',
    says: 'The logistic curve: fast while there is room, then flat.',
    lines: ["y' = 0.6 y (1 - y/40)", 'y(0) = 2'],
  },
  {
    name: 'A spring',
    says: 'Second order: a value and a speed, and the swing they make.',
    lines: ["y'' = -y - 0.15 y'", 'y(0) = 4', "y'(0) = 0"],
  },
  {
    name: 'Predator and prey',
    says: 'A system: two quantities driving each other round a loop.',
    lines: ["x' = x - x y", "y' = x y - y", 'x(0) = 1', 'y(0) = 0.5'],
  },
  {
    name: 'A transform',
    says: 'Laplace: a function of t, read as a function of s.',
    lines: ['L{t^2 e^{-t}}'],
  },
  {
    name: 'The way back',
    says: 'The same table read the other way — a fraction in s, as the wave it was.',
    lines: ['L^{-1}{1/(s^2 + 2s + 5)}'],
  },
  {
    name: 'A convolution',
    says: 'Two functions folded together — an awkward integral, done as a product.',
    lines: ['conv(t, e^{-t})'],
  },
  {
    name: 'A system, as what it does',
    says: 'A transfer function: its poles say whether it settles before you look.',
    lines: ['H = \\frac{1}{s^2 + 0.3s + 1}'],
  },
  {
    name: 'A square wave, out of sines',
    says: 'A Fourier series: the harmonics it is made of, drawn over the wave itself.',
    lines: ['fourier(sign(\\sin(t)), 2\\pi)'],
  },
  {
    name: 'A spectrum',
    says: 'A Fourier transform: where a dying wobble keeps its energy.',
    lines: ['F{e^{-0.4t}\\sin(6t)}'],
  },
  {
    name: 'Money each month',
    says: 'A z-transform: Laplace for a thing that happens on the beat.',
    lines: ['Z{0.5^n}'],
  },
  {
    name: 'The sequence behind it',
    says: 'Back from z, drawn as the beats it is rather than a curve it is not.',
    lines: ['Z^{-1}{z/((z - 1)(z - 2))}'],
  },
  {
    name: 'The frequencies in some numbers',
    says: 'A discrete transform: the one that runs on data rather than on a formula.',
    lines: ['dft([1, 0, -1, 0, 1, 0, -1, 0])'],
  },
  {
    name: 'A flow',
    says: 'A field: which way it pushes at every point, and how hard.',
    lines: ['(-y, x)'],
  },
  {
    name: 'Supply, demand and where they move',
    says: 'A phase diagram: prices rise where demand beats supply.',
    lines: ['(20 - 2x - y, x - 2)'],
  },
  {
    name: 'Discounting',
    says: 'What £100 in n years is worth today, as the rate moves.',
    lines: ['r = 0.05', 'y = \\frac{100}{(1 + r)^x}'],
  },
];
