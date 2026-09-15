import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FILES, MASK_SCALE } from './mark.svg';
import {
  BARS,
  FACE,
  FACE_SLOPE,
  GRID,
  SLOPE,
  WIDTH,
  bounds,
  edgePath,
  facePath,
  slabPath,
} from './mark.data';

/**
 * The logo, held to its own drawing.
 *
 * Three separate claims, and they fail in three different ways:
 *
 *  1. **The files on disk are what the generator writes.** `public/icon.svg`
 *     and `public/icon-maskable.svg` are committed rather than built, because
 *     a browser fetches them without going through Vite. Committed means they
 *     can be edited, and an edited icon drifts from the mark the app draws
 *     with nothing to say so. Same guard `readme.test.ts` puts on the counts.
 *  2. **The mark is centred and fits.** Nobody sees a logo four pixels left of
 *     centre; everybody feels it.
 *  3. **The maskable icon survives its crop.** An Android launcher cuts a
 *     circle out of it, and a mark that reaches past the safe zone comes back
 *     with its corners shaved — which is invisible on the machine that built
 *     it and obvious on a phone.
 */

const HERE = new URL('.', import.meta.url).pathname;
const PUBLIC = join(HERE, '..', '..', 'public');

describe('the mark', () => {
  it('is centred in the grid, both ways', () => {
    const box = bounds();
    expect(box.left + box.right, 'the slabs are off-centre horizontally').toBe(GRID);
    expect(box.top + box.bottom, 'the slabs are off-centre vertically').toBe(GRID);
  });

  it('folds each slab on a straight line', () => {
    // The face's drop has to be the slope in the same proportion as its width,
    // or the fold is a wedge rather than a line — a bright seam at icon sizes.
    expect(FACE_SLOPE * WIDTH).toBe(SLOPE * FACE);
    expect(Number.isInteger(FACE_SLOPE), 'a fractional fold lands on half a pixel').toBe(true);
  });

  it('leaves the three slabs clear of each other', () => {
    // A gap that closed would read as one solid block, and the drawing is the
    // three gaps as much as it is the three slabs.
    const sorted = [...BARS].sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length; i += 1) {
      const gap = sorted[i].x - (sorted[i - 1].x + WIDTH);
      expect(gap, `slabs ${i - 1} and ${i} are ${gap} apart`).toBeGreaterThan(8);
    }
  });

  it('draws the face and the edge as the whole slab', () => {
    // The two lit pieces have to cover the silhouette the app draws flat, or
    // the icon and the in-app mark are different shapes.
    for (const bar of BARS) {
      const whole = slabPath(bar);
      const left = Number(/^M(\d+)/.exec(whole)![1]);
      expect(facePath(bar).startsWith(`M${left} ${bar.top}`)).toBe(true);
      expect(edgePath(bar)).toContain(`${bar.x + WIDTH} ${bar.top + SLOPE}`);
    }
  });
});

describe('the icons on disk', () => {
  /*
   * The SVG text comes from `mark.svg.ts`, not from `scripts/icons.mjs`. The
   * first version of this imported the script — which wrote the files as a
   * side effect of being imported, so the assertion below repaired the edit it
   * was there to catch and then reported green. Found by hand-editing an icon
   * and watching the test pass.
   */
  it('are what `npm run icons` writes', () => {
    for (const [name, text] of Object.entries(FILES)) {
      expect(
        readFileSync(join(PUBLIC, name), 'utf8'),
        `public/${name} is not what the drawing produces. Run \`npm run icons\`.`,
      ).toBe(text);
    }
  });

  it('keeps the maskable one inside the safe circle', () => {
    const box = bounds();
    // The safe zone is a circle of 80% of the grid's *diameter*, and a
    // rectangle is furthest from the centre at its corners — which is what the
    // 0.8 in the spec does not say and what the first version of this drawing
    // got wrong.
    const half = Math.hypot((box.right - box.left) / 2, (box.bottom - box.top) / 2);
    expect(half * MASK_SCALE, 'the mark reaches past the maskable safe circle').toBeLessThanOrEqual(
      (GRID * 0.8) / 2,
    );
  });

  it('paints the whole tile, so no launcher shows through it', () => {
    for (const [name, text] of Object.entries(FILES)) {
      expect(text, `public/${name} has no ground`).toContain(`width="${GRID}" height="${GRID}"`);
    }
    // Only the rounded one rounds. A rounded tile inside a circular crop is a
    // black tile with four pale nicks taken out of it.
    expect(FILES['icon.svg']).toContain('rx=');
    expect(FILES['icon-maskable.svg']).not.toContain('rx=');
  });
});
