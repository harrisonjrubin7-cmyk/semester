import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  differenceHash,
  dimensions,
  handle,
  hammingDistance,
  metadataFound,
  scanOne,
  sniff,
  type Decoded,
  type Deps,
} from '../../../supabase/functions/_shared/mediascan';
import { MAX_UPLOAD_BYTES } from '../community/metadata';

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)));
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le32 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const le24 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255];

/** A JPEG with a JFIF header, an optional segment, a baseline frame of w×h, and a scan. */
function jpeg(w: number, h: number, extra: number[] = []) {
  return bytes(
    [0xff, 0xd8],
    [0xff, 0xe0, 0x00, 0x10], 'JFIF', [0, 1, 1, 0, 0, 1, 0, 1, 0, 0],
    extra,
    [0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1],
    [0xff, 0xda, 0x00, 0x0c, 3, 1, 0, 2, 0x11, 3, 0x11, 0, 0x3f, 0],
    [0x12, 0x34],
    [0xff, 0xd9],
  );
}
const exifSegment = [0xff, 0xe1, 0x00, 0x08, ...[...'Exif'].map((c) => c.charCodeAt(0)), 0, 0];

function png(w: number, h: number, chunks: number[] = []) {
  return bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a], be32(13), 'IHDR', be32(w), be32(h), [8, 2, 0, 0, 0], [0, 0, 0, 0],
    chunks, be32(0), 'IEND', [0, 0, 0, 0]);
}
const textChunk = [...be32(4), ...[...'tEXtGPS!'].map((c) => c.charCodeAt(0)), 0, 0, 0, 0];

function webp(w: number, h: number, extra: number[] = []) {
  const vp8x = [...[...'VP8X'].map((c) => c.charCodeAt(0)), ...le32(10), 0, 0, 0, 0, ...le24(w - 1), ...le24(h - 1)];
  const body = [...[...'WEBP'].map((c) => c.charCodeAt(0)), ...vp8x, ...extra];
  return bytes('RIFF', le32(body.length), body);
}
const exifChunk = [...[...'EXIF'].map((c) => c.charCodeAt(0)), ...le32(2), 1, 2];

function gradient(w: number, h: number, flip = false): Decoded {
  const gray = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) gray[y * w + x] = Math.round(((flip ? w - 1 - x : x) / (w - 1)) * 200 + (y % 7));
  return { width: w, height: h, gray };
}

describe('reading the facts from the bytes', () => {
  it('knows a JPEG, a PNG and a WebP by their first bytes, and nothing else', () => {
    expect(sniff(jpeg(10, 10))).toBe('jpeg');
    expect(sniff(png(10, 10))).toBe('png');
    expect(sniff(webp(10, 10))).toBe('webp');
    expect(sniff(bytes('GIF89a'))).toBeNull();
    expect(sniff(bytes('<svg>'))).toBeNull();
  });

  it('reads dimensions from each format\'s own header', () => {
    expect(dimensions(jpeg(640, 480), 'jpeg')).toEqual({ width: 640, height: 480 });
    expect(dimensions(png(1200, 900), 'png')).toEqual({ width: 1200, height: 900 });
    expect(dimensions(webp(300, 200), 'webp')).toEqual({ width: 300, height: 200 });
  });

  it('finds metadata that survived, in every format', () => {
    expect(metadataFound(jpeg(10, 10), 'jpeg')).toBe(false);
    expect(metadataFound(jpeg(10, 10, exifSegment), 'jpeg')).toBe(true);
    expect(metadataFound(png(10, 10), 'png')).toBe(false);
    expect(metadataFound(png(10, 10, textChunk), 'png')).toBe(true);
    expect(metadataFound(webp(10, 10), 'webp')).toBe(false);
    expect(metadataFound(webp(10, 10, exifChunk), 'webp')).toBe(true);
  });
});

describe('the difference hash', () => {
  it('is 16 hex digits', () => {
    expect(differenceHash(gradient(90, 80))).toMatch(/^[0-9a-f]{16}$/);
  });

  it('barely moves when the same picture is resized', () => {
    expect(hammingDistance(differenceHash(gradient(90, 80)), differenceHash(gradient(360, 320)))).toBeLessThanOrEqual(8);
  });

  it('moves a long way for a different picture', () => {
    expect(hammingDistance(differenceHash(gradient(90, 80)), differenceHash(gradient(90, 80, true)))).toBeGreaterThan(8);
  });

  it('counts bits the way the database does', () => {
    expect(hammingDistance('f0f0f0f0f0f0f0f0', 'f0f0f0f0f0f0f0f7')).toBe(3);
    expect(hammingDistance('0000000000000000', 'ffffffffffffffff')).toBe(64);
  });
});

const clearProvider = { name: 'test', check: vi.fn(async () => 'clear' as const) };
const decode = async () => gradient(90, 80);

