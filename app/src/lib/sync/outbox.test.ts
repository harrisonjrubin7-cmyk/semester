import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeIndexedDB } from './fakeidb';
import {
  HOLD_MS, SENT_MS, canSend, clearOutbox, discard, idbPort, load, memoryPort, newEntry, openPort, send, shown, type Entry, type Port, type Senders,
} from './outbox';

const NOW = 1_800_000_000_000;
const make = (over: Partial<Entry> = {}, kind: Entry['kind'] = 'share'): Entry => ({
  ...newEntry({ kind, accountId: 'u1', summary: 'Share “Advising” with a@school.edu', payload: { x: 1 }, now: NOW }),
  ...over,
});
const ready = { online: true, accountId: 'u1' };

describe('when a held request may be sent', () => {
  it('can, when it is waiting, online and the same account', () => {
    expect(canSend(make(), NOW + 1, ready)).toEqual({ ok: true });
  });

  it('cannot while offline, and says it will be ready when the connection is back', () => {
    const c = canSend(make(), NOW + 1, { ...ready, online: false });
    expect(c.ok).toBe(false);
    expect(!c.ok && c.why).toMatch(/offline.*ready to send/i);
  });

  it('never sends one that waited too long, and says to make it again', () => {
    const e = make();
    expect(shown(e, NOW + HOLD_MS - 1)).toBe('waiting');
    expect(shown(e, NOW + HOLD_MS)).toBe('expired');
    const c = canSend(e, NOW + HOLD_MS, ready);
    expect(!c.ok && c.why).toMatch(/waited too long.*make it again/i);
  });

  it('never sends another account’s, or with nobody signed in', () => {
    expect(canSend(make({ accountId: 'u2' }), NOW, ready).ok).toBe(false);
    expect(canSend(make(), NOW, { online: true, accountId: null }).ok).toBe(false);
  });

  it('will not send what is out or already went', () => {
    expect(canSend(make({ state: 'sending' }), NOW, ready).ok).toBe(false);
    expect(canSend(make({ state: 'sent' }), NOW, ready).ok).toBe(false);
  });

  it('holds a share that may already have gone until the student says so, but not a course plan', () => {
    const share = make({ state: 'unknown' });
    expect(canSend(share, NOW, ready).ok).toBe(false);
    expect(canSend(share, NOW, { ...ready, confirmed: true }).ok).toBe(true);
    // A plan replaces itself at the school, so a second send is the same as the first.
    expect(canSend(make({ state: 'unknown' }, 'contribute'), NOW, ready).ok).toBe(true);
  });
});

describe('sending one', () => {
  let port: Port;
  let calls: string[];
  const senders = (impl: (kind: string) => Promise<unknown>): Senders => ({
    share: async () => impl('share'),
    contribute: async () => impl('contribute'),
  });
  beforeEach(() => {
    port = memoryPort();
    calls = [];
  });

  it('writes it as sending before the call, and as sent after', async () => {
    const seen: string[] = [];
    const spy: Port = { ...port, put: async (e) => { seen.push(e.state); await port.put(e); } };
    const e = make();
    await spy.put(e);
    const out = await send(spy, e, senders(async (k) => { calls.push(k); seen.push('CALL'); }), () => NOW);
    expect(seen).toEqual(['waiting', 'sending', 'CALL', 'sent']);
    expect(out).toMatchObject({ state: 'sent', attempts: 1, settledAt: NOW });
  });

  it('a second tap while it is out gets the same answer, and only one request goes', async () => {
    const e = make();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const s = senders(async (k) => { calls.push(k); await gate; });
    const a = send(port, e, s);
    const b = send(port, e, s);
    release();
    const [x, y] = await Promise.all([a, b]);
    expect(calls).toEqual(['share']);
    expect(x).toEqual(y);
  });

  it('a refusal from the server is a failure that was not delivered, with its own words', async () => {
    const e = make();
    const out = await send(port, e, senders(async () => { throw new Error('No advisor at your school uses that address in Semester. Check it with your advisor.'); }));
    expect(out.state).toBe('failed');
    expect(out.said).toMatch(/No advisor/);
  });

  it('a dropped connection is unknown, never a quiet failure, and a share says to check', async () => {
    const out = await send(port, make(), senders(async () => { throw new TypeError('Failed to fetch'); }));
    expect(out.state).toBe('unknown');
    expect(out.said).toMatch(/may or may not have arrived. Check before sending it again/i);
    expect(canSend(out, NOW, ready).ok).toBe(false);
  });

  it('a dropped connection on a course plan is unknown but safe to send again', async () => {
    const e = make({}, 'contribute');
    let n = 0;
    const s = senders(async (k) => { calls.push(k); if (++n === 1) throw new Error('timeout'); });
    const first = await send(port, e, s);
    expect(first.state).toBe('unknown');
    expect(first.said).toMatch(/safe to send again/i);
    expect(canSend(first, NOW, ready).ok).toBe(true);
    const second = await send(port, first, s);
    expect(second.state).toBe('sent');
    expect(second.attempts).toBe(2);
  });

  it('a flapping connection ends in exactly one delivery of a share once the student confirms', async () => {
    let delivered = 0;
    let n = 0;
    const s = senders(async () => { n++; if (n <= 2) throw new TypeError('Failed to fetch'); delivered++; });
    let e = make();
    e = await send(port, e, s);                       // cut off
    expect(canSend(e, NOW, ready).ok).toBe(false);    // not one tap
    e = await send(port, e, s);                       // student confirmed, cut off again
    e = await send(port, e, s);                       // and this one arrived
    expect(e.state).toBe('sent');
    expect(delivered).toBe(1);
  });

  it('nothing is sent when the check says no, so airplane mode makes no call', async () => {
    const e = make();
    const c = canSend(e, NOW, { ...ready, online: false });
    if (c.ok) await send(port, e, senders(async (k) => { calls.push(k); }));
    expect(calls).toEqual([]);
  });
});

