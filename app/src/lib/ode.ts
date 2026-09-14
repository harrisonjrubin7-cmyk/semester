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

/** The equation as a function of the point it is at. */
export function rateOf(body: Node, scope: Scope): (x: number, y: number) => number {
  return (x: number, y: number) => {
    const got = value(body, { ...scope, vars: { ...scope.vars, x, y } });
    return Array.isArray(got) ? (got[0] ?? NaN) : got;
  };
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
