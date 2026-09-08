import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { LEVEL, qrMatrix, qrSvg, versionFor } from './qr';

/**
 * Encoded here, decoded by something that did not write it.
 *
 * A QR code is the one output in this project nobody can check by eye. Asserting
 * that a 41×41 grid "looks right" would assert nothing, and a code that encodes
 * half a URL scans perfectly and takes you nowhere — the failure would reach a
 * phone before it reached a test. So every case below goes through `jsqr`, a dev
 * dependency that never ships, and is judged on what comes back out.
 */

/** The matrix as the pixel buffer a decoder expects, at four pixels a module. */
function pixels(matrix: boolean[][], scale = 4, quiet = 4) {
  const side = (matrix.length + quiet * 2) * scale;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const r = Math.floor(y / scale) - quiet;
      const c = Math.floor(x / scale) - quiet;
      const dark = r >= 0 && c >= 0 && r < matrix.length && c < matrix.length && matrix[r][c];
      if (!dark) continue;
      const at = (y * side + x) * 4;
      data[at] = data[at + 1] = data[at + 2] = 0;
    }
  }
  return { data, width: side, height: side };
}

function roundTrip(text: string): string | null {
  const { data, width, height } = pixels(qrMatrix(text));
  return jsQR(data, width, height)?.data ?? null;
}

describe('a QR code that a scanner can actually read', () => {
  it('round-trips a real feed link', () => {
    // The thing this exists for: 120-odd characters nobody will retype.
    const url =
      'webcal://lzrqvlugnawcgywkhqlz.supabase.co/functions/v1/calendar/' +
      '7f3a91c25de84b06a1f9c3е'.replace(/[^0-9a-f]/g, '').padEnd(48, 'a');
    expect(roundTrip(url)).toBe(url);
  });

  it('round-trips the shortest thing worth encoding', () => {
    expect(roundTrip('hi')).toBe('hi');
  });

  it('round-trips across every version it claims to support', () => {
    // One string per version boundary, so a broken block or interleaving table
    // for a single version cannot hide behind the others.
    for (let v = 1; v <= 10; v += 1) {
      const bytes = versionFor(1) === v ? 1 : capacityOf(v);
      const text = 'x'.repeat(bytes);
      expect(versionFor(bytes), `version for ${bytes} bytes`).toBe(v);
      expect(roundTrip(text), `version ${v}`).toBe(text);
    }
  });

  it('round-trips text that is not ASCII', () => {
    // Byte mode is UTF-8, and the length header counts bytes rather than
    // characters — an easy thing to get wrong and never notice in English.
    const text = 'Semester — ECON 1020 · Vörös';
    expect(roundTrip(text)).toBe(text);
  });

  it('picks the smallest version that fits', () => {
    expect(versionFor(1)).toBe(1);
    expect(versionFor(14)).toBe(1);
    expect(versionFor(15)).toBe(2);
    expect(versionFor(200)).toBe(10);
  });

  it('refuses what it cannot hold rather than truncating it', () => {
    // The one failure that would not look like a failure: a code holding half
    // a URL scans cleanly and goes somewhere wrong.
    expect(versionFor(500)).toBeNull();
    expect(() => qrMatrix('x'.repeat(500))).toThrow(/more than a version 10/);
  });
});

/** The largest byte payload a given version holds, at this level. */
function capacityOf(v: number): number {
  for (let n = 1; n < 300; n += 1) if (versionFor(n) === v) return n;
  throw new Error(`no payload lands on version ${v}`);
}

describe('the SVG it renders to', () => {
  it('is one path, not one element per module', () => {
    // A version 6 code is 41×41. Sixteen hundred elements is a layout cost on
    // every render of the Export screen.
    const svg = qrSvg('https://example.test/feed');
    expect(svg.match(/<path/g)).toHaveLength(1);
    expect(svg).not.toMatch(/<rect[^>]*fill="#000"/);
  });

  it('carries a quiet zone, which is not decoration', () => {
    // Many scanners refuse a code butted against the edge of its container.
    const svg = qrSvg('https://example.test/feed');
    const box = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
    const modules = qrMatrix('https://example.test/feed').length;
    expect(Number(box?.[1])).toBe(modules + 8);
  });

  it('declares the namespace, so it works as a standalone file too', () => {
    expect(qrSvg('x')).toContain('xmlns="http://www.w3.org/2000/svg"');
  });
});

describe('what it is and is not', () => {
  it('is level M throughout', () => {
    // Stated so a change to the tables has to change this too.
    expect(LEVEL).toBe('M');
  });
});

describe('agreement with a reference implementation', () => {
  /*
   * The check that found the bug, and the shape it has to take.
   *
   * Round-tripping through a decoder proves a code is readable. For a long time
   * this encoder produced something no decoder would read while every check
   * written against its own logic passed — the data, the error correction, the
   * mask and both format copies all agreed with each other and were wrong
   * together. It took an implementation that shares no line with this one to
   * say so.
   *
   * What is asserted is that both encoders produce something that decodes to
   * the same text, not that they produce the same matrix. They often do not,
   * and that is correct: which of the eight masks gets used is chosen by a
   * penalty heuristic, so two conforming encoders can disagree on the mask and
   * both be right. Demanding identical modules would be testing that this file
   * shares a tie-breaker with `qrcode-generator`, which is not a property worth
   * having.
   *
   * Decoding the reference's own output in the same harness is what keeps the
   * check honest: if the harness were broken, that line would fail too.
   */
  const reference = async (text: string) => {
    const { default: qrcode } = await import('qrcode-generator');
    const version = versionFor(new TextEncoder().encode(text).length);
    const q = qrcode(version as never, 'M');
    q.addData(text, 'Byte');
    q.make();
    const n = q.getModuleCount();
    return Array.from({ length: n }, (_, r) =>
      Array.from({ length: n }, (_, c) => q.isDark(r, c)),
    );
  };

  /*
   * ASCII only, and that is the reference's limit rather than this encoder's.
   * `qrcode-generator`'s byte mode is latin-1 unless a global is reassigned,
   * so a "·" comes back mangled from *its* side. Rather than mutate shared
   * state inside a test to work around it, the non-ASCII case is covered by the
   * round-trip above, which is the check that matters for it. The feed URL —
   * the only payload this ships with — is ASCII.
   */
  it.each([
    'hi',
    'ECON 1020 Problem Set 1',
    'https://example.test/functions/v1/calendar/' + 'a'.repeat(48),
    'x'.repeat(200),
  ])('agrees with the reference on %j', async (text) => {
    const theirs = await reference(text);
    const decodeOf = (m: boolean[][]) => {
      const { data, width, height } = pixels(m);
      return jsQR(data, width, height)?.data ?? null;
    };
    // Same size — the version choice is not a matter of taste.
    expect(qrMatrix(text).length).toBe(theirs.length);
    // And both read back as the text, in the same harness.
    expect(decodeOf(theirs)).toBe(text);
    expect(decodeOf(qrMatrix(text))).toBe(text);
  });
});
