import { describe, expect, it, vi } from 'vitest';
import {
  BUCKET, MAX_BODY_BYTES, SIGNED_URL_SECONDS, handleTrustRoom, type RoomDeps, type RoomRow,
} from '../../../../supabase/functions/_shared/trustroom';

const TOKEN = 'a'.repeat(64);
const ORIGIN = 'https://harrisonjrubin7-cmyk.github.io';

const HECVAT: RoomRow = {
  artifact_key: 'hecvat', title: 'HECVAT readiness register', version: '1.0',
  storage_ref: 'trust-packet/hecvat/hecvat-1.0.pdf', source_commit: 'e5fc11d979a962275044cc91393c6186c6b65285',
  packet_commit: 'e5fc11d979a962275044cc91393c6186c6b65285', expires_at: '2026-10-04T12:00:00Z',
};
const PRIVACY: RoomRow = { ...HECVAT, artifact_key: 'privacy-disclosure', title: 'Privacy disclosure', version: '2026-09',
  storage_ref: 'trust-packet/privacy-disclosure/2026-09.pdf' };

function deps(over: Partial<RoomDeps> = {}): RoomDeps & { open: ReturnType<typeof vi.fn>; sign: ReturnType<typeof vi.fn> } {
  return {
    open: vi.fn(async (_t: string, a: string | null) => (a === null ? [HECVAT, PRIVACY] : a === 'hecvat' ? [HECVAT] : [])),
    sign: vi.fn(async () => 'https://project.supabase.co/storage/v1/object/sign/trust-packet/hecvat/hecvat-1.0.pdf?token=x'),
    allowedOrigin: ORIGIN,
    ...over,
  } as never;
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://project.supabase.co/functions/v1/trust-room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

async function json(res: Response) {
  return JSON.parse(await res.text());
}

describe('the procurement room file server', () => {
  it('lists what a grant covers, without a single storage path', async () => {
    const d = deps();
    const res = await handleTrustRoom(post({ token: TOKEN }), d);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.items.map((i: { artifact: string }) => i.artifact)).toEqual(['hecvat', 'privacy-disclosure']);
    expect(body.packet_commit).toBe(HECVAT.packet_commit);
    expect(JSON.stringify(body)).not.toContain('trust-packet/');
    expect(d.open).toHaveBeenCalledWith(TOKEN, null);
    expect(d.sign).not.toHaveBeenCalled();
  });

  it('opens one document as a one-minute signed URL into the private bucket', async () => {
    const d = deps();
    const res = await handleTrustRoom(post({ token: TOKEN, artifact: 'hecvat' }), d);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(d.sign).toHaveBeenCalledWith(BUCKET, 'hecvat/hecvat-1.0.pdf', SIGNED_URL_SECONDS);
    expect(SIGNED_URL_SECONDS).toBe(60);
    expect(body).toMatchObject({ artifact: 'hecvat', version: '1.0', url_expires_in: 60 });
    expect(body.url).toMatch(/^https:\/\//);
    expect(body).not.toHaveProperty('storage_ref');
  });

  it('answers a wrong token, a malformed one and an uncovered document identically', async () => {
    const wrong = deps({ open: vi.fn(async () => []) } as never);
    const a = await handleTrustRoom(post({ token: TOKEN }), wrong);
    const d = deps();
    const b = await handleTrustRoom(post({ token: 'not-a-token' }), d);
    const c = await handleTrustRoom(post({ token: TOKEN, artifact: 'architecture' }), d);
    for (const r of [a, b, c]) expect(r.status).toBe(404);
    const bodies = await Promise.all([a, b, c].map((r) => r.text()));
    expect(new Set(bodies).size).toBe(1);
    expect(d.open).toHaveBeenCalledTimes(1); // the malformed token never reached the database
  });

  it('never takes a token in the URL', async () => {
    const d = deps();
    const res = await handleTrustRoom(new Request(`https://x.supabase.co/functions/v1/trust-room?token=${TOKEN}`), d);
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST, OPTIONS');
    expect(d.open).not.toHaveBeenCalled();
  });

  it('refuses bodies that are too large, not JSON, not an object, or carry anything else', async () => {
    const d = deps();
    const big = await handleTrustRoom(post({ token: TOKEN, pad: 'x'.repeat(MAX_BODY_BYTES) }), d);
    expect(big.status).toBe(413);
    const declared = await handleTrustRoom(post({ token: TOKEN }, { 'Content-Length': String(MAX_BODY_BYTES + 1) }), d);
    expect(declared.status).toBe(413);
    expect((await handleTrustRoom(post('{not json'), d)).status).toBe(400);
    expect((await handleTrustRoom(post([TOKEN]), d)).status).toBe(400);
    expect((await handleTrustRoom(post({ token: TOKEN, as: 'admin' }), d)).status).toBe(400);
    expect((await handleTrustRoom(post({ token: TOKEN, artifact: '../secrets' }), d)).status).toBe(400);
    expect(d.open).not.toHaveBeenCalled();
  });

  it('says only "unavailable" when the file is missing from the bucket', async () => {
    const res = await handleTrustRoom(post({ token: TOKEN, artifact: 'hecvat' }), deps({ sign: vi.fn(async () => null) } as never));
    expect(res.status).toBe(503);
    expect(await json(res)).toEqual({ error: 'unavailable' });
  });

  it('refuses to sign a path outside the bucket, even if the database returned one', async () => {
    const d = deps({ open: vi.fn(async () => [{ ...HECVAT, storage_ref: 'other-bucket/secret.pdf' }]) } as never);
    const res = await handleTrustRoom(post({ token: TOKEN, artifact: 'hecvat' }), d);
    expect(res.status).toBe(500);
    expect(d.sign).not.toHaveBeenCalled();
  });

  it('reports its own failures with no detail', async () => {
    const d = deps({ open: vi.fn(async () => { throw new Error('connection to db.internal:5432 refused'); }) } as never);
    const res = await handleTrustRoom(post({ token: TOKEN }), d);
    expect(res.status).toBe(500);
    expect(await res.text()).toBe('{"error":"server_error"}');
  });

  it('is never cached, never leaks a referrer, and answers only the allowed origin', async () => {
    const d = deps();
    const cases = [
      post({ token: TOKEN }), post({ token: TOKEN, artifact: 'hecvat' }), post({ token: 'x' }),
      new Request('https://x/', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), new Request('https://x/'),
    ];
    for (const req of cases) {
      const res = await handleTrustRoom(req, d);
      expect(res.headers.get('Cache-Control'), req.method).toBe('no-store');
      expect(res.headers.get('Referrer-Policy'), req.method).toBe('no-referrer');
      // Echoed to the allowed origin; a request with no Origin is no browser
      // and gets no CORS header at all (`_shared/cors.ts` fails closed).
      expect(res.headers.get('Access-Control-Allow-Origin'), req.method).toBe(req.headers.get('Origin') ? ORIGIN : null);
    }
    const elsewhere = await handleTrustRoom(post({ token: TOKEN }, { Origin: 'https://evil.example' }), d);
    expect(elsewhere.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const preflight = await handleTrustRoom(new Request('https://x/', { method: 'OPTIONS' }), d);
    expect(preflight.status).toBe(204);
  });
});
