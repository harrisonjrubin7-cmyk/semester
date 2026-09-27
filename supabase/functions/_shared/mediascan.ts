/**
 * The media scanner: reads a Community image the author uploaded and reports
 * facts about it to `record_media_scan`, which decides (migration section 16).
 *
 * The facts, each computed here from the bytes, never taken from the client:
 *
 *   - **What it really is** — JPEG, PNG or WebP by its first bytes, whatever
 *     it was declared as.
 *   - **Whether metadata survived** — EXIF, XMP, Photoshop blocks, comments
 *     and text chunks. The app strips them on the device first; this is the
 *     check that it did.
 *   - **Size and dimensions**, read from the image's own header.
 *   - **SHA-256**, and a **64-bit difference hash** of a 9×8 greyscale
 *     thumbnail, so a re-upload of a removed image is caught when it has been
 *     re-encoded, resized or lightly cropped.
 *   - **A known-abuse hash check,** from a provider configured on the
 *     function. There is no default: without one this scanner refuses to run,
 *     and the database refuses to clear an image without its answer. So until
 *     somebody with the right agreement configures one, nothing publishes.
 *   - **A classifier's label**, if a school has one. Optional.
 *
 * Like the escalation adapter, this is not yet a deployed function: in this
 * repository a directory under `supabase/functions/` is a deployed function,
 * and switching on images for students is a decision with legal review
 * behind it, not a side effect of a merge. `docs/COMMUNITY-MEDIA-SAFETY.md`
 * has the `index.ts` and the steps. Everything is injected so it is tested
 * without a network, a bucket or Deno.
 */

export type ImageKind = 'jpeg' | 'png' | 'webp';

/** The database's verdict vocabulary: exactly what record_media_scan reads. */
export interface Verdict {
  detected_kind: ImageKind | null;
  bytes: number;
  width: number | null;
  height: number | null;
  sha256: string;
  phash: string;
  metadata_found: boolean;
  known_abuse: 'clear' | 'match';
  classifier: { label: string; confidence: number } | null;
  scan_version: string;
}

export const SCAN_VERSION = 'media-scan-2026.09.1';

/** A known-abuse hash service. Gets the bytes and their SHA-256; says match or clear. */
export interface KnownAbuseProvider {
  name: string;
  check(bytes: Uint8Array, sha256: string): Promise<'clear' | 'match'>;
}

/** An optional classifier. Labels the database acts on: sexual_explicit, graphic_violence, self_harm. */
export interface Classifier {
  name: string;
  classify(bytes: Uint8Array): Promise<{ label: string; confidence: number } | null>;
}

/** Greyscale pixels, one byte each, row by row. */
export interface Decoded {
  width: number;
  height: number;
  gray: Uint8Array;
}

export interface ScanJob {
  media_id: string;
  object_path: string;
  declared_kind: string;
  tenant_id: string;
}

export interface Deps {
  /** MEDIA_SCAN_CRON_SECRET. Empty means the scanner refuses everything. */
  secret: string;
  knownAbuse: KnownAbuseProvider | null;
  classifier: Classifier | null;
  take: () => Promise<ScanJob[]>;
  download: (path: string) => Promise<Uint8Array>;
  decode: (bytes: Uint8Array, kind: ImageKind) => Promise<Decoded>;
  record: (mediaId: string, verdict: Verdict) => Promise<string>;
  takeDeletions: () => Promise<string[]>;
  deleteObjects: (paths: string[]) => Promise<void>;
  markDeleted: (paths: string[]) => Promise<void>;
}

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));
const u16be = (b: Uint8Array, at: number) => (b[at] << 8) | b[at + 1];
const u32be = (b: Uint8Array, at: number) => ((b[at] << 24) >>> 0) + (b[at + 1] << 16) + (b[at + 2] << 8) + b[at + 3];
const u24le = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);

export function sniff(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG') return 'png';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp';
  return null;
}

/** JPEG segments up to the start of scan: marker and payload offset. */
function* jpegSegments(b: Uint8Array): Generator<{ marker: number; at: number; length: number }> {
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return;
    const marker = b[i + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    const length = u16be(b, i + 2);
    yield { marker, at: i + 4, length: length - 2 };
    if (marker === 0xda) return;
    i += 2 + length;
  }
}

function* pngChunks(b: Uint8Array): Generator<{ type: string; at: number; length: number }> {
  let i = 8;
  while (i + 8 <= b.length) {
    const length = u32be(b, i);
    const type = ascii(b, i + 4, 4);
    yield { type, at: i + 8, length };
    if (type === 'IEND') return;
    i += 12 + length;
  }
}

function* webpChunks(b: Uint8Array): Generator<{ type: string; at: number; length: number }> {
  let i = 12;
  while (i + 8 <= b.length) {
    const type = ascii(b, i, 4);
    const length = b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24);
    yield { type, at: i + 8, length };
    i += 8 + length + (length % 2);
  }
}

/**
 * Whether anything beyond what is needed to draw the picture survived:
 * JPEG APP1 (EXIF/XMP), APP13 (Photoshop), comments; PNG eXIf and text
 * chunks and timestamps; WebP EXIF and XMP chunks.
 */
export function metadataFound(bytes: Uint8Array, kind: ImageKind): boolean {
  if (kind === 'jpeg') {
    for (const s of jpegSegments(bytes)) if (s.marker === 0xe1 || s.marker === 0xed || s.marker === 0xfe) return true;
    return false;
  }
  if (kind === 'png') {
    for (const c of pngChunks(bytes)) if (['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'].includes(c.type)) return true;
    return false;
  }
  for (const c of webpChunks(bytes)) if (c.type === 'EXIF' || c.type === 'XMP ') return true;
  return false;
}

