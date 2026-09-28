/**
 * Stripping location and device metadata from uploads, before they leave.
 *
 * A phone photo carries the GPS fix it was taken at in its EXIF block. Posting
 * a picture of a dorm-room desk can publish the dorm. So an image is rewritten
 * on the device with every metadata segment removed, and anything that is not
 * a JPEG, PNG or WebP we can parse is refused rather than passed through:
 * an upload path that "usually" strips is not a control.
 *
 * What survives is only what is needed to draw the picture: for JPEG the
 * quantisation, Huffman, frame and scan segments plus APP0 (JFIF) and APP14
 * (Adobe colour transform); for PNG the critical chunks plus colour-space
 * chunks; for WebP the image chunks, with the EXIF/XMP flags cleared.
 */

export type ImageKind = 'jpeg' | 'png' | 'webp';

export class UnsupportedUpload extends Error {}

export function sniff(bytes: Uint8Array): ImageKind | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG') return 'png';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp';
  return null;
}

function ascii(b: Uint8Array, at: number, n: number): string {
  return String.fromCharCode(...b.subarray(at, at + n));
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function stripJpeg(b: Uint8Array): Uint8Array {
  const keep: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) throw new UnsupportedUpload('Malformed JPEG');
    const marker = b[i + 1];
    // Start of scan: the rest is entropy-coded image data through EOI.
    if (marker === 0xda) {
      keep.push(b.subarray(i));
      return concat(keep);
    }
    if (marker === 0xd9) {
      keep.push(b.subarray(i, i + 2));
      return concat(keep);
    }
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2 || i + 2 + len > b.length) throw new UnsupportedUpload('Malformed JPEG');
    const segment = b.subarray(i, i + 2 + len);
    const isApp = marker >= 0xe0 && marker <= 0xef;
    const isComment = marker === 0xfe;
    const keepApp = marker === 0xe0 || marker === 0xee;
    if ((!isApp && !isComment) || keepApp) keep.push(segment);
    i += 2 + len;
  }
  throw new UnsupportedUpload('JPEG ended without image data');
}

const PNG_KEEP = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT', 'pHYs']);

function stripPng(b: Uint8Array): Uint8Array {
  const keep: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    const type = ascii(b, i + 4, 4);
    const end = i + 12 + len;
    if (end > b.length) throw new UnsupportedUpload('Malformed PNG');
    if (PNG_KEEP.has(type)) keep.push(b.subarray(i, end));
    i = end;
    if (type === 'IEND') return concat(keep);
  }
  throw new UnsupportedUpload('PNG ended without IEND');
}

function stripWebp(b: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const type = ascii(b, i, 4);
    const len = (b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24)) >>> 0;
    const end = i + 8 + len + (len & 1);
    if (i + 8 + len > b.length) throw new UnsupportedUpload('Malformed WebP');
    if (type !== 'EXIF' && type !== 'XMP ') {
      const chunk = b.slice(i, Math.min(end, b.length));
      // VP8X flags: bit 3 = EXIF present, bit 2 = XMP present.
      if (type === 'VP8X') chunk[8] &= ~0b1100;
      chunks.push(chunk);
    }
    i = end;
  }
  const body = concat(chunks);
  const header = new Uint8Array(12);
  header.set(b.subarray(0, 12));
  const size = body.length + 4;
  header[4] = size & 0xff;
  header[5] = (size >> 8) & 0xff;
  header[6] = (size >> 16) & 0xff;
  header[7] = (size >>> 24) & 0xff;
  return concat([header, body]);
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** The upload with its metadata removed, or a refusal. Never the original bytes. */
export function stripMetadata(bytes: Uint8Array): { kind: ImageKind; bytes: Uint8Array } {
  if (bytes.length > MAX_UPLOAD_BYTES) throw new UnsupportedUpload('File is larger than 10 MB');
  const kind = sniff(bytes);
  if (kind === 'jpeg') return { kind, bytes: stripJpeg(bytes) };
  if (kind === 'png') return { kind, bytes: stripPng(bytes) };
  if (kind === 'webp') return { kind, bytes: stripWebp(bytes) };
  throw new UnsupportedUpload('Only JPEG, PNG and WebP images can be shared in Community');
}
