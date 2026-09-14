/**
 * A surface, seen from somewhere.
 *
 * `z = x^2 - y^2` is not a curve and cannot be drawn as one: at every point of
 * the floor there is a height, and what you want to see is the shape that
 * makes. That is a different picture from everything in `lib/plot.ts` — it has
 * a camera in it — so it is a different file, and this one holds the whole of
 * the third dimension: the grid of heights, the rotation, the projection, and
 * the order the pieces have to be drawn in.
 *
 * ## Why it is drawn rather than rendered
 *
 * No WebGL and no 3D library. A surface plot of a formula is a few hundred
 * quadrilaterals sorted back to front — the painter's algorithm, which is what
 * every plotting package used before graphics cards and what is still exactly
 * right for this. It costs nothing to ship, it draws in SVG like the rest of
 * the app, it prints, and it is legible to a screen reader as a described
 * picture rather than as a canvas nobody can see into.
 *
 * The alternative was three.js — half a megabyte, a GL context on a phone, and
 * a second way of drawing inside an app that already has one.
 *
 * ## The camera
 *
 * Orthographic, because a surface is read for its *shape* and a perspective
 * projection makes the far corner of a symmetric bowl smaller than the near
 * one, which reads as asymmetry in the function. Two angles: the yaw turns it
 * about the vertical, the pitch lifts the eye. That is all the freedom there
 * is, deliberately — a camera that can roll is a camera that gets left upside
 * down.
 *
 * Everything is worked in a unit cube: x and y across the window, z across
 * whatever range the heights actually cover. Without that normalisation a
 * function reaching 10,000 would be a vertical line and a function reaching
 * 0.001 would be a flat sheet, and both would be correct and useless.
 */

import { value, type Node, type Scope, type Val } from './calc';
import type { Frame, Point } from './plot';

/** Where the eye is: two angles, in radians. */
export interface Camera {
  /** Turn about the vertical. */
  yaw: number;
  /** Lift above the horizon. 0 is edge-on, π/2 is straight down. */
  pitch: number;
}

/** Three-quarters from the front, high enough to see the floor. */
export const EYE: Camera = { yaw: -0.65, pitch: 0.52 };

/** How far the eye may be lifted or dropped, so it never goes under the floor. */
export const PITCH = { low: 0.05, high: 1.45 } as const;

export interface Spot {
  x: number;
  y: number;
  z: number;
}

/** A piece of the surface, ready to draw: four corners, how far off, how lit. */
export interface Facet {
  corners: Point[];
  /** Distance from the eye. Larger is further, and is drawn first. */
  depth: number;
  /** 0 to 1, from the angle the piece makes with the light. */
  light: number;
  /** Where it sits between the lowest and highest point, 0 to 1. */
  height: number;
}

/** The heights over the window, with `null` where the function has no value. */
export function heights(
  at: (x: number, y: number) => number,
  frame: Frame,
  steps: number,
): (number | null)[][] {
  const out: (number | null)[][] = [];
  for (let i = 0; i <= steps; i += 1) {
    const row: (number | null)[] = [];
    const x = frame.x0 + ((frame.x1 - frame.x0) * i) / steps;
    for (let j = 0; j <= steps; j += 1) {
      const y = frame.y0 + ((frame.y1 - frame.y0) * j) / steps;
      const z = at(x, y);
      row.push(Number.isFinite(z) ? z : null);
    }
    out.push(row);
  }
  return out;
}

/**
 * The range the heights actually cover, and where the extremes are.
 *
 * What the vertical axis is scaled to, and — since somebody asking for a
 * surface is usually asking where the peak is — the two points worth naming
 * under the picture.
 */
export function range(
  zs: (number | null)[][],
  frame: Frame,
): { low: number; high: number; lowest: Spot | null; highest: Spot | null } {
  let low = Infinity;
  let high = -Infinity;
  let lowest: Spot | null = null;
  let highest: Spot | null = null;
  const steps = zs.length - 1;
  zs.forEach((row, i) => {
    row.forEach((z, j) => {
      if (z === null) return;
      const x = frame.x0 + ((frame.x1 - frame.x0) * i) / steps;
      const y = frame.y0 + ((frame.y1 - frame.y0) * j) / (row.length - 1);
      if (z < low) {
        low = z;
        lowest = { x, y, z };
      }
      if (z > high) {
        high = z;
        highest = { x, y, z };
      }
    });
  });
  if (!Number.isFinite(low) || !Number.isFinite(high)) return { low: 0, high: 0, lowest: null, highest: null };
  return { low, high, lowest, highest };
}

/**
 * A point of the unit cube, on the page.
 *
 * Yaw turns it about the vertical; pitch tilts it towards the eye. The screen
 * runs right and *down*, as SVG does, which is why the up vector comes back
 * negated — and the depth is the distance along the line of sight, so sorting
 * on it is the whole of the hidden-surface problem here.
 */
export function project(p: Spot, eye: Camera): { x: number; y: number; depth: number } {
  const cy = Math.cos(eye.yaw);
  const sy = Math.sin(eye.yaw);
  const X = p.x * cy - p.y * sy;
  const Y = p.x * sy + p.y * cy;
  const cp = Math.cos(eye.pitch);
  const sp = Math.sin(eye.pitch);
  return {
    x: X,
    y: -(Y * sp + p.z * cp),
    depth: Y * cp - p.z * sp,
  };
}

/** Into the unit cube: x and y over the window, z over the range it reaches. */
function cube(frame: Frame, low: number, high: number) {
  const spanZ = high - low || 1;
  return (x: number, y: number, z: number): Spot => ({
    x: ((x - frame.x0) / (frame.x1 - frame.x0)) * 2 - 1,
    y: ((y - frame.y0) / (frame.y1 - frame.y0)) * 2 - 1,
    z: ((z - low) / spanZ) * 2 - 1,
  });
}

