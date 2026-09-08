/**
 * A QR code, for putting the calendar link on a phone.
 *
 * The feed link is 120-odd characters of hex nobody is going to retype, and
 * the device that wants it is usually the phone sitting next to the laptop.
 * A camera solves that in two seconds.
 *
 * ## Why this is written out rather than installed
 *
 * The same reason `lib/pptx.ts` writes OOXML and `lib/export.ts` writes its own
 * `VCALENDAR`: the input is one known shape, the output is a bitmap, and the
 * whole thing is a pure function that can be tested against a real decoder.
 * `qr.test.ts` encodes and then decodes with `jsqr` — a dev dependency that
 * never ships — so this is checked by something that did not write it, which is
 * the only check worth having for a format nobody can read by eye.
 *
 * ## What it does and does not do
 *
 * Byte mode, error correction level M, versions 1 to 10. That is up to 213
 * bytes, against the ~120 a feed URL needs, with room for a longer host. It is
 * not a general QR library: no kanji mode, no numeric or alphanumeric packing
 * (which would only shrink the code, never enable one), no structured append.
 * Anything longer than version 10 throws rather than silently truncating —
 * a QR that encodes half a URL scans perfectly and takes you nowhere.
 */

/** The error-correction level this uses throughout. M is the usual default. */
export const LEVEL = 'M';

/** Data codewords, EC codewords per block, and block counts, for level M. */
const VERSIONS: Record<number, { total: number; ecPerBlock: number; groups: [number, number][] }> = {
  // version: total data codewords, EC codewords per block, [blocks, data per block][]
  1: { total: 16, ecPerBlock: 10, groups: [[1, 16]] },
  2: { total: 28, ecPerBlock: 16, groups: [[1, 28]] },
  3: { total: 44, ecPerBlock: 26, groups: [[1, 44]] },
  4: { total: 64, ecPerBlock: 18, groups: [[2, 32]] },
  5: { total: 86, ecPerBlock: 24, groups: [[2, 43]] },
  6: { total: 108, ecPerBlock: 16, groups: [[4, 27]] },
  7: { total: 124, ecPerBlock: 18, groups: [[4, 31]] },
  8: { total: 154, ecPerBlock: 22, groups: [[2, 38], [2, 39]] },
  9: { total: 182, ecPerBlock: 22, groups: [[3, 36], [2, 37]] },
  10: { total: 216, ecPerBlock: 26, groups: [[4, 43], [1, 44]] },
};

/** Where the alignment patterns sit, by version. */
const ALIGN: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

/** The 18-bit version information, for versions 7 and up. */
const VERSION_BITS: Record<number, number> = {
  7: 0x07c94,
  8: 0x085bc,
  9: 0x09a99,
  10: 0x0a4d3,
};

// ── GF(256), the field the error correction lives in ──────────────────────

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    // The primitive polynomial every QR implementation uses.
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
}

function mul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
}

/** The generator polynomial for `n` error-correction codewords. */
function generator(n: number): number[] {
  let poly = [1];
  for (let i = 0; i < n; i += 1) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= poly[j];
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/** The remainder of the data divided by the generator — the EC codewords. */
function ecFor(data: number[], n: number): number[] {
  const gen = generator(n);
  const out = [...data, ...new Array<number>(n).fill(0)];
  for (let i = 0; i < data.length; i += 1) {
    const lead = out[i];
    if (lead === 0) continue;
    for (let j = 0; j < gen.length; j += 1) out[i + j] ^= mul(gen[j], lead);
  }
  return out.slice(data.length);
}

// ── The data, as codewords ────────────────────────────────────────────────

/** The smallest version that holds this much, or nothing if none does. */
export function versionFor(bytes: number): number | null {
  for (let v = 1; v <= 10; v += 1) {
    // Mode (4 bits) + length (8 or 16) + the data itself.
    const header = 4 + (v < 10 ? 8 : 16);
    if (VERSIONS[v].total * 8 >= header + bytes * 8) return v;
  }
  return null;
}

function codewords(text: string, version: number): number[] {
  const data = [...new TextEncoder().encode(text)];
  const bits: number[] = [];
  const push = (value: number, width: number) => {
    for (let i = width - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
  };

  push(0b0100, 4); // byte mode
  push(data.length, version < 10 ? 8 : 16);
  for (const b of data) push(b, 8);

  const capacity = VERSIONS[version].total * 8;
  // Terminator: up to four zero bits, and only as many as there is room for.
  for (let i = 0; i < 4 && bits.length < capacity; i += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    out.push(bits.slice(i, i + 8).reduce((n, b) => (n << 1) | b, 0));
  }
  // The two pad bytes the spec names, alternating, until the version is full.
  const PAD = [0xec, 0x11];
  while (out.length < VERSIONS[version].total) out.push(PAD[(out.length - bits.length / 8) % 2]);
  return out;
}

/**
 * Data and error correction, split into blocks and interleaved.
 *
 * The interleaving is the point of the exercise: a scratch across the code
 * damages one codeword from each block rather than destroying one block
 * outright, and each block can carry its own losses.
 */
function interleave(data: number[], version: number): number[] {
  const { ecPerBlock, groups } = VERSIONS[version];
  const blocks: number[][] = [];
  let at = 0;
  for (const [count, size] of groups) {
    for (let i = 0; i < count; i += 1) {
      blocks.push(data.slice(at, at + size));
      at += size;
    }
  }
  const ec = blocks.map((b) => ecFor(b, ecPerBlock));

  const out: number[] = [];
  const longest = Math.max(...blocks.map((b) => b.length));
  for (let i = 0; i < longest; i += 1) {
    for (const b of blocks) if (i < b.length) out.push(b[i]);
  }
  for (let i = 0; i < ecPerBlock; i += 1) {
    for (const b of ec) out.push(b[i]);
  }
  return out;
}

// ── The matrix ────────────────────────────────────────────────────────────

/** A module is dark, light, or not yet decided. `null` means free. */
type Grid = (boolean | null)[][];

function blank(size: number): Grid {
  return Array.from({ length: size }, () => new Array<boolean | null>(size).fill(null));
}

function putFinder(g: Grid, row: number, col: number): void {
  for (let r = -1; r <= 7; r += 1) {
    for (let c = -1; c <= 7; c += 1) {
      const y = row + r;
      const x = col + c;
      if (y < 0 || y >= g.length || x < 0 || x >= g.length) continue;
      const edge = r === 0 || r === 6 || c === 0 || c === 6;
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      g[y][x] = (r >= 0 && r <= 6 && c >= 0 && c <= 6) && (edge || core);
    }
  }
}

function putAlignment(g: Grid, version: number): void {
  const centres = ALIGN[version];
  for (const r of centres) {
    for (const c of centres) {
      // Not on top of a finder pattern.
      if (g[r][c] !== null) continue;
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          g[r + dr][c + dc] = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
        }
      }
    }
  }
}

