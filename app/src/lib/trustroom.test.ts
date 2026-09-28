import { describe, expect, it, vi } from 'vitest';
import { askedRoom, ROOM_KEY } from './trustlink';
import { listRoom, openDocument, roomEndpoint } from './trustroom';

const TOKEN = 'b'.repeat(64);
const BASE = 'https://lzrqvlugnawcgywkhqlz.supabase.co';
const ENDPOINT = roomEndpoint(BASE);
const COMMIT = 'e5fc11d979a962275044cc91393c6186c6b65285';

const reply = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

describe('a room link', () => {
  it('is a 64-hex token in the fragment, and nothing else', () => {
    expect(ROOM_KEY).toBe('room');
    expect(askedRoom(`#room=${TOKEN}`)).toBe(TOKEN);
    expect(askedRoom(`?room=${TOKEN}`)).toBeNull(); // the query string is logged by servers
    expect(askedRoom(`#room=${TOKEN.slice(1)}`)).toBeNull();
    expect(askedRoom(`#room=${TOKEN.toUpperCase()}`)).toBeNull();
    expect(askedRoom(`#room=${TOKEN}&next=/admin`)).toBeNull();
    expect(askedRoom('#/today')).toBeNull();
    expect(askedRoom('')).toBeNull();
  });
});

describe('the reviewer client', () => {
  it('posts the token in the body, never the URL, with no credentials, cache or referrer', async () => {
    const f = reply(200, { packet_commit: COMMIT, expires_at: '2026-10-04T12:00:00Z', items: [] });
    await listRoom(TOKEN, f, ENDPOINT, 'publishable-key');
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/functions/v1/trust-room`);
    expect(url).not.toContain(TOKEN);
    expect(init).toMatchObject({ method: 'POST', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
    expect(JSON.parse(init.body as string)).toEqual({ token: TOKEN });
  });

  it('lists the documents a grant covers', async () => {
    const f = reply(200, {
      packet_commit: COMMIT, expires_at: '2026-10-04T12:00:00Z',
      items: [{ artifact: 'hecvat', title: 'HECVAT readiness register', version: '1.0', source_commit: COMMIT }],
    });
    const l = await listRoom(TOKEN, f, ENDPOINT, '');
    expect(l).toEqual({
      kind: 'ok', packetCommit: COMMIT, expiresAt: '2026-10-04T12:00:00Z',
      items: [{ artifact: 'hecvat', title: 'HECVAT readiness register', version: '1.0', sourceCommit: COMMIT }],
    });
  });

  it('reads a 404 as "not working", and anything malformed or unreachable as offline', async () => {
    expect(await listRoom(TOKEN, reply(404, { error: 'not_found' }), ENDPOINT, '')).toEqual({ kind: 'not_found' });
    expect(await listRoom(TOKEN, reply(200, { items: 'nope' }), ENDPOINT, '')).toEqual({ kind: 'offline' });
    expect(await listRoom(TOKEN, reply(500, {}), ENDPOINT, '')).toEqual({ kind: 'offline' });
    expect(await listRoom(TOKEN, vi.fn(async () => { throw new TypeError('Load failed'); }), ENDPOINT, '')).toEqual({ kind: 'offline' });
    expect(await listRoom(TOKEN, reply(200, {}), '', '')).toEqual({ kind: 'offline' });
  });

  it('opens a document only through a signed URL on this project', async () => {
    const good = `${BASE}/storage/v1/object/sign/trust-packet/hecvat/hecvat-1.0.pdf?token=x`;
    const ok = await openDocument(TOKEN, 'hecvat',
      reply(200, { url: good, title: 'HECVAT', version: '1.0', url_expires_in: 60 }), ENDPOINT, '');
    expect(ok).toEqual({ kind: 'ok', url: good, title: 'HECVAT', version: '1.0', seconds: 60 });

    for (const bad of ['https://evil.example/hecvat.pdf', `http://lzrqvlugnawcgywkhqlz.supabase.co/x`, 'javascript:alert(1)']) {
      const o = await openDocument(TOKEN, 'hecvat', reply(200, { url: bad, title: 'x', version: '1', url_expires_in: 60 }), ENDPOINT, '');
      expect(o, bad).toEqual({ kind: 'offline' });
    }
  });

  it('tells a withdrawn document from one not uploaded yet', async () => {
    expect(await openDocument(TOKEN, 'hecvat', reply(404, {}), ENDPOINT, '')).toEqual({ kind: 'not_found' });
    expect(await openDocument(TOKEN, 'hecvat', reply(503, {}), ENDPOINT, '')).toEqual({ kind: 'unavailable' });
  });
});
