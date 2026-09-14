/**
 * Solving a differential equation, by walking it.
 *
 * `y' = x + y` says how fast y changes at every point, and nothing about what
 * y *is*. The curve is what you get by starting somewhere and following that
 * instruction — which is a thing a computer does well and a first-year student
 * does badly, not because it is hard but because it is a hundred small
 * arithmetic steps and one of them will be wrong.
 *
 * ## Numerically, and it says so
 *
 * This solves nothing symbolically. `y' = y` has the answer `Ce^x` and nothing
 * here will ever tell you that: the app's line on symbolic algebra — stated in
 * `screens/Equations.tsx` and held to since — is that it is a different
 * program, and one that half-solved would be worse than none. What this does
 * is draw the solution through a point, which is the picture the symbolic
 * answer is usually wanted *for*, and it does it by the method every numerical
 * analysis course opens with.
 *
 * Runge–Kutta, fourth order. Euler's method is one line shorter and wrong in a
 * way that looks right — its error grows with the step, so the curve drifts
 * off the true solution as it goes and the drift is smooth enough to read as
 * the answer. RK4's error falls with the fourth power of the step, so at the
 * step this uses a curve drawn across the window is correct to more figures
 * than the screen can show. Checked against `y' = y`, whose answer everybody
 * knows: `e` to ten places.
 *
 * ## Where it stops, and why that matters
 *
 * `y' = y^2` from y(0) = 1 runs to infinity at x = 1 and has no solution past
 * it. A solver that kept stepping would draw a line shooting up the screen and
 * then, when the arithmetic overflowed, a straight line across it — a picture
 * of something that does not exist. So the walk ends when the value stops
 * being a number or leaves a generous band around the window, and the curve
 * ends there too. A curve that stops is telling you something true.
 */

import { value, type Node, type Scope } from './calc';
import { asArrows } from './fields';
import type { Drawn, Frame, Point } from './plot';

/** How the walk is taken: the smaller the step, the longer it takes and the less it drifts. */
export const STEPS = 900;

/**
 * How far outside the window a curve may go before the walk gives up.
 *
 * Generous rather than tight: a solution that leaves the top of the screen and
 * comes back is ordinary, and clipping it at the edge would break one curve
 * into two that look unrelated.
 */
const STRAY = 40;

/** One step of Runge–Kutta, fourth order. */
function step(f: (x: number, y: number) => number, x: number, y: number, h: number): number {
  const k1 = f(x, y);
  const k2 = f(x + h / 2, y + (h * k1) / 2);
  const k3 = f(x + h / 2, y + (h * k2) / 2);
  const k4 = f(x + h, y + h * k3);
  return y + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
}

/**
 * The solution from one point, walked in one direction until it stops.
 *
 * Stops at the end, or where the arithmetic stops being a number, or where the
 * curve has gone far enough outside the window that it is not coming back —
 * see the note above on why that is a feature.
 */
export function walk(
  f: (x: number, y: number) => number,
  start: Point,
  to: number,
  steps: number,
  band: { low: number; high: number },
): Point[] {
  const h = (to - start.x) / steps;
  if (!Number.isFinite(h) || h === 0) return [];
  const out: Point[] = [start];
  let { x, y } = start;
  for (let i = 0; i < steps; i += 1) {
    const next = step(f, x, y, h);
    if (!Number.isFinite(next)) break;
    x += h;
    y = next;
    out.push({ x, y });
    if (y < band.low || y > band.high) break;
  }
  return out;
}

/**
 * The solution curve through a point, both ways across the window.
 *
 * Backwards as well as forwards, because the point somebody gives is usually
 * where they know the answer rather than where the picture starts — `y(0) = 1`
 * on a window running from −10 says nothing about wanting to see only the
 * right-hand half.
 */
export function through(
  f: (x: number, y: number) => number,
  start: Point,
  frame: Frame,
  steps = STEPS,
): Point[] {
  const height = frame.y1 - frame.y0;
  const band = { low: frame.y0 - height * STRAY, high: frame.y1 + height * STRAY };
  const back = walk(f, start, frame.x0, Math.max(2, Math.round(steps / 2)), band);
  const on = walk(f, start, frame.x1, Math.max(2, Math.round(steps / 2)), band);
  // The backward half is walked from the point outwards, so it arrives
  // reversed; the starting point itself is in both and is dropped from one.
  return [...back.slice(1).reverse(), ...on];
}

