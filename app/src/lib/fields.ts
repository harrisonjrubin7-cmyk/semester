/**
 * Two pictures of a function over the whole window, rather than along a line.
 *
 * `lib/plot.ts` draws things that are somewhere: a curve is a run of points, a
 * relation is a boundary. These two are drawn *everywhere* — at every point of
 * the window there is a height, or a vector — and that changes what the
 * picture is for. A contour map answers "where is it steep, and where is it
 * level"; a field answers "which way does it push, and how hard". Both are
 * read by looking at the whole picture at once, which is why neither is a line
 * on a graph.
 *
 * ## Contours are the flat reading of a surface
 *
 * The same `z = …` line that `lib/surface.ts` draws in three dimensions is
 * drawn here as its level curves — and that is a choice about the *drawing*
 * rather than about the function, so it is a control on the screen and not new
 * notation. A surface is the better picture for the shape of a thing; contours
 * are the better one for reading values off it, which is why a map has them
 * and an artist's impression does not.
 *
 * Each level is marching squares on `f − c`, which `lib/plot.ts` already does
 * for a relation. One implementation, called once per level.
 *
 * ## A field is arrows, and the scaling is the whole problem
 *
 * Drawn at their true lengths, one fast corner makes every other arrow a dot.
 * Drawn all the same length, the picture says nothing about strength. So the
 * length is the magnitude against the largest, taken to a power that flattens
 * the range without erasing it, and the ink carries the rest — a strong arrow
 * is a dark arrow. Neither convention is "correct"; what matters is that it is
 * stated, because somebody reading a phase diagram is reading these lengths.
 */

import { value, type Node, type Scope } from './calc';
import { contour, step, type Arrow, type Drawn, type Frame, type Point } from './plot';

/**
 * The levels a contour map is drawn at.
 *
 * Nice round numbers from the same rule the gridlines use, so a map of a
 * function reaching 97 has lines at 20, 40, 60, 80 rather than at 97/6. Zero
 * is on the list whenever the range crosses it — the level between profit and
 * loss, between above and below the water, is the one people look for.
 */
export function levels(low: number, high: number, want = 8): number[] {
  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) return [];
  const gap = step(high - low, want);
  const out: number[] = [];
  const first = Math.ceil(low / gap);
  const count = Math.floor(high / gap) - first;
  if (!Number.isFinite(count) || count < 0 || count > 200) return [];
  for (let i = 0; i <= count; i += 1) out.push(Number(((first + i) * gap).toPrecision(12)));
  return out;
}

/** How fine each picture is sampled. Squared in both cases, so these are the costs. */
export const DETAIL: { cells: number; across: number } = { cells: 70, across: 15 };

/**
 * A function's level curves, ready to draw, with the level each one is at.
 *
 * The strength runs from faint at the bottom to full at the top, so the
 * picture reads as a landscape rather than as a tangle — and the zero line is
 * drawn at full strength wherever it appears, because it is the one level with
 * a meaning of its own.
 */
export function contours(
  at: (x: number, y: number) => number,
  frame: Frame,
  cuts: number[],
  cells = DETAIL.cells,
): { level: number; paths: Point[][]; shade: number }[] {
  const low = cuts[0] ?? 0;
  const high = cuts[cuts.length - 1] ?? 1;
  const span = high - low || 1;
  return cuts.map((level) => ({
    level,
    paths: contour((x, y) => at(x, y) - level, frame, cells),
    shade: level === 0 ? 1 : 0.35 + 0.5 * ((level - low) / span),
  }));
}

