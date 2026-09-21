/**
 * Lifting a flat background off a picture, in the browser, on the device.
 *
 * ## What this is, and the thing it is not
 *
 * This keys out a *colour*. It finds what the picture's border is made of,
 * then clears every pixel close enough to it. On the things a student
 * actually pastes into a poster — a logo on white, a scanned figure, a plot
 * saved out of a notebook, a crest off a department page — that is the whole
 * job, and it is exact rather than approximate.
 *
 * It is **not** subject segmentation. Canva's "remove background" runs a
 * neural network that knows what a person is; this knows what a colour is.
 * On a photo of somebody against a cluttered room it will do something
 * useless, and the control in the editor is named for what it does so that
 * nobody discovers the difference by trying it on their graduation photo.
 *
 * The alternative was a segmentation model, and both routes out were worse
 * than saying no: bundling one puts tens of megabytes into a progressive web
 * app students open on a phone, and calling a hosted one sends their files off
 * the device, which is the promise `lib/files.ts` exists to keep.
 *
 * ## Why the pixels are here and the canvas is not
 *
 * Everything in this file is arithmetic over an array. No `document`, no
 * `<canvas>`, no `ImageData` — the caller in the editor does the drawing and
 * hands the bytes over. That is what lets the interesting part be tested at
 * all: the test environment has no canvas, and a probe that needed one would
 * have to be a mock of the thing being measured.
 */

/** A colour, as the three bytes a pixel buffer holds. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * How far apart two colours may be and still count as the same one.
 *
 * The scale is the distance in RGB, so 0 removes only an exact match and 255
 * removes most of a photograph. The floor is not 0: a JPEG of a white
 * background does not hold one white, it holds a few hundred colours within a
 * whisker of it, and a key that matched exactly would lift about a third of
 * them and leave the picture looking eaten. 12 is a compression artefact; 60
 * is a different colour.
 */
export const TOLERANCE = { min: 4, max: 120, deft: 32 } as const;

/** Distance between two colours, squared — the root is never needed. */
const apart = (r: number, g: number, b: number, k: Rgb): number =>
  (r - k.r) ** 2 + (g - k.g) ** 2 + (b - k.b) ** 2;

/**
 * The colour the picture's border is made of.
 *
 * The border rather than a corner. One corner is one pixel, and on anything
 * with a vignette, a JPEG ring or a stray dark speck it is the one pixel that
 * is not the background — a sample of one cannot tell a background from a
 * blemish. So every pixel on the four edges votes, in buckets of 16 per
 * channel so that near-identical shades count as one colour rather than
 * splitting the vote between themselves and losing to a smaller, more uniform
 * group.
 *
 * The answer is the average of the winning bucket rather than the bucket's
 * midpoint, so the key is a colour that is really in the picture.
 */
export function edgeColour(data: Uint8ClampedArray, width: number, height: number): Rgb {
  if (width < 1 || height < 1) return { r: 255, g: 255, b: 255 };

  const votes = new Map<number, { n: number; r: number; g: number; b: number }>();
  const vote = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    // A transparent pixel is not evidence about the background's colour: its
    // rgb bytes are whatever was underneath before something cleared it.
    if (data[i + 3]! < 8) return;
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const key = (r >> 4) * 256 + (g >> 4) * 16 + (b >> 4);
    const had = votes.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    votes.set(key, { n: had.n + 1, r: had.r + r, g: had.g + g, b: had.b + b });
  };

  for (let x = 0; x < width; x++) {
    vote(x, 0);
    vote(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    vote(0, y);
    vote(width - 1, y);
  }

  let best = { n: 0, r: 0, g: 0, b: 0 };
  for (const v of votes.values()) if (v.n > best.n) best = v;
  if (!best.n) return { r: 255, g: 255, b: 255 };

  return { r: Math.round(best.r / best.n), g: Math.round(best.g / best.n), b: Math.round(best.b / best.n) };
}

/**
 * Clear every pixel close enough to `key`, in place. Answers how many went.
 *
 * In place because the buffer is the one the caller is about to put back on a
 * canvas, and copying a few million bytes to avoid saying so would be a cost
 * paid on every use for a tidiness nobody can observe.
 *
 * Alpha goes to 0 and the colour bytes are left alone. Writing them to zero as
 * well would turn every cleared pixel black, which is invisible until the PNG
 * is composited somewhere that does not honour the alpha — and then the whole
 * background comes back as a black rectangle.
 */
export function keyOut(data: Uint8ClampedArray, key: Rgb, tolerance: number): number {
  const limit = tolerance * tolerance;
  let cleared = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    if (apart(data[i]!, data[i + 1]!, data[i + 2]!, key) <= limit) {
      data[i + 3] = 0;
      cleared++;
    }
  }
  return cleared;
}

/**
 * How much of the picture a key would take, as a fraction.
 *
 * The editor asks before it commits, because the failure this feature has is
 * not an error — it is a tolerance that takes the subject as well and leaves a
 * layer that is almost entirely gone. A number the caller can refuse on is the
 * difference between that and a picture somebody has to undo.
 */
export const clearedShare = (cleared: number, pixels: number): number => (pixels > 0 ? cleared / pixels : 0);