/** Where the light comes from. Over the left shoulder, which is where a drawing lights it from. */
const LIGHT = (() => {
  const v = { x: -0.4, y: -0.6, z: 0.7 };
  const size = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / size, y: v.y / size, z: v.z / size };
})();

/**
 * The surface as pieces, furthest first.
 *
 * A piece is skipped where any of its four corners has no height — that is the
 * hole in `z = \sqrt{1 - x^2 - y^2}` outside the unit circle, and drawing
 * across it would invent a surface where the function has none.
 *
 * The order is the whole of the hidden-surface handling: drawn back to front,
 * a near piece covers a far one, which is what makes a bowl look like a bowl
 * rather than like a wireframe somebody can see through. It is exact for a
 * height field — no two pieces can interleave — which is why this is enough
 * here and would not be in general.
 */
export function facets(
  zs: (number | null)[][],
  frame: Frame,
  low: number,
  high: number,
  eye: Camera,
): Facet[] {
  const steps = zs.length - 1;
  const at = cube(frame, low, high);
  const spanZ = high - low || 1;
  const out: Facet[] = [];
  const xAt = (i: number) => frame.x0 + ((frame.x1 - frame.x0) * i) / steps;
  const yAt = (j: number) => frame.y0 + ((frame.y1 - frame.y0) * j) / steps;

  for (let i = 0; i < steps; i += 1) {
    for (let j = 0; j < steps; j += 1) {
      const zA = zs[i][j];
      const zB = zs[i + 1][j];
      const zC = zs[i + 1][j + 1];
      const zD = zs[i][j + 1];
      if (zA === null || zB === null || zC === null || zD === null) continue;
      const world: Spot[] = [
        { x: xAt(i), y: yAt(j), z: zA },
        { x: xAt(i + 1), y: yAt(j), z: zB },
        { x: xAt(i + 1), y: yAt(j + 1), z: zC },
        { x: xAt(i), y: yAt(j + 1), z: zD },
      ];
      const inCube = world.map((w) => at(w.x, w.y, w.z));
      const seen = inCube.map((c) => project(c, eye));
      // The normal from the two diagonals of the piece, in the cube's own
      // units — so the lighting reads the shape as it is drawn rather than as
      // the numbers happen to be scaled.
      const d1 = {
        x: inCube[2].x - inCube[0].x,
        y: inCube[2].y - inCube[0].y,
        z: inCube[2].z - inCube[0].z,
      };
      const d2 = {
        x: inCube[3].x - inCube[1].x,
        y: inCube[3].y - inCube[1].y,
        z: inCube[3].z - inCube[1].z,
      };
      const n = {
        x: d1.y * d2.z - d1.z * d2.y,
        y: d1.z * d2.x - d1.x * d2.z,
        z: d1.x * d2.y - d1.y * d2.x,
      };
      const size = Math.hypot(n.x, n.y, n.z) || 1;
      const lambert = Math.abs((n.x * LIGHT.x + n.y * LIGHT.y + n.z * LIGHT.z) / size);
      const middle = (zA + zB + zC + zD) / 4;
      out.push({
        corners: seen.map((s) => ({ x: s.x, y: s.y })),
        depth: seen.reduce((t, s) => t + s.depth, 0) / seen.length,
        light: 0.3 + 0.7 * lambert,
        height: (middle - low) / spanZ,
      });
    }
  }
  // Furthest first: the painter's order.
  return out.sort((a, b) => b.depth - a.depth);
}

/** The floor of the box, as the four lines that say where the window is. */
export function floor(frame: Frame, low: number, high: number, eye: Camera): { a: Point; b: Point }[] {
  const at = cube(frame, low, high);
  const corners = [
    at(frame.x0, frame.y0, low),
    at(frame.x1, frame.y0, low),
    at(frame.x1, frame.y1, low),
    at(frame.x0, frame.y1, low),
  ].map((c) => project(c, eye));
  const lines: { a: Point; b: Point }[] = [];
  for (let i = 0; i < 4; i += 1) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    lines.push({ a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } });
  }
  // The upright at the near corner, which is the only thing that says how tall
  // the picture is. Without it a flat surface and a deep one look the same.
  const up = project(at(frame.x0, frame.y0, high), eye);
  lines.push({ a: { x: corners[0].x, y: corners[0].y }, b: { x: up.x, y: up.y } });
  return lines;
}

/** The three axes as somewhere to put a letter, at the end of each floor edge. */
export function marks(
  frame: Frame,
  low: number,
  high: number,
  eye: Camera,
): { label: string; at: Point }[] {
  const at = cube(frame, low, high);
  const put = (spot: Spot) => {
    const p = project(spot, eye);
    return { x: p.x, y: p.y };
  };
  return [
    { label: 'x', at: put(at(frame.x1, frame.y0, low)) },
    { label: 'y', at: put(at(frame.x0, frame.y1, low)) },
    { label: 'z', at: put(at(frame.x0, frame.y0, high)) },
  ];
}

/** How fine the mesh is. Squared, so this is the number that costs. */
export const MESH = 34;

/** A surface's height at a point, from the tree the list holds. */
export function heightOf(body: Node, scope: Scope): (x: number, y: number) => number {
  return (x: number, y: number) => {
    const got: Val = value(body, { ...scope, vars: { ...scope.vars, x, y } });
    return Array.isArray(got) ? (got[0] ?? NaN) : got;
  };
}

/** The eye turned by a drag, kept the right way up. */
export function turned(eye: Camera, byYaw: number, byPitch: number): Camera {
  return {
    yaw: eye.yaw + byYaw,
    pitch: Math.min(PITCH.high, Math.max(PITCH.low, eye.pitch + byPitch)),
  };
}