/**
 * Where to start when nobody said.
 *
 * A differential equation without an initial condition has a solution through
 * every point, and the picture of that is the family — which is what a
 * textbook draws and what makes the shape of the equation visible. Evenly down
 * the middle of the window, so the curves are spread across it rather than
 * bunched at an edge.
 */
export function spread(frame: Frame, count = 9): Point[] {
  const middle = (frame.x0 + frame.x1) / 2;
  const height = frame.y1 - frame.y0;
  return Array.from({ length: count }, (_, i) => ({
    x: middle,
    y: frame.y0 + (height * (i + 0.5)) / count,
  }));
}

/**
 * The slope field: a short dash at each point, lying the way the solution goes.
 *
 * The picture underneath the curves, and the one that shows what the equation
 * says on its own — every solution is a curve that follows these dashes. Drawn
 * as dashes rather than arrows because an equation of this kind has no
 * direction along it: `y' = y` at a point says the slope, not which way you
 * are travelling.
 */
export function slopes(
  f: (x: number, y: number) => number,
  frame: Frame,
  across = 15,
): Point[][] {
  const cellX = (frame.x1 - frame.x0) / across;
  const cellY = (frame.y1 - frame.y0) / across;
  const out: Point[][] = [];
  for (let i = 0; i < across; i += 1) {
    for (let j = 0; j < across; j += 1) {
      const x = frame.x0 + cellX * (i + 0.5);
      const y = frame.y0 + cellY * (j + 0.5);
      const slope = f(x, y);
      if (!Number.isFinite(slope)) continue;
      // The dash is drawn in cell units so a steep slope stays inside its own
      // cell rather than running across the ones above it.
      const dx = 1;
      const dy = (slope * cellX) / cellY;
      const size = Math.hypot(dx, dy) || 1;
      const reach = 0.38;
      out.push([
        { x: x - ((dx / size) * reach * cellX) / 1, y: y - ((dy / size) * reach * cellY) / 1 },
        { x: x + ((dx / size) * reach * cellX) / 1, y: y + ((dy / size) * reach * cellY) / 1 },
      ]);
    }
  }
  return out;
}

/**
 * Two quantities walked together, which is what both of the harder kinds are.
 *
 * A second-order equation is a pair: `y'' = f(x, y, y')` is `y' = v` and
 * `v' = f`, with x running along. A system is a pair too — `x' = f(x, y)`,
 * `y' = g(x, y)` — with t running along instead. Same arithmetic, same
 * Runge–Kutta, one implementation, so the two cannot drift apart in accuracy
 * or in where they stop.
 */
export function stepPair(
  f: (t: number, a: number, b: number) => number,
  g: (t: number, a: number, b: number) => number,
  t: number,
  a: number,
  b: number,
  h: number,
): { a: number; b: number } {
  const a1 = f(t, a, b);
  const b1 = g(t, a, b);
  const a2 = f(t + h / 2, a + (h * a1) / 2, b + (h * b1) / 2);
  const b2 = g(t + h / 2, a + (h * a1) / 2, b + (h * b1) / 2);
  const a3 = f(t + h / 2, a + (h * a2) / 2, b + (h * b2) / 2);
  const b3 = g(t + h / 2, a + (h * a2) / 2, b + (h * b2) / 2);
  const a4 = f(t + h, a + h * a3, b + h * b3);
  const b4 = g(t + h, a + h * a3, b + h * b3);
  return {
    a: a + (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4),
    b: b + (h / 6) * (b1 + 2 * b2 + 2 * b3 + b4),
  };
}

/**
 * A second-order equation, drawn as y against x.
 *
 * `y'' = -y` is a spring and `y'' = -y - 0.2y'` is a spring in treacle, and
 * both need two conditions to pin down: where it starts and how fast it is
 * going. The rate is carried alongside but not drawn — the picture is still
 * y against x, which is what was asked for.
 */