describe('what survives the app closing', () => {
  it('reads a request that was out when the app closed as unknown, and does not send it', async () => {
    const port = memoryPort();
    await port.put(make({ state: 'sending', attempts: 1 }));
    const entries = await load(port, 'u1', NOW);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ state: 'unknown' });
    expect(entries[0].said).toMatch(/closed/);
    expect(canSend(entries[0], NOW, ready).ok).toBe(false); // a share: the student decides
    // and it stays that way on disk, so a second open reads the same
    expect((await port.all())[0].state).toBe('unknown');
  });

  it('keeps a waiting request across a reopen, in order', async () => {
    const port = memoryPort();
    await port.put(make({ id: 'b', createdAt: NOW + 2 }));
    await port.put(make({ id: 'a', createdAt: NOW + 1 }));
    expect((await load(port, 'u1', NOW + 3)).map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('shows a sent one for a day, then lets it go', async () => {
    const port = memoryPort();
    await port.put(make({ id: 's', state: 'sent', settledAt: NOW }));
    expect(await load(port, 'u1', NOW + SENT_MS)).toHaveLength(1);
    expect(await load(port, 'u1', NOW + SENT_MS + 1)).toHaveLength(0);
    expect(await port.all()).toEqual([]);
  });

  it('never shows or keeps another account’s, and shows but does not delete when nobody is resolved yet', async () => {
    const port = memoryPort();
    await port.put(make({ id: 'mine' }));
    await port.put(make({ id: 'theirs', accountId: 'u2' }));
    expect((await load(port, 'u1', NOW)).map((e) => e.id)).toEqual(['mine']);
    expect((await port.all()).map((e) => e.id)).toEqual(['mine']); // theirs was removed, not just hidden
    // The session is null for a moment at every start; that must not wipe the disk.
    expect(await load(port, null, NOW)).toEqual([]);
    expect((await port.all()).map((e) => e.id)).toEqual(['mine']);
  });

  it('discarding removes it entirely', async () => {
    const port = memoryPort();
    await port.put(make({ id: 'x' }));
    await discard(port, 'x');
    expect(await port.all()).toEqual([]);
  });
});

describe('storage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is durable when IndexedDB works: a second open, as after closing the app, finds it', async () => {
    vi.stubGlobal('indexedDB', fakeIndexedDB());
    const first = await openPort();
    expect(first.durable).toBe(true);
    await first.put(make({ id: 'kept' }));
    const reopened = await openPort();
    expect((await load(reopened, 'u1', NOW)).map((e) => e.id)).toEqual(['kept']);
  });

  it('falls back to memory where IndexedDB is refused, and says it is not durable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const port = await openPort();
    expect(port.durable).toBe(false);
    await port.put(make({ id: 'brief' }));
    expect((await port.all()).map((e) => e.id)).toEqual(['brief']);
  });

  it('is emptied by clearOutbox, which Erase device calls', async () => {
    vi.stubGlobal('indexedDB', fakeIndexedDB());
    await idbPort().put(make({ id: 'gone' }));
    await clearOutbox();
    expect(await idbPort().all()).toEqual([]);
  });

  it('erases quietly where there is nothing to open', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(clearOutbox()).resolves.toBeUndefined();
  });
});