function frame(version: number): Grid {
  const size = version * 4 + 17;
  const g = blank(size);
  putFinder(g, 0, 0);
  putFinder(g, 0, size - 7);
  putFinder(g, size - 7, 0);
  putAlignment(g, version);

  // Timing patterns, which is how a scanner works out the module size.
  for (let i = 8; i < size - 8; i += 1) {
    if (g[6][i] === null) g[6][i] = i % 2 === 0;
    if (g[i][6] === null) g[i][6] = i % 2 === 0;
  }
  // The one module that is always dark.
  g[size - 8][8] = true;

  // Reserve the format areas so data placement skips them.
  for (let i = 0; i < 9; i += 1) {
    if (g[8][i] === null) g[8][i] = false;
    if (g[i][8] === null) g[i][8] = false;
  }
  for (let i = 0; i < 8; i += 1) {
    if (g[8][size - 1 - i] === null) g[8][size - 1 - i] = false;
    if (g[size - 1 - i][8] === null) g[size - 1 - i][8] = false;
  }
  // And the version areas, on the versions that carry them.
  if (version >= 7) {
    for (let i = 0; i < 6; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        g[size - 11 + j][i] = false;
        g[i][size - 11 + j] = false;
      }
    }
  }
  return g;
}

/** Which modules the data may be written into: everything still free. */
function place(g: Grid, bits: number[]): void {
  const size = g.length;
  let at = 0;
  let up = true;
  for (let right = size - 1; right > 0; right -= 2) {
    // Column 6 is the vertical timing pattern and is not part of the zigzag.
    if (right === 6) right -= 1;
    for (let step = 0; step < size; step += 1) {
      const row = up ? size - 1 - step : step;
      for (const col of [right, right - 1]) {
        if (g[row][col] !== null) continue;
        g[row][col] = at < bits.length ? bits[at] === 1 : false;
        at += 1;
      }
    }
    up = !up;
  }
}

