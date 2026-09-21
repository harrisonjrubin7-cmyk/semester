import { describe, expect, it } from 'vitest';
import { TOLERANCE, clearedShare, edgeColour, keyOut } from './cutout';

/**
 * The pixel arithmetic, away from any canvas.
 *
 * Everything the editor does around this — reading the file, drawing it,
 * putting it back, writing a new PNG into Files — needs a browser and is
 * checked by driving one. What is here is the part that decides *which pixels
 * go*, and it is the part that can be wrong quietly: a key that takes the
 * subject, or an edge sample that answers with a speck.
 */

/** A `width` × `height` buffer, filled, so a case reads as a picture. */
const picture = (width: number, height: number, fill: [number, number, number, number]) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill[0];
    data[i + 1] = fill[1];
    data[i + 2] = fill[2];
    data[i + 3] = fill[3];
  }
  return data;
};

const put = (data: Uint8ClampedArray, width: number, x: number, y: number, c: [number, number, number, number]) => {
  const i = (y * width + x) * 4;
  data[i] = c[0];
  data[i + 1] = c[1];
  data[i + 2] = c[2];
  data[i + 3] = c[3];
};

const alphaAt = (data: Uint8ClampedArray, width: number, x: number, y: number) => data[(y * width + x) * 4 + 3];