describe('one scan', () => {
  it('reports exactly the verdict the database reads', async () => {
    const v = await scanOne(jpeg(640, 480), { knownAbuse: clearProvider, classifier: null, decode });
    expect(Object.keys(v).sort()).toEqual(
      ['bytes', 'classifier', 'detected_kind', 'height', 'known_abuse', 'metadata_found', 'phash', 'scan_version', 'sha256', 'width'].sort(),
    );
    expect(v).toMatchObject({ detected_kind: 'jpeg', width: 640, height: 480, metadata_found: false, known_abuse: 'clear' });
    expect(v.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('will not scan without a known-abuse provider', async () => {
    await expect(scanOne(jpeg(10, 10), { knownAbuse: null, classifier: null, decode })).rejects.toThrow(/known-abuse/);
  });

  it('checks known abuse on bytes that are not even an image, and reports no type', async () => {
    const check = vi.fn(async () => 'clear' as const);
    const v = await scanOne(bytes('<svg onload=x>'), { knownAbuse: { name: 't', check }, classifier: null, decode });
    expect(check).toHaveBeenCalled();
    expect(v.detected_kind).toBeNull();
  });

  it('reports no type for an image that will not decode', async () => {
    const v = await scanOne(jpeg(10, 10), { knownAbuse: clearProvider, classifier: null, decode: async () => { throw new Error('bad'); } });
    expect(v.detected_kind).toBeNull();
  });

  it('never sends a known-abuse match on to a classifier', async () => {
    const classify = vi.fn(async () => ({ label: 'none', confidence: 0.1 }));
    const v = await scanOne(jpeg(10, 10), {
      knownAbuse: { name: 't', check: async () => 'match' as const },
      classifier: { name: 'c', classify },
      decode,
    });
    expect(v.known_abuse).toBe('match');
    expect(classify).not.toHaveBeenCalled();
  });
});

function deps(patch: Partial<Deps> = {}): Deps {
  return {
    secret: 's3cret',
    knownAbuse: clearProvider,
    classifier: null,
    take: vi.fn(async () => [{ media_id: 'm1', object_path: 'media/m1', declared_kind: 'jpeg', tenant_id: 'vu' }]),
    download: vi.fn(async () => jpeg(640, 480)),
    decode,
    record: vi.fn(async () => 'clear'),
    takeDeletions: vi.fn(async () => ['media/old']),
    deleteObjects: vi.fn(async () => {}),
    markDeleted: vi.fn(async () => {}),
    ...patch,
  };
}
const req = (auth?: string) => new Request('https://x/scan', { method: 'POST', headers: auth ? { Authorization: auth } : {} });

describe('the handler', () => {
  it('refuses everything while its secret is unset, or with the wrong one', async () => {
    const d = deps({ secret: '' });
    expect((await handle(req('Bearer '), d)).status).toBe(503);
    expect((await handle(req('Bearer nope'), deps())).status).toBe(401);
    expect(d.take).not.toHaveBeenCalled();
  });

  it('claims nothing without a known-abuse provider', async () => {
    const d = deps({ knownAbuse: null });
    expect((await handle(req('Bearer s3cret'), d)).status).toBe(503);
    expect(d.take).not.toHaveBeenCalled();
  });

  it('scans, records, deletes what is queued, and reports counts only', async () => {
    const d = deps();
    const body = await (await handle(req('Bearer s3cret'), d)).json();
    expect(d.record).toHaveBeenCalledWith('m1', expect.objectContaining({ detected_kind: 'jpeg', known_abuse: 'clear' }));
    expect(d.deleteObjects).toHaveBeenCalledWith(['media/old']);
    expect(d.markDeleted).toHaveBeenCalledWith(['media/old']);
    expect(body).toEqual({ scanned: 1, deleted: 1, clear: 1 });
    expect(JSON.stringify(body)).not.toMatch(/m1|media\//);
  });

  it('leaves an image it could not read for the next run', async () => {
    const d = deps({ download: vi.fn(async () => { throw new Error('gone'); }) });
    const body = await (await handle(req('Bearer s3cret'), d)).json();
    expect(d.record).not.toHaveBeenCalled();
    expect(body.retry).toBe(1);
  });
});

describe('in step with the database and the app', () => {
  const sql = readFileSync(new URL('../../../supabase/migrations/20260928032000_community.sql', import.meta.url), 'utf8');
  const record = sql.slice(sql.indexOf('create or replace function public.record_media_scan('));

  it('the verdict keys are the ones record_media_scan reads', () => {
    const read = [...record.slice(0, record.indexOf('end $$;')).matchAll(/want_verdict(?:->'classifier')?->>'([a-z0-9_]+)'/g)].map((m) => m[1]);
    for (const key of ['detected_kind', 'bytes', 'width', 'height', 'sha256', 'phash', 'known_abuse', 'metadata_found', 'scan_version', 'label', 'confidence']) {
      expect(read, key).toContain(key);
    }
  });

  it('the size limit is the app\'s, the bucket\'s and the database\'s', () => {
    expect(record).toContain(`v_bytes > ${MAX_UPLOAD_BYTES}`);
    expect(sql).toContain(`'community-media', false, ${MAX_UPLOAD_BYTES}`);
  });
});