/** Width and height from the image's own header, or null if it has none. */
export function dimensions(bytes: Uint8Array, kind: ImageKind): { width: number; height: number } | null {
  if (kind === 'png') {
    const ihdr = pngChunks(bytes).next().value;
    return ihdr && ihdr.type === 'IHDR' ? { width: u32be(bytes, ihdr.at), height: u32be(bytes, ihdr.at + 4) } : null;
  }
  if (kind === 'jpeg') {
    for (const s of jpegSegments(bytes)) {
      // Start-of-frame markers, less DHT (C4), JPG (C8) and DAC (CC).
      if (s.marker >= 0xc0 && s.marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(s.marker)) {
        return { height: u16be(bytes, s.at + 1), width: u16be(bytes, s.at + 3) };
      }
    }
    return null;
  }
  for (const c of webpChunks(bytes)) {
    if (c.type === 'VP8X') return { width: u24le(bytes, c.at + 4) + 1, height: u24le(bytes, c.at + 7) + 1 };
    if (c.type === 'VP8 ') return { width: u16le(bytes, c.at + 6) & 0x3fff, height: u16le(bytes, c.at + 8) & 0x3fff };
    if (c.type === 'VP8L') {
      const v = bytes[c.at + 1] | (bytes[c.at + 2] << 8) | (bytes[c.at + 3] << 16) | (bytes[c.at + 4] << 24);
      return { width: (v & 0x3fff) + 1, height: ((v >>> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}
const u16le = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as ArrayBuffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * A difference hash: shrink to 9×8 by averaging, then one bit per pixel for
 * whether it is brighter than its right-hand neighbour. Survives re-encoding,
 * resizing and small edits; 16 hex digits, as the database reads it.
 */
export function differenceHash(img: Decoded): string {
  const { width: w, height: h, gray } = img;
  if (w < 1 || h < 1 || gray.length < w * h) throw new Error('not an image');
  const cells = new Float64Array(9 * 8);
  for (let cy = 0; cy < 8; cy++) {
    const y0 = Math.floor((cy * h) / 8);
    const y1 = Math.max(y0 + 1, Math.floor(((cy + 1) * h) / 8));
    for (let cx = 0; cx < 9; cx++) {
      const x0 = Math.floor((cx * w) / 9);
      const x1 = Math.max(x0 + 1, Math.floor(((cx + 1) * w) / 9));
      let sum = 0;
      let n = 0;
      for (let y = y0; y < y1 && y < h; y++) {
        for (let x = x0; x < x1 && x < w; x++) {
          sum += gray[y * w + x];
          n++;
        }
      }
      cells[cy * 9 + cx] = n ? sum / n : 0;
    }
  }
  let hex = '';
  for (let cy = 0; cy < 8; cy++) {
    let byte = 0;
    for (let cx = 0; cx < 8; cx++) byte = (byte << 1) | (cells[cy * 9 + cx] > cells[cy * 9 + cx + 1] ? 1 : 0);
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

/** Bits that differ between two hashes — what the database compares against 8. */
export function hammingDistance(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < 16; i += 2) {
    let x = parseInt(a.slice(i, i + 2), 16) ^ parseInt(b.slice(i, i + 2), 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

/**
 * Everything about one image, for the database to decide on. An image that
 * cannot be decoded is reported with no type, so the database rejects it; the
 * known-abuse check still runs on its bytes first, whatever it turns out to be.
 */
export async function scanOne(bytes: Uint8Array, deps: Pick<Deps, 'knownAbuse' | 'classifier' | 'decode'>): Promise<Verdict> {
  if (!deps.knownAbuse) throw new Error('no known-abuse provider');
  const sha256 = await sha256Hex(bytes);
  const known = await deps.knownAbuse.check(bytes, sha256);
  const kind = sniff(bytes);
  let phash = '0000000000000000';
  let dims: { width: number; height: number } | null = null;
  let detected: ImageKind | null = kind;
  if (kind) {
    dims = dimensions(bytes, kind);
    try {
      phash = differenceHash(await deps.decode(bytes, kind));
    } catch {
      detected = null;
    }
  }
  const classifier = known === 'clear' && detected && deps.classifier ? await deps.classifier.classify(bytes) : null;
  return {
    detected_kind: detected,
    bytes: bytes.length,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
    sha256,
    phash,
    metadata_found: kind ? metadataFound(bytes, kind) : false,
    known_abuse: known,
    classifier,
    scan_version: SCAN_VERSION,
  };
}

function sameSecret(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** The request handler: bearer secret, a known-abuse provider, then what is waiting. */
export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (!deps.secret) return new Response('not configured', { status: 503 });
  if (!sameSecret(req.headers.get('Authorization') ?? '', `Bearer ${deps.secret}`)) {
    return new Response('no', { status: 401 });
  }
  // Refuse before claiming anything: an image must never be decided without it.
  if (!deps.knownAbuse) return new Response('no known-abuse provider configured', { status: 503 });

  const outcome: Record<string, number> = {};
  const jobs = await deps.take();
  for (const job of jobs) {
    try {
      const verdict = await scanOne(await deps.download(job.object_path), deps);
      const result = await deps.record(job.media_id, verdict);
      outcome[result] = (outcome[result] ?? 0) + 1;
    } catch {
      // Left for the claim to lapse and the next run to try again.
      outcome.retry = (outcome.retry ?? 0) + 1;
    }
  }

  const doomed = await deps.takeDeletions();
  if (doomed.length) {
    await deps.deleteObjects(doomed);
    await deps.markDeleted(doomed);
  }
  // Counts only: no ids, no paths, nothing about an image.
  return Response.json({ scanned: jobs.length, deleted: doomed.length, ...outcome });
}