/** A `z = …` line as its contour map, and the levels it was cut at. */
export function asContours(
  body: Node,
  scope: Scope,
  frame: Frame,
  want = 8,
  cells = DETAIL.cells,
): { drawn: Drawn; cuts: number[] } {
  const at = (x: number, y: number) => {
    const got = value(body, { ...scope, vars: { ...scope.vars, x, y } });
    return Array.isArray(got) ? (got[0] ?? NaN) : got;
  };
  // The range is read off a coarser grid than the lines are drawn on: the
  // levels only need to be in the right place, and sampling twice at full
  // detail would double what a drag costs.
  let low = Infinity;
  let high = -Infinity;
  const look = 24;
  for (let i = 0; i <= look; i += 1) {
    for (let j = 0; j <= look; j += 1) {
      const z = at(
        frame.x0 + ((frame.x1 - frame.x0) * i) / look,
        frame.y0 + ((frame.y1 - frame.y0) * j) / look,
      );
      if (!Number.isFinite(z)) continue;
      low = Math.min(low, z);
      high = Math.max(high, z);
    }
  }
  const cuts = levels(low, high, want);
  const drawn = contours(at, frame, cuts, cells);
  return {
    drawn: {
      paths: drawn.flatMap((c) => c.paths),
      points: [],
      shades: drawn.flatMap((c) => c.paths.map(() => c.shade)),
    },
    cuts,
  };
}

/**
 * The arrows of a field over the window.
 *
 * One at each point of a square grid, laid out so the arrows sit in the middle
 * of their cells rather than on the edges — a grid that starts at the corner
 * puts half its arrows outside the picture.
 *
 * A vector with no value anywhere it is sampled is left out rather than drawn
 * as a dot, and a field that is zero everywhere comes back empty rather than
 * as a grid of specks: both are the same rule as everywhere else here, which
 * is that nothing is drawn where there is nothing to draw.
 */
export function arrows(
  at: (x: number, y: number) => { dx: number; dy: number },
  frame: Frame,
  across = DETAIL.across,
): Arrow[] {
  const spanX = frame.x1 - frame.x0;
  const spanY = frame.y1 - frame.y0;
  const cellX = spanX / across;
  const cellY = spanY / across;
  const seen: { x: number; y: number; dx: number; dy: number; size: number }[] = [];
  let biggest = 0;
  for (let i = 0; i < across; i += 1) {
    for (let j = 0; j < across; j += 1) {
      const x = frame.x0 + cellX * (i + 0.5);
      const y = frame.y0 + cellY * (j + 0.5);
      const { dx, dy } = at(x, y);
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) continue;
      // Measured in cells rather than in units: the window is rarely square,
      // and a field measured in units draws a bias nobody wrote into it.
      const size = Math.hypot(dx / cellX, dy / cellY);
      if (size === 0) continue;
      biggest = Math.max(biggest, size);
      seen.push({ x, y, dx, dy, size });
    }
  }
  if (biggest === 0) return [];

  const out: Arrow[] = [];
  for (const v of seen) {
    // The square root flattens the range without erasing it: a field with one
    // fast corner still shows the slow parts, and a uniform field still has
    // uniform arrows.
    const part = Math.min(1, (v.size / biggest) ** 0.5);
    const reach = 0.42 * part;
    // The unit vector in cell space, which is the space the lengths were
    // measured in — taken back to graph units as it is used.
    const ux = v.dx / cellX / v.size;
    const uy = v.dy / cellY / v.size;
    // Centred on the point it was sampled at rather than starting there, so
    // the grid reads as a field of directions and not as a grid of dots with
    // tails growing out of them.
    const half = reach / 2;
    const from = { x: v.x - ux * half * cellX, y: v.y - uy * half * cellY };
    const to = { x: v.x + ux * half * cellX, y: v.y + uy * half * cellY };
    const barb = reach * 0.34;
    const wing = (turn: number): Point => ({
      x: to.x - (ux * Math.cos(turn) - uy * Math.sin(turn)) * barb * cellX,
      y: to.y - (ux * Math.sin(turn) + uy * Math.cos(turn)) * barb * cellY,
    });
    out.push({ from, to, head: [wing(0.42), wing(-0.42)], strength: v.size / biggest });
  }
  return out;
}

/** A field line as what a plot draws for it. */
export function asArrows(
  x: Node,
  y: Node,
  scope: Scope,
  frame: Frame,
  across = DETAIL.across,
): Drawn {
  const at = (px: number, py: number) => {
    const vars = { ...scope.vars, x: px, y: py };
    const dx = value(x, { ...scope, vars });
    const dy = value(y, { ...scope, vars });
    return {
      dx: Array.isArray(dx) ? (dx[0] ?? NaN) : dx,
      dy: Array.isArray(dy) ? (dy[0] ?? NaN) : dy,
    };
  };
  return { paths: [], points: [], arrows: arrows(at, frame, across) };
}
