/**
 * How big a picture is, read out of its own first few bytes.
 *
 * A `.docx` has to be told a picture's size in advance — the drawing element
 * carries an explicit width and height, and Word draws exactly what it is
 * told. There is no "natural size" for it to fall back on, so a wrong number
 * here is a picture squashed or stretched in the file while looking perfect on
 * the screen it came from.
 *
 * The obvious way to get it is to decode the image, and that needs a canvas or
 * an `Image` — a browser, in other words, which the exporter is not allowed to
 * assume it is inside and the tests certainly are not. Every one of these
 * formats states its dimensions in a header a few bytes long, so they are read
 * rather than decoded: no DOM, no async, and the same answer in a test as in
 * the app.
 *
 * Three formats, because those are the three a `.docx` can carry that a phone
 * camera or a screenshot actually produces. Anything else answers `null`, and
 * the caller leaves the picture out rather than guessing at it.
 */

/** What a picture is, once its header has been read. */
export interface Pixels {
  width: number;
  height: number;
  /** The extension the package will file it under, and the media type. */
  kind: 'png' | 'jpeg' | 'gif';
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A big-endian 32-bit number, which is what PNG counts in. */
function be32(bytes: Uint8Array, at: number): number {
  return (
    ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0
  );
}

function be16(bytes: Uint8Array, at: number): number {
  return (bytes[at] << 8) | bytes[at + 1];
}

/**
 * A picture's size, or `null` where these bytes are not one this can read.
 *
 * Deliberately strict: a file whose header does not say what it claims to is
 * left out of the document rather than written in with a guessed size, because
 * the guess is invisible until somebody opens the file in Word.
 */
export function sizeOf(bytes: Uint8Array): Pixels | null {
  // ── PNG: the IHDR chunk is always first, and always at the same offset. ──
  if (bytes.length >= 24 && PNG.every((b, i) => bytes[i] === b)) {
    const width = be32(bytes, 16);
    const height = be32(bytes, 20);
    return width > 0 && height > 0 ? { width, height, kind: 'png' } : null;
  }

  // ── GIF: little-endian, and the only one of the three that is. ──
  if (bytes.length >= 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    const width = bytes[6] | (bytes[7] << 8);
    const height = bytes[8] | (bytes[9] << 8);
    return width > 0 && height > 0 ? { width, height, kind: 'gif' } : null;
  }

  // ── JPEG: walked, because the size is in a frame header of unknown position. ──
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) return jpeg(bytes);

  return null;
}

/**
 * A JPEG's dimensions, found by walking its segments to the frame header.
 *
 * Unlike the other two there is no fixed offset: a JPEG is a chain of
 * segments, each saying how long it is, and the size lives in whichever
 * "start of frame" segment comes first. The exclusions matter — `C4`, `C8` and
 * `CC` sit inside the SOF range and are *not* frames (Huffman tables, an
 * extension, arithmetic coding), and reading one of those as a frame gives a
 * plausible wrong answer rather than an obvious failure.
 */
function jpeg(bytes: Uint8Array): Pixels | null {
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) {
      at += 1;
      continue;
    }
    const marker = bytes[at + 1];
    // Padding between segments, and the two markers that carry no length.
    if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      at += 2;
      continue;
    }
    const isFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      const height = be16(bytes, at + 5);
      const width = be16(bytes, at + 7);
      return width > 0 && height > 0 ? { width, height, kind: 'jpeg' } : null;
    }
    const length = be16(bytes, at + 2);
    if (length < 2) return null;
    at += 2 + length;
  }
  return null;
}

/** The media type a package declares for each of them. */
export const MEDIA_TYPE: Record<Pixels['kind'], string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
};

/**
 * English Metric Units, which is what OOXML measures a drawing in.
 *
 * 914,400 to the inch, and a picture's pixels are read at 96 to the inch —
 * the figure Word itself assumes for an image with no density of its own. So a
 * 960-pixel-wide screenshot is ten inches, which is why the caller has to fit
 * it to the page rather than writing it out at its natural size.
 */
export const EMU_PER_INCH = 914_400;
export const PIXELS_PER_INCH = 96;

export function emus(pixels: number): number {
  return Math.round((pixels / PIXELS_PER_INCH) * EMU_PER_INCH);
}

/**
 * A picture scaled down to fit a width, and never scaled up.
 *
 * A screenshot is wider than the page and has to come down; a small diagram is
 * not improved by being blown up to the margins, and blowing it up is how a
 * crisp 200-pixel figure becomes a blurred one. So this only ever shrinks.
 */
export function fitted(size: Pixels, mostInches: number): { cx: number; cy: number } {
  const cx = emus(size.width);
  const cy = emus(size.height);
  const most = Math.round(mostInches * EMU_PER_INCH);
  if (cx <= most) return { cx, cy };
  return { cx: most, cy: Math.round((cy * most) / cx) };
}

/**
 * Whether a file in the drive is one a document can carry.
 *
 * The three formats above and no others. A PDF, a HEIC off a phone camera or
 * a .webp saved from a browser are all perfectly good files and none of them
 * is a picture Word will draw from the bytes as they are, so the picker does
 * not offer them rather than offering them and failing on export.
 *
 * The recorded media type first, because that is what the browser said the
 * file was; the extension second, because a file that came in from a zip or
 * an older browser can have an empty one. Both are claims about the bytes
 * rather than the bytes themselves — `sizeOf` is what actually decides, and
 * it reads the header.
 */
export function pictureLike(file: { name: string; type: string }): boolean {
  const said = file.type.toLowerCase();
  if (said) return said === 'image/png' || said === 'image/jpeg' || said === 'image/gif';
  return /\.(png|jpe?g|gif)$/i.test(file.name);
}