/** The eight masks, by number. A QR is unreadable without one applied. */
const MASKS: ((r: number, c: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/**
 * How bad a masked code looks, by the spec's four rules.
 *
 * Lower is better. The rules exist to avoid patterns a scanner would mistake
 * for a finder, and long runs it would struggle to sample.
 */
function penalty(m: boolean[][]): number {
  const size = m.length;
  let score = 0;

  // Rule 1: runs of five or more in a row or column.
  for (let i = 0; i < size; i += 1) {
    for (const line of [m[i], m.map((row) => row[i])]) {
      let run = 1;
      for (let j = 1; j < size; j += 1) {
        if (line[j] === line[j - 1]) run += 1;
        else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
      if (run >= 5) score += run - 2;
    }
  }
  // Rule 2: every 2×2 block of one colour.
  for (let r = 0; r < size - 1; r += 1) {
    for (let c = 0; c < size - 1; c += 1) {
      const v = m[r][c];
      if (m[r][c + 1] === v && m[r + 1][c] === v && m[r + 1][c + 1] === v) score += 3;
    }
  }
  // Rule 3: the finder-like 1:1:3:1:1 sequence with four light modules beside it.
  const A = [true, false, true, true, true, false, true, false, false, false, false];
  const B = [false, false, false, false, true, false, true, true, true, false, true];
  const runs = (line: boolean[]) => {
    let hits = 0;
    for (let i = 0; i + 11 <= size; i += 1) {
      const slice = line.slice(i, i + 11);
      if (A.every((v, k) => v === slice[k]) || B.every((v, k) => v === slice[k])) hits += 1;
    }
    return hits;
  };
  for (let i = 0; i < size; i += 1) {
    score += 40 * runs(m[i]);
    score += 40 * runs(m.map((row) => row[i]));
  }
  // Rule 4: how far the balance of dark to light is from half.
  const dark = m.flat().filter(Boolean).length;
  const pct = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

/** The 15-bit format information for level M and a mask, BCH-encoded. */
function formatBits(mask: number): number {
  // 00 is level M's two-bit code.
  let value = (0b00 << 3) | mask;
  let rest = value << 10;
  for (let i = 4; i >= 0; i -= 1) {
    if (rest & (1 << (10 + i))) rest ^= 0b10100110111 << i;
  }
  value = ((value << 10) | rest) ^ 0b101010000010010;
  return value;
}

function putFormat(m: boolean[][], mask: number): void {
  const size = m.length;
  const bits = formatBits(mask);
  /*
   * Most significant bit first along the path, not least.
   *
   * The fifteen bits are conventionally numbered 0–14 from the LSB, and the
   * placement walks them from bit 14 down. Getting this backwards produces a
   * code whose data, error correction and mask are all perfectly correct and
   * which no scanner will read, because the eight modules that disagree are
   * the ones saying which mask was used. It cost eight modules out of 441 and
   * every one of them was in the format areas.
   */
  const on = (i: number) => ((bits >> (14 - i)) & 1) === 1;
  for (let i = 0; i < 6; i += 1) m[8][i] = on(i);
  m[8][7] = on(6);
  m[8][8] = on(7);
  m[7][8] = on(8);
  for (let i = 9; i < 15; i += 1) m[14 - i][8] = on(i);

  /*
   * The second copy is 15 modules split 7 and 8, not 8 and 7.
   *
   * Bits 0–6 run up the column beside the bottom-left finder, and bits 7–14
   * run along row 8 to the right edge. The split is uneven because the module
   * that would have been eighth in the column is the one that is always dark.
   *
   * Getting it wrong is quiet: writing bits 0–7 down the column and 8–14 along
   * the row places fourteen of the fifteen correctly, leaves bit 7 light
   * wherever it lands, and produces a code that looks perfect and decodes to
   * nothing at all.
   */
  for (let i = 0; i < 7; i += 1) m[size - 1 - i][8] = on(i);
  for (let i = 7; i < 15; i += 1) m[8][size - 15 + i] = on(i);
  m[size - 8][8] = true;
}

function putVersion(m: boolean[][], version: number): void {
  if (version < 7) return;
  const size = m.length;
  const bits = VERSION_BITS[version];
  for (let i = 0; i < 18; i += 1) {
    const on = ((bits >> i) & 1) === 1;
    const r = Math.floor(i / 3);
    const c = i % 3;
    m[size - 11 + c][r] = on;
    m[r][size - 11 + c] = on;
  }
}

/**
 * The finished code, as rows of booleans. `true` is a dark module.
 *
 * Throws rather than truncating: a QR holding half a URL scans perfectly and
 * goes nowhere, which is the one failure that would not look like a failure.
 */
export function qrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text).length;
  const version = versionFor(bytes);
  if (!version) {
    throw new Error(`${bytes} bytes is more than a version 10 code holds at level ${LEVEL}.`);
  }

  const bits: number[] = [];
  for (const cw of interleave(codewords(text, version), version)) {
    for (let i = 7; i >= 0; i -= 1) bits.push((cw >> i) & 1);
  }

  const laid = frame(version);
  // A copy of which modules are structure, so masking leaves them alone.
  const fixed = laid.map((row) => row.map((v) => v !== null));
  place(laid, bits);
  const base = laid.map((row) => row.map((v) => v === true));

  let best: boolean[][] | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    const m = base.map((row, r) =>
      row.map((v, c) => (fixed[r][c] ? v : v !== MASKS[mask](r, c))),
    );
    putFormat(m, mask);
    putVersion(m, version);
    const score = penalty(m);
    if (score < bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best as boolean[][];
}

/**
 * The same code as an SVG, sized in modules rather than pixels.
 *
 * One `<path>` of rectangles rather than one element per module: a version 6
 * code is 41×41, and 1,681 elements is a page the browser has to lay out
 * every time the section renders.
 *
 * The quiet zone is four modules on every side, and it is not optional — a
 * code butted against the edge of its container is one many scanners refuse.
 */
export function qrSvg(text: string, quiet = 4): string {
  const m = qrMatrix(text);
  const size = m.length + quiet * 2;
  let d = '';
  for (let r = 0; r < m.length; r += 1) {
    for (let c = 0; c < m.length; c += 1) {
      if (m[r][c]) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
    `<rect width="${size}" height="${size}" fill="#fff"/>` +
    `<path d="${d}" fill="#000"/>` +
    `</svg>`
  );
}