export function second(
  rate: (x: number, y: number, v: number) => number,
  start: { x: number; y: number; v: number },
  frame: Frame,
  steps = STEPS,
): Point[] {
  const height = frame.y1 - frame.y0;
  const band = { low: frame.y0 - height * STRAY, high: frame.y1 + height * STRAY };
  const each = (to: number): Point[] => {
    const h = (to - start.x) / Math.max(2, Math.round(steps / 2));
    if (!Number.isFinite(h) || h === 0) return [];
    const out: Point[] = [{ x: start.x, y: start.y }];
    let x = start.x;
    let y = start.y;
    let v = start.v;
    for (let i = 0; i < Math.max(2, Math.round(steps / 2)); i += 1) {
      /*
       * The pair written out rather than handed to `stepPair`.
       *
       * The first half of a second-order equation is always `y' = v` — a
       * function that returns its own argument — and saying that in four
       * lines of Runge–Kutta is clearer than passing an identity in.
       */
      const k1y = v;
      const k1v = rate(x, y, v);
      const k2y = v + (h * k1v) / 2;
      const k2v = rate(x + h / 2, y + (h * k1y) / 2, v + (h * k1v) / 2);
      const k3y = v + (h * k2v) / 2;
      const k3v = rate(x + h / 2, y + (h * k2y) / 2, v + (h * k2v) / 2);
      const k4y = v + h * k3v;
      const k4v = rate(x + h, y + h * k3y, v + h * k3v);
      const nextY = y + (h / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
      const nextV = v + (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
      if (!Number.isFinite(nextY) || !Number.isFinite(nextV)) break;
      x += h;
      y = nextY;
      v = nextV;
      out.push({ x, y });
      if (y < band.low || y > band.high) break;
    }
    return out;
  };
  const back = each(frame.x0);
  const on = each(frame.x1);
  return [...back.slice(1).reverse(), ...on];
}

/**
 * A system's trajectory in the plane the two quantities live in.
 *
 * `x' = x - xy`, `y' = xy - y` is predator and prey, and the picture of it is
 * not either quantity against time — it is the loop they make against each
 * other. Time runs along the curve without appearing on either axis, which is
 * exactly what a phase plane is.
 *
 * ## Why the step is chosen by distance rather than by time
 *
 * A fixed step in t crawls where the system is slow and jumps where it is
 * fast, so the same curve is over-sampled at one end and ragged at the other —
 * and a system that is slow somewhere and fast elsewhere is the ordinary case
 * rather than the awkward one. Stepping by roughly a constant distance on the
 * page instead gives an even curve wherever it goes, and it is what makes one
 * setting work for a slow loop and a fast spiral alike.
 */
export function trajectory(
  dx: (x: number, y: number) => number,
  dy: (x: number, y: number) => number,
  start: Point,
  frame: Frame,
  steps = 1400,
): Point[] {
  const width = frame.x1 - frame.x0;
  const height = frame.y1 - frame.y0;
  const band = {
    x0: frame.x0 - width * 2,
    x1: frame.x1 + width * 2,
    y0: frame.y0 - height * 2,
    y1: frame.y1 + height * 2,
  };
  /** A step that moves about this much of the window, whatever the speed is. */
  const share = 1 / 400;
  const each = (way: 1 | -1): Point[] => {
    const out: Point[] = [start];
    let { x, y } = start;
    for (let i = 0; i < steps; i += 1) {
      // The pace in windows per unit of time, which is what makes one setting
      // work for a slow loop and a fast spiral alike.
      const pace = Math.hypot(dx(x, y) / width, dy(x, y) / height);
      // Standing still is an equilibrium, and a trajectory that starts on one
      // stays there: a point rather than a curve, and drawn as nothing.
      if (!Number.isFinite(pace) || pace < 1e-12) break;
      const h = way * Math.min(share / pace, 1e3);
      const next = stepPair((_, a, b) => dx(a, b), (_, a, b) => dy(a, b), 0, x, y, h);
      if (!Number.isFinite(next.a) || !Number.isFinite(next.b)) break;
      x = next.a;
      y = next.b;
      out.push({ x, y });
      if (x < band.x0 || x > band.x1 || y < band.y0 || y > band.y1) break;
      /*
       * A closed loop is drawn once.
       *
       * Without this a predator–prey cycle is drawn over itself for as many
       * steps as it is given: the same picture, at a hundred times the cost,
       * and the walk never reaching anywhere new.
       */
      if (i > 30 && Math.hypot((x - start.x) / width, (y - start.y) / height) < share) break;
    }
    return out;
  };
  return [...each(-1).slice(1).reverse(), ...each(1)];
}

/** The equation as a function of the point it is at. */
export function rateOf(body: Node, scope: Scope): (x: number, y: number) => number {
  return (x: number, y: number) => {
    const got = value(body, { ...scope, vars: { ...scope.vars, x, y } });
    return Array.isArray(got) ? (got[0] ?? NaN) : got;
  };
}

/**
 * A second-order equation as a function of where it is and how fast it is going.
 *
 * `y'` is bound as an ordinary variable, which is why `lib/calc.ts` reads a
 * prime as part of a name: `y'' = -y - 0.2y'` is then just an expression in
 * three letters, and the walk supplies all three.
 */
export function rateOfSecond(body: Node, scope: Scope): (x: number, y: number, v: number) => number {
  return (x: number, y: number, v: number) => {
    const got = value(body, { ...scope, vars: { ...scope.vars, x, y, "y'": v } });
    return Array.isArray(got) ? (got[0] ?? NaN) : got;
  };
}

/**
 * A `y'' = …` line as what the plot draws: the curve, or the family of them.
 *
 * No slope field underneath, unlike the first-order picture — and that is not
 * an omission. A second-order equation does not give a slope at a point: it
 * gives one at a point *and a speed*, so there is nothing to draw on the plane
 * that would be true. Drawing one anyway is the kind of picture that teaches
 * something false.
 */
export function asSecond(
  body: Node,
  starts: { x: number; y: number; v: number }[],
  scope: Scope,
  frame: Frame,
  steps = STEPS,
): Drawn {
  const rate = rateOfSecond(body, scope);
  const from =
    starts.length > 0
      ? starts
      : spread(frame, 7).map((p) => ({ x: p.x, y: p.y, v: 0 }));
  const curves = from.map((start) => second(rate, start, frame, steps)).filter((c) => c.length > 1);
  return {
    paths: curves,
    points: from.map((s) => ({ x: s.x, y: s.y })),
    shades: curves.map(() => 1),
  };
}

/**
 * A system as its phase plane: the field it describes, and the paths through it.
 *
 * The arrows are the same ones a `(f, g)` line draws — one implementation, in
 * `lib/fields.ts` — because a system and a field are the same object seen two
 * ways, and a phase plane with the trajectories drawn over the arrows is the
 * picture a dynamics course is about.
 */
export function asSystem(
  dxBody: Node,
  dyBody: Node,
  starts: Point[],
  scope: Scope,
  frame: Frame,
): Drawn {
  const dx = rateOf(dxBody, scope);
  const dy = rateOf(dyBody, scope);
  const field = asArrows(dxBody, dyBody, scope, frame);
  const from = starts.length > 0 ? starts : corners(frame);
  const paths = from
    .map((start) => trajectory(dx, dy, start, frame))
    .filter((path) => path.length > 1);
  return {
    paths,
    points: starts,
    arrows: field.arrows,
    shades: paths.map(() => 1),
  };
}

/**
 * Where to start a system's trajectories when nobody said.
 *
 * Along the diagonal rather than on a grid: a grid of starts on a system with
 * one loop draws the same loop a dozen times, while a diagonal crosses the
 * families instead of following one.
 */
function corners(frame: Frame, count = 5): Point[] {
  return Array.from({ length: count }, (_, i) => {
    const part = (i + 1) / (count + 1);
    return {
      x: frame.x0 + (frame.x1 - frame.x0) * part,
      y: frame.y0 + (frame.y1 - frame.y0) * part,
    };
  });
}

/**
 * A `y' = …` line as what the plot draws for it: the field, then the curves.
 *
 * The dashes go in faint and the solutions at full strength, through the same
 * `shades` a contour map uses — one mechanism, so the renderer does not learn
 * anything new for this.
 */
export function asOde(
  body: Node,
  starts: Point[],
  scope: Scope,
  frame: Frame,
  steps = STEPS,
): Drawn {
  const f = rateOf(body, scope);
  const field = slopes(f, frame);
  const from = starts.length > 0 ? starts : spread(frame);
  const curves = from.map((start) => through(f, start, frame, steps)).filter((c) => c.length > 1);
  return {
    paths: [...field, ...curves],
    points: starts,
    shades: [...field.map(() => 0.3), ...curves.map(() => 1)],
  };
}
