import { describe, expect, it } from 'vitest';
import { encode } from './pdfimage';

/**
 * Pictures built byte by byte rather than checked in as fixtures.
 *
 * A binary fixture is a file nobody in a review can read, and the whole
 * question here is which bytes a header has. Built here, the thing under test
 * and the thing asserted are the same eleven numbers, and a case is added by
 * changing one of them rather than by finding a picture that happens to be
 * wrong in the right way.
 */
function crc(buf: number[]): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(tag: string, body: number[]): number[] {
  const name = [...tag].map((c) => c.charCodeAt(0));
  const n = body.length;
  const sum = crc([...name, ...body]);
  return [
    (n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255,
    ...name, ...body,
    (sum >>> 24) & 255, (sum >>> 16) & 255, (sum >>> 8) & 255, sum & 255,
  ];
}

const IDAT = [0x78, 0x9c, 0x01, 0x00, 0x00, 0xff, 0xff, 0x00, 0x00, 0x00, 0x01];

function png(o: { w?: number; h?: number; depth?: number; colour?: number; interlace?: number; extra?: number[] } = {}) {
  const { w = 2, h = 2, depth = 8, colour = 2, interlace = 0, extra = [] } = o;
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk('IHDR', [0, 0, 0, w, 0, 0, 0, h, depth, colour, 0, 0, interlace]),
    ...extra,
    ...chunk('IDAT', IDAT),
    ...chunk('IEND', []),
  ]);
}

function jpeg(frame = 0xc0, components = 3) {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, ...Array(14).fill(0),
    0xff, frame, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x01, 0x90, components, ...Array(9).fill(0),
    0xff, 0xd9,
  ]);
}

describe('a PNG that needs no decoding', () => {
  it('hands the IDAT stream over as flate with PNG’s own predictor', () => {
    // The claim the whole file rests on: a concatenated IDAT *is* a zlib
    // stream, and PNG's per-row filters *are* Predictor 15.
    const got = encode(png({ w: 2, h: 2 }));
    expect(got).not.toBeNull();
    expect(got?.filter).toContain('/FlateDecode');
    expect(got?.filter).toContain('/Predictor 15');
    expect(got?.filter).toContain('/Columns 2');
    expect([...(got?.data ?? [])]).toEqual(IDAT);
  });

  it('joins IDAT chunks, because a real picture has more than one', () => {
    const many = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ...chunk('IHDR', [0, 0, 0, 2, 0, 0, 0, 2, 8, 2, 0, 0, 0]),
      ...chunk('IDAT', [1, 2, 3]),
      ...chunk('IDAT', [4, 5]),
      ...chunk('IEND', []),
    ]);
    expect([...(encode(many)?.data ?? [])]).toEqual([1, 2, 3, 4, 5]);
  });

  it('walks past the chunks a real editor leaves lying about', () => {
    // `pHYs` and `tEXt` sit between IHDR and IDAT in anything that came out of
    // a screenshot tool, and reading by offset rather than by walking finds
    // the wrong bytes without saying so.
    const got = encode(png({ extra: [...chunk('pHYs', [0, 0, 11, 19, 0, 0, 11, 19, 1]), ...chunk('tEXt', [65, 0, 66])] }));
    expect([...(got?.data ?? [])]).toEqual(IDAT);
  });

  it('carries a palette as an indexed colour space', () => {
    const got = encode(png({ colour: 3, extra: chunk('PLTE', [255, 0, 0, 0, 255, 0]) }));
    expect(got?.space).toBe('[ /Indexed /DeviceRGB 1 <ff000000ff00> ]');
    expect(got?.filter).toContain('/Colors 1');
  });

  it('names grey and colour as the spaces they are', () => {
    expect(encode(png({ colour: 0 }))?.space).toBe('/DeviceGray');
    expect(encode(png({ colour: 2 }))?.space).toBe('/DeviceRGB');
    expect(encode(png({ colour: 2 }))?.filter).toContain('/Colors 3');
  });
});

describe('the pictures it refuses, each for its own reason', () => {
  it('refuses an alpha channel, which a PDF image cannot hold', () => {
    // The refusal that fires most, because a screenshot is usually RGBA.
    // Transparency in a PDF is a second image, and splitting one interleaved
    // stream into two means inflating it.
    expect(encode(png({ colour: 6 }))).toBeNull();
    expect(encode(png({ colour: 4 }))).toBeNull();
  });

  it('refuses a palette with a transparent entry, for the same reason', () => {
    const trns = png({ colour: 3, extra: [...chunk('PLTE', [1, 2, 3]), ...chunk('tRNS', [0])] });
    expect(encode(trns)).toBeNull();
  });

  it('refuses interlacing and any depth but eight', () => {
    expect(encode(png({ interlace: 1 }))).toBeNull();
    expect(encode(png({ depth: 16 }))).toBeNull();
    expect(encode(png({ depth: 4, colour: 3, extra: chunk('PLTE', [1, 2, 3]) }))).toBeNull();
  });

  it('refuses a palette picture with no palette in it', () => {
    expect(encode(png({ colour: 3 }))).toBeNull();
  });

  it('refuses a PNG with no image data at all', () => {
    const empty = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ...chunk('IHDR', [0, 0, 0, 2, 0, 0, 0, 2, 8, 2, 0, 0, 0]),
      ...chunk('IEND', []),
    ]);
    expect(encode(empty)).toBeNull();
  });

  it('refuses a chunk that claims to run past the end of the file', () => {
    const lying = [...png()];
    lying[8] = 0x7f;
    expect(encode(new Uint8Array(lying))).toBeNull();
  });
});

describe('a baseline JPEG, which goes in whole', () => {
  it('hands the file over under DCTDecode without touching it', () => {
    const file = jpeg();
    const got = encode(file);
    expect(got?.filter).toBe('/Filter /DCTDecode');
    expect(got?.data).toBe(file);
    expect(got?.width).toBe(400);
    expect(got?.height).toBe(300);
    expect(got?.space).toBe('/DeviceRGB');
  });

  it('reads the colour space off the component count', () => {
    expect(encode(jpeg(0xc0, 1))?.space).toBe('/DeviceGray');
    expect(encode(jpeg(0xc0, 4))?.space).toBe('/DeviceCMYK');
    expect(encode(jpeg(0xc0, 2))).toBeNull();
  });

  it('refuses a progressive one, which DCTDecode is not defined to read', () => {
    // Most readers cope. A file some readers reject is worse than a line of
    // italics, which is what the refusal falls back to.
    expect(encode(jpeg(0xc2))).toBeNull();
    expect(encode(jpeg(0xc9))).toBeNull();
  });

  it('accepts the extended sequential twin of baseline', () => {
    expect(encode(jpeg(0xc1))).not.toBeNull();
  });
});

describe('everything else', () => {
  it('refuses a GIF, which no PDF filter reads', () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 2, 0, 2, 0]);
    expect(encode(gif)).toBeNull();
  });

  it('refuses bytes that are not a picture at all', () => {
    expect(encode(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(encode(new Uint8Array(0))).toBeNull();
  });
});
