/**
 * The Semester mark: three metal slabs, as data rather than markup.
 *
 * Same argument as `icons.data.ts` next door. The mark is drawn in five
 * places in the app and in four files under `public/`, and a logo that is
 * hand-copied into nine drawings is a logo with nine slightly different
 * versions of itself the first time somebody nudges one of them. So the
 * geometry is here, once, and everything that draws the mark reads it:
 *
 *   - `Brand.tsx`      the flat, one-colour mark the app wears
 *   - `scripts/icons.mjs`  writes `public/icon.svg` and `icon-maskable.svg`
 *
 * `mark.test.ts` holds the two consumers to this file — the generated SVGs
 * have to match what the generator produces now, which is the same rule
 * `counts.ts` uses for the numbers in the README.
 *
 * ## The drawing
 *
 * Three parallelograms on a 512 grid, leaning right, the middle one tallest
 * and the right one hung lowest — a term rising, cresting and running out.
 * Each slab is cut in two along its length at 75%: a wide **face** and a
 * narrow **edge**. Flat, in one colour, the cut is invisible and the slab is
 * a single quadrilateral; lit, with the two gradients the icon files carry,
 * the cut is the fold that makes the metal read as a solid rather than as a
 * grey sticker.
 *
 * `SLOPE` is the drop across a slab's full width, so a slab's left and right
 * ends are the same length and the three verticals stay parallel. The face's
 * own drop is `SLOPE * FACE / WIDTH` and is a whole number by construction —
 * 32 × 0.75 — which is what keeps the fold a straight line rather than a
 * hairline wedge that shows up as a bright seam at icon sizes.
 */

/** The side of the square everything below is measured in. */
export const GRID = 512;

/** The corner radius of the tile the mark sits on. */
export const RADIUS = 114;

/** How far a slab's top and bottom edges fall across its full width. */
export const SLOPE = 32;

/** A slab's full width, and how much of it is the lit face. */
export const WIDTH = 76;
export const FACE = 57;

/** The face's own drop — `SLOPE * FACE / WIDTH`, and a whole number. */
export const FACE_SLOPE = (SLOPE * FACE) / WIDTH;

/**
 * Where each slab starts and how tall it is, at its left edge.
 *
 * Left of centre and short, middle and tallest, right and hung lowest. The
 * three together span x 128–384 and y 65–447 once the slope is added, which
 * is centred in the grid on both axes — checked in `mark.test.ts`, because
 * an off-centre logo is the kind of thing nobody sees and everybody feels.
 */
export const BARS = [
  { x: 128, top: 176, bottom: 388 },
  { x: 218, top: 65, bottom: 372 },
  { x: 308, top: 147, bottom: 415 },
] as const;

export type Bar = (typeof BARS)[number];

/** A quadrilateral from four corners, closed. */
function quad(pts: [number, number][]): string {
  return `M${pts.map(([x, y]) => `${x} ${y}`).join('L')}Z`;
}

/** The whole slab, which is what the app draws when there is no light on it. */
export function slabPath(bar: Bar): string {
  const { x, top, bottom } = bar;
  return quad([
    [x, top],
    [x + WIDTH, top + SLOPE],
    [x + WIDTH, bottom + SLOPE],
    [x, bottom],
  ]);
}

/** The lit face: the left three quarters of the slab. */
export function facePath(bar: Bar): string {
  const { x, top, bottom } = bar;
  return quad([
    [x, top],
    [x + FACE, top + FACE_SLOPE],
    [x + FACE, bottom + FACE_SLOPE],
    [x, bottom],
  ]);
}

/** The turned edge: the last quarter, in shadow. */
export function edgePath(bar: Bar): string {
  const { x, top, bottom } = bar;
  return quad([
    [x + FACE, top + FACE_SLOPE],
    [x + WIDTH, top + SLOPE],
    [x + WIDTH, bottom + SLOPE],
    [x + FACE, bottom + FACE_SLOPE],
  ]);
}

/** The box the three slabs actually occupy, slope included. */
export function bounds() {
  const left = Math.min(...BARS.map((b) => b.x));
  const right = Math.max(...BARS.map((b) => b.x)) + WIDTH;
  const top = Math.min(...BARS.map((b) => b.top));
  const bottom = Math.max(...BARS.map((b) => b.bottom)) + SLOPE;
  return { left, right, top, bottom };
}