describe('finding what the background is', () => {
  it('answers with the colour the border is made of', () => {
    const d = picture(8, 8, [255, 255, 255, 255]);
    // A subject in the middle, which must not get a vote.
    for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) put(d, 8, x, y, [10, 20, 30, 255]);
    expect(edgeColour(d, 8, 8)).toEqual({ r: 255, g: 255, b: 255 });
  });

  /*
   * The reason the border votes instead of a corner being read.
   *
   * A single dark pixel in the top-left is exactly what a vignette, a JPEG
   * ring or a speck of dust looks like, and a sample of one cannot tell it
   * from the background. This is the case that decided the design, so it is
   * the case that is measured.
   */
  it('is not fooled by one odd pixel in the corner', () => {
    const d = picture(8, 8, [250, 250, 250, 255]);
    put(d, 8, 0, 0, [0, 0, 0, 255]);
    expect(edgeColour(d, 8, 8)).toEqual({ r: 250, g: 250, b: 250 });
  });

  /*
   * Near-identical shades must count as one colour, and this is the case that
   * proves it rather than merely agreeing with it.
   *
   * The border is 24 whites that all differ by a byte or two, plus 12 pixels
   * of one exact blue. Counting raw triples, each white polls 1 and the blue
   * polls 12, so the blue is named the background — the minority colour wins
   * because it is uniform. Bucketed, the whites are one colour with 24 votes
   * and take it.
   *
   * The first version of this test had a black interior and asked only that
   * the answer be pale, which it was with or without the buckets: it passed
   * against a faithful revert, which is to say it was not a guard at all.
   */
  it('lets a spread of near-identical shades out-poll a smaller uniform one', () => {
    const d = picture(10, 10, [0, 0, 0, 255]);
    const border: [number, number][] = [];
    for (let x = 0; x < 10; x++) border.push([x, 0], [x, 9]);
    for (let y = 1; y < 9; y++) border.push([0, y], [9, y]);
    expect(border).toHaveLength(36);

    border.forEach(([x, y], i) => {
      if (i < 24) {
        // Distinct triples, all inside one bucket: 240–255 shares `>> 4`.
        put(d, 10, x, y, [240 + (i % 16), 241 + ((i * 5) % 14), 242 + ((i * 3) % 13), 255]);
      } else {
        put(d, 10, x, y, [0, 0, 255, 255]);
      }
    });

    const key = edgeColour(d, 10, 10);
    expect(key.r).toBeGreaterThan(235);
    expect(key.g).toBeGreaterThan(235);
    // The one that actually discriminates: unbucketed, this comes back 255.
    expect(key.b).toBeGreaterThan(235);
  });

  it('ignores pixels that are already transparent', () => {
    // Their colour bytes are whatever was underneath before something cleared
    // them, so they are not evidence about anything.
    const d = picture(6, 6, [0, 0, 0, 0]);
    for (let x = 0; x < 6; x++) put(d, 6, x, 0, [12, 34, 56, 255]);
    expect(edgeColour(d, 6, 6)).toEqual({ r: 12, g: 34, b: 56 });
  });

  it('answers white for a picture with nothing in it', () => {
    expect(edgeColour(new Uint8ClampedArray(0), 0, 0)).toEqual({ r: 255, g: 255, b: 255 });
    expect(edgeColour(picture(4, 4, [0, 0, 0, 0]), 4, 4)).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe('keying a colour out', () => {
  it('clears the background and leaves the subject standing', () => {
    const d = picture(8, 8, [255, 255, 255, 255]);
    for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) put(d, 8, x, y, [10, 20, 30, 255]);

    const cleared = keyOut(d, 8, 8, { r: 255, g: 255, b: 255 }, TOLERANCE.deft);
    expect(cleared).toBe(64 - 16);
    expect(alphaAt(d, 8, 0, 0)).toBe(0);
    // The control: a test that only checked the background would pass just as
    // well against a key that cleared the whole picture.
    expect(alphaAt(d, 8, 3, 3)).toBe(255);
  });

  /*
   * The reason the floor is 4 rather than 0. A JPEG of a white background
   * holds a few hundred colours within a whisker of white; an exact match
   * lifts some of them and leaves the picture looking eaten.
   */
  it('takes the shades a compressed picture really holds, not just the exact one', () => {
    const d = picture(4, 4, [255, 255, 255, 255]);
    put(d, 4, 1, 1, [253, 255, 254, 255]);
    put(d, 4, 2, 2, [255, 252, 255, 255]);
    expect(keyOut(d, 4, 4, { r: 255, g: 255, b: 255 }, TOLERANCE.deft)).toBe(16);
  });

  it('leaves a colour that is merely similar, at a tolerance that should not reach it', () => {
    const d = picture(2, 2, [255, 255, 255, 255]);
    put(d, 2, 0, 0, [200, 200, 200, 255]);
    keyOut(d, 2, 2, { r: 255, g: 255, b: 255 }, 32);
    expect(alphaAt(d, 2, 0, 0)).toBe(255);
    expect(alphaAt(d, 2, 1, 1)).toBe(0);
  });

  /*
   * Alpha goes to 0; the colour bytes stay. Zeroing them too is invisible
   * until the PNG is composited somewhere that ignores the alpha, and then the
   * whole background returns as a black rectangle.
   */
  it('clears the alpha without blacking out the colour underneath it', () => {
    const d = picture(2, 2, [120, 130, 140, 255]);
    keyOut(d, 2, 2, { r: 120, g: 130, b: 140 }, TOLERANCE.deft);
    expect(alphaAt(d, 2, 0, 0)).toBe(0);
    expect([d[0], d[1], d[2]]).toEqual([120, 130, 140]);
  });

  it('does not count a pixel that was already clear', () => {
    const d = picture(2, 2, [255, 255, 255, 0]);
    expect(keyOut(d, 2, 2, { r: 255, g: 255, b: 255 }, TOLERANCE.deft)).toBe(0);
  });

  /*
   * The defect the flood fill exists for, and the one every test above is
   * blind to: all twelve of them pass against a global key, because in each
   * the background is reachable from an edge.
   *
   * A ring is the commonest real case — the middle of a letter O, the gap
   * inside a logo, the hole in a mug handle. It is the background's colour and
   * it is not the background, and a global key punches straight through it.
   */
  it('leaves an enclosed pocket of the background colour alone', () => {
    const W = 21;
    const d = picture(W, W, [255, 255, 255, 255]);
    for (let y = 0; y < W; y++) {
      for (let x = 0; x < W; x++) {
        const r = Math.hypot(x - 10, y - 10);
        if (r >= 4 && r <= 8) put(d, W, x, y, [20, 20, 20, 255]);
      }
    }

    keyOut(d, W, W, { r: 255, g: 255, b: 255 }, TOLERANCE.deft);

    expect(alphaAt(d, W, 10, 10), 'the hole inside the ring was eaten').toBe(255);
    expect(alphaAt(d, W, 0, 0), 'the outside was not lifted').toBe(0);
    expect(alphaAt(d, W, 10, 4), 'the ring itself was lifted').toBe(255);
  });

  /*
   * Four-connected, not eight. An eight-connected flood squeezes through a
   * single-pixel diagonal gap — which is what a thin letterform or a hairline
   * border is made of, so the leak lands on exactly the pictures this feature
   * is for.
   */
  it('does not leak through a one-pixel diagonal gap in an outline', () => {
    const d = picture(7, 7, [255, 255, 255, 255]);
    // A box of dark pixels with its corner left open on the diagonal only.
    for (const [x, y] of [[2, 1], [3, 1], [4, 1], [1, 2], [5, 2], [1, 3], [5, 3], [1, 4], [5, 4], [2, 5], [3, 5], [4, 5]] as const) {
      put(d, 7, x, y, [20, 20, 20, 255]);
    }
    keyOut(d, 7, 7, { r: 255, g: 255, b: 255 }, TOLERANCE.deft);
    expect(alphaAt(d, 7, 3, 3), 'the flood got in through a diagonal').toBe(255);
  });

  /*
   * A picture already carrying transparency must not be walled off by it, or
   * raising the tolerance and lifting again would do nothing.
   *
   * The first version of this test did not test that at all: it cleared the
   * top row and asked whether the middle went, but the other three borders
   * still reached the middle on their own, so it passed with the pass-through
   * removed. Here the *only* way in is the cleared cell — a dark wall with one
   * already-transparent gap in it.
   */
  it('lets a second lift pass through what the first one cleared', () => {
    const W = 9;
    const d = picture(W, W, [255, 255, 255, 255]);
    for (let y = 2; y <= 6; y++) {
      for (let x = 2; x <= 6; x++) {
        if (x === 2 || x === 6 || y === 2 || y === 6) put(d, W, x, y, [20, 20, 20, 255]);
      }
    }
    // The one opening, already lifted by an earlier pass.
    put(d, W, 4, 2, [255, 255, 255, 0]);

    keyOut(d, W, W, { r: 255, g: 255, b: 255 }, TOLERANCE.deft);

    expect(alphaAt(d, W, 0, 0), 'outside the wall').toBe(0);
    expect(alphaAt(d, W, 4, 4), 'inside, reachable only through the cleared gap').toBe(0);
    expect(alphaAt(d, W, 2, 4), 'the wall itself').toBe(255);
  });

  it('takes more as the tolerance rises, and never fewer', () => {
    const counts = [4, 16, 32, 64, 120].map((t) => {
      const d = picture(8, 8, [255, 255, 255, 255]);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) put(d, 8, x, y, [255 - x * 8, 255 - x * 8, 255 - x * 8, 255]);
      return keyOut(d, 8, 8, { r: 255, g: 255, b: 255 }, t);
    });
    for (let i = 1; i < counts.length; i++) expect(counts[i]!).toBeGreaterThanOrEqual(counts[i - 1]!);
    // And the ramp really does span the range, or the run above proves nothing.
    expect(counts[counts.length - 1]!).toBeGreaterThan(counts[0]!);
  });
});

describe('how much a key would take', () => {
  it('is the fraction cleared, and zero for a picture with no pixels', () => {
    expect(clearedShare(48, 64)).toBeCloseTo(0.75);
    expect(clearedShare(0, 0)).toBe(0);
  });
});
