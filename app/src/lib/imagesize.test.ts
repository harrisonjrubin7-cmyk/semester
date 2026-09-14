import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EMU_PER_INCH, MEDIA_TYPE, emus, fitted, pictureLike, sizeOf, type Pixels } from './imagesize';

/**
 * Reading a picture's size out of its own header.
 *
 * The fixtures in `__pix/` are real files, written by an image library rather
 * than typed out here, with dimensions chosen to be unmistakable: 11×4, 3×7,
 * 5×2. Hand-built bytes would only ever prove this agrees with my reading of
 * the specification, which is the thing in doubt.
 *
 * The odd numbers matter. Square fixtures would pass a reader that has width
 * and height the wrong way round, and a JPEG states its height *before* its
 * width — which is exactly the mistake worth catching.
 */

const pix = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(join(__dirname, '__pix', name)));

describe('a PNG', () => {
  it('is read at its real size', () => {
    expect(sizeOf(pix('eleven-by-four.png'))).toEqual({ width: 11, height: 4, kind: 'png' });
  });
});

describe('a JPEG', () => {
  /*
   * The one that catches a transposition: a JPEG's frame header states height
   * first and width second, so a reader that takes them in the written order
   * answers 7×3 for this file and looks entirely reasonable doing it.
   */
  it('is read at its real size, height and width the right way round', () => {
    expect(sizeOf(pix('three-by-seven.jpg'))).toEqual({ width: 3, height: 7, kind: 'jpeg' });
  });
});

describe('a GIF', () => {
  it('is read at its real size, little-endian unlike the other two', () => {
    expect(sizeOf(pix('five-by-two.gif'))).toEqual({ width: 5, height: 2, kind: 'gif' });
  });
});

describe('anything else', () => {
  it('answers with nothing rather than a guess', () => {
    expect(sizeOf(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))).toBeNull();
    expect(sizeOf(new Uint8Array(0))).toBeNull();
  });

  /*
   * A file that starts like a PNG and then stops is not a PNG. Answering with
   * whatever happens to be at byte 16 of a truncated file is how a document
   * ends up with a picture scaled to a number read out of nothing.
   */
  it('refuses a header that claims a format and is too short to carry it', () => {
    const cut = pix('eleven-by-four.png').slice(0, 12);
    expect(sizeOf(cut)).toBeNull();
  });

  it('refuses a picture whose header says it is nothing wide', () => {
    const zeroed = pix('eleven-by-four.png').slice();
    zeroed.set([0, 0, 0, 0], 16);
    expect(sizeOf(zeroed)).toBeNull();
  });
});

describe('turning pixels into what the format measures in', () => {
  it('counts 96 pixels to the inch and 914,400 units to it', () => {
    expect(emus(96)).toBe(EMU_PER_INCH);
    expect(emus(48)).toBe(EMU_PER_INCH / 2);
  });

  /*
   * A screenshot is wider than the page and has to come down. The aspect ratio
   * has to survive that, or the picture arrives in Word visibly squashed while
   * looking right everywhere it came from.
   */
  it('brings a picture too wide for the page down, keeping its shape', () => {
    const wide: Pixels = { width: 1920, height: 960, kind: 'png' };
    const { cx, cy } = fitted(wide, 6);
    expect(cx).toBe(6 * EMU_PER_INCH);
    expect(cy / cx).toBeCloseTo(960 / 1920, 5);
  });

  /*
   * And never the other way. A crisp 200-pixel diagram blown up to the margins
   * is a blurred 200-pixel diagram.
   */
  it('leaves a small picture alone rather than blowing it up', () => {
    const small: Pixels = { width: 200, height: 100, kind: 'png' };
    expect(fitted(small, 6)).toEqual({ cx: emus(200), cy: emus(100) });
  });
});

it('has a media type for every kind it can read', () => {
  for (const kind of ['png', 'jpeg', 'gif'] as const) {
    expect(MEDIA_TYPE[kind]).toMatch(/^image\//);
  }
});

describe('which of the drive’s files a document can carry', () => {
  it('takes the three it can read and refuses the rest', () => {
    expect(pictureLike({ name: 'a.png', type: 'image/png' })).toBe(true);
    expect(pictureLike({ name: 'a.jpg', type: 'image/jpeg' })).toBe(true);
    expect(pictureLike({ name: 'a.gif', type: 'image/gif' })).toBe(true);
    expect(pictureLike({ name: 'a.webp', type: 'image/webp' })).toBe(false);
    expect(pictureLike({ name: 'a.heic', type: 'image/heic' })).toBe(false);
    expect(pictureLike({ name: 'notes.pdf', type: 'application/pdf' })).toBe(false);
  });

  /*
   * A file out of a zip, or off a browser old enough not to have guessed, has
   * no recorded type at all — and is still the picture its name says it is.
   */
  it('falls back to the name when the browser said nothing', () => {
    expect(pictureLike({ name: 'Scan.JPEG', type: '' })).toBe(true);
    expect(pictureLike({ name: 'chart.png', type: '' })).toBe(true);
    expect(pictureLike({ name: 'reading', type: '' })).toBe(false);
    expect(pictureLike({ name: 'slides.pptx', type: '' })).toBe(false);
  });

  /* The type is what the browser said; a `.png` named file that is really a
     PDF is refused on the type rather than believed on the name. */
  it('believes the recorded type over the name', () => {
    expect(pictureLike({ name: 'trap.png', type: 'application/pdf' })).toBe(false);
  });
});
