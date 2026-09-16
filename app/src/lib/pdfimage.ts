/**
 * A picture, as the bytes a PDF can hold without decoding it first.
 *
 * `lib/docx.ts` puts a real picture in the Word file and `lib/pdfout.ts` drew
 * `[Alt text]` in italics where one should be — the same document exported
 * twice, one of the two carrying the figure. `lib/exportqa.ts` named it as the
 * last of the five differences between them, and this is the half of closing
 * it that is about bytes rather than about layout.
 *
 * ## Why this is header-reading and not decoding
 *
 * A PDF's image streams are the same compressed formats a picture already
 * arrives in. A baseline JPEG goes in whole under `DCTDecode`; a PNG's `IDAT`
 * chunks concatenated *are* a zlib stream, which is what `FlateDecode` reads,
 * and the row filters PNG applies are exactly PDF's `Predictor 15`. So for the
 * common cases nothing has to be decompressed, resampled or re-encoded — the
 * file is handed over and the reader does the work it was always going to do.
 *
 * That is the whole reason this can be synchronous and dependency-free inside
 * a pure function. Decoding would mean an inflate, which means `fflate`, which
 * `lib/docx.ts` is careful to import lazily so it stays out of the bundle for
 * everybody who never exports.
 *
 * ## What it refuses, and why refusing is the right answer
 *
 * - **A PNG with an alpha channel** (colour types 4 and 6). PDF has no image
 *   with alpha in it: transparency is a second image, an `SMask`, holding the
 *   alpha on its own — and splitting one interleaved stream into two means
 *   inflating it. This is the refusal that will fire most often, because a
 *   screenshot is usually RGBA.
 * - **A palette PNG with `tRNS`**, for the same reason in a different shape:
 *   the transparent entry would be drawn as whatever solid colour it is.
 * - **An interlaced PNG, or one at a bit depth other than 8.** Both are
 *   legal and neither is what `Predictor 15` describes.
 * - **A progressive JPEG.** `DCTDecode` is a baseline decoder by the
 *   specification. Most readers cope; a file some readers reject is worse
 *   than a line of italics, which is what a refusal falls back to.
 * - **A GIF.** There is no PDF filter that reads one.
 *
 * A refusal is `null`, and `lib/pdfout.ts` then prints the alt text as it
 * always did. The picture is visibly not there rather than silently wrong,
 * which is the same choice `lib/imagesize.ts` makes one layer down: a header
 * that does not say what it claims leaves the picture out rather than guessing.
 */

/** A picture ready to be written into a PDF, exactly as it is. */
export interface Encoded {
  width: number;
  height: number;
  /** The colour space, as the PDF name or array the image dictionary takes. */
  space: string;
  /** The filter and its parameters, as dictionary entries. */
  filter: string;
  /** The stream, byte for byte. Nothing here re-compresses anything. */
  data: Uint8Array;
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function be32(bytes: Uint8Array, at: number): number {
  return ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
}

function be16(bytes: Uint8Array, at: number): number {
  return (bytes[at] << 8) | bytes[at + 1];
}

/** Bytes as the hexadecimal string a PDF string literal can also be written as. */
function hex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/**
 * A PNG, if it is one of the three shapes that need no decoding.
 *
 * The chunks are walked rather than assumed: `IHDR` is first by the format's
 * own rule, but `PLTE`, `tRNS` and the `IDAT`s are not at fixed offsets, and a
 * picture from a real editor has `pHYs`, `iCCP` and `tEXt` scattered between
 * them.
 */
function png(bytes: Uint8Array): Encoded | null {
  if (bytes.length < 33 || !PNG.every((b, i) => bytes[i] === b)) return null;

  const width = be32(bytes, 16);
  const height = be32(bytes, 20);
  const depth = bytes[24];
  const colour = bytes[25];
  const interlace = bytes[28];
  if (width <= 0 || height <= 0) return null;
  if (depth !== 8 || interlace !== 0) return null;
  if (colour !== 0 && colour !== 2 && colour !== 3) return null;

  let palette: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  let at = 8;
  while (at + 8 <= bytes.length) {
    const length = be32(bytes, at);
    const tag = String.fromCharCode(bytes[at + 4], bytes[at + 5], bytes[at + 6], bytes[at + 7]);
    const from = at + 8;
    if (from + length > bytes.length) return null;
    if (tag === 'PLTE') palette = bytes.subarray(from, from + length);
    // Transparency it cannot carry. A palette entry meant to be see-through
    // would be drawn as whatever solid colour sits in that slot.
    if (tag === 'tRNS') return null;
    if (tag === 'IDAT') idat.push(bytes.subarray(from, from + length));
    if (tag === 'IEND') break;
    at = from + length + 4;
  }
  if (idat.length === 0) return null;
  if (colour === 3 && (!palette || palette.length === 0 || palette.length % 3 !== 0)) return null;

  const total = idat.reduce((n, part) => n + part.length, 0);
  const data = new Uint8Array(total);
  let cursor = 0;
  for (const part of idat) {
    data.set(part, cursor);
    cursor += part.length;
  }

  const colours = colour === 2 ? 3 : 1;
  const space =
    colour === 3 && palette
      ? `[ /Indexed /DeviceRGB ${palette.length / 3 - 1} <${hex(palette)}> ]`
      : colour === 2
        ? '/DeviceRGB'
        : '/DeviceGray';

  return {
    width,
    height,
    space,
    // Predictor 15 is "the rows carry PNG's own filter bytes", which is what
    // an IDAT stream is. Nothing here undoes them; the reader does.
    filter:
      '/Filter /FlateDecode /DecodeParms << /Predictor 15 ' +
      `/Colors ${colours} /BitsPerComponent 8 /Columns ${width} >>`,
    data,
  };
}

/**
 * A baseline JPEG, walked to its frame header the way `lib/imagesize.ts` walks
 * one — for the same reason, that the size is in a segment of no fixed
 * position, and with one more question asked of the same segment: how many
 * components it has, which is the colour space.
 */
function jpeg(bytes: Uint8Array): Encoded | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) {
      at += 1;
      continue;
    }
    const marker = bytes[at + 1];
    if (marker === 0xff || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      at += 2;
      continue;
    }
    const isFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      // Baseline only, which is what `DCTDecode` is defined to read. `C0` is
      // baseline and `C1` is its extended sequential twin; everything else in
      // the range is progressive, hierarchical or lossless.
      if (marker !== 0xc0 && marker !== 0xc1) return null;
      const height = be16(bytes, at + 5);
      const width = be16(bytes, at + 7);
      const components = bytes[at + 9];
      if (width <= 0 || height <= 0) return null;
      const space =
        components === 1 ? '/DeviceGray' : components === 3 ? '/DeviceRGB' : components === 4 ? '/DeviceCMYK' : '';
      if (!space) return null;
      return { width, height, space, filter: '/Filter /DCTDecode', data: bytes };
    }
    const length = be16(bytes, at + 2);
    if (length < 2) return null;
    at += 2 + length;
  }
  return null;
}

/**
 * A picture as a PDF image stream, or nothing where this cannot carry it.
 *
 * The header at the top of this file has the list of refusals and the argument
 * for each. `null` is not an error: the caller prints what it printed before.
 */
export function encode(bytes: Uint8Array): Encoded | null {
  return png(bytes) ?? jpeg(bytes);
}
