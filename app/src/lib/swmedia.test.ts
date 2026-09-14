/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The cap on played media, driven rather than read.
 *
 * "Keep what has been played" had no ceiling, against 212 MB of audio the site
 * ships, and every byte of it counts against `navigator.storage.estimate()` —
 * which on iOS is the number Safari evicts a whole origin by. So the worker
 * now holds the media cache under `MEDIA_CAP` and throws out the least
 * recently played to get there.
 *
 * Two things about that are worth a test each rather than a comment:
 *
 *   **Least recently played, not first downloaded.** `cache.keys()` is
 *   insertion order, and evicting by it would drop the lessons somebody is
 *   working through this week and keep the edition they played once in the
 *   first week of term. That is the wrong answer and it is the one you get for
 *   free, which is why the ledger exists.
 *
 *   **What went is written down.** `lib/keep.ts` argues this about shedding a
 *   full store: a cache that quietly threw away last month's lessons is the
 *   same betrayal in a smaller coat.
 */

const ORIGIN = 'https://x.test';
const BASE = '/semester/';
const MB = 1024 * 1024;

/** A cache that remembers insertion order, sizes and bodies, as a real one does. */
class FakeCache {
  entries = new Map<string, { body: string; bytes: number }>();

  private key(k: unknown): string {
    const url = typeof k === 'string' ? k : ((k as { url: string }).url ?? String(k));
    return new URL(url, ORIGIN).pathname;
  }

  match(k: unknown) {
    const hit = this.entries.get(this.key(k));
    if (hit === undefined) return Promise.resolve(undefined);
    return Promise.resolve({
      headers: { get: (h: string) => (h === 'content-length' ? String(hit.bytes) : null) },
      json: () => Promise.resolve(JSON.parse(hit.body)),
      text: () => Promise.resolve(hit.body),
    });
  }

  keys() {
    return Promise.resolve([...this.entries.keys()].map((url) => ({ url })));
  }

  put(k: unknown, res: { body: string; bytes?: number }) {
    const key = this.key(k);
    // A real `put` replaces in place rather than appending, and the ledger is
    // rewritten on every play — so nothing here may depend on insertion order
    // being touched by a rewrite.
    this.entries.set(key, { body: res.body, bytes: res.bytes ?? 0 });
    return Promise.resolve();
  }

  delete(k: unknown) {
    return Promise.resolve(this.entries.delete(this.key(k)));
  }
}

/** Load `sw.js` with the globals a worker has, and hand back a way to play things. */
function loadWorker() {
  const src = readFileSync('public/sw.js', 'utf8');
  const handlers = new Map<string, (e: unknown) => void>();
  const media = new FakeCache();
  const shell = new FakeCache();
  const caches = {
    open: (name: string) => Promise.resolve(name.endsWith('-media') ? media : shell),
    keys: () => Promise.resolve([] as string[]),
    delete: () => Promise.resolve(true),
    match: (k: unknown) => media.match(k),
  };
  const self = {
    location: new URL(`${ORIGIN}${BASE}sw.js`),
    addEventListener: (name: string, fn: (e: unknown) => void) => handlers.set(name, fn),
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
    registration: {},
  };
  const Response = class {
    body: string;
    bytes: number;
    headers: { get: (h: string) => string | null };
    constructor(body: string, init?: { headers?: Record<string, string> }) {
      this.body = body;
      this.bytes = 0;
      const headers = init?.headers ?? {};
      this.headers = { get: (h: string) => headers[h] ?? headers['Content-Type'] ?? null };
    }
  };

  /** What the network hands back for a file of a given size. */
  let serving = 0;
  const fetch = () =>
    Promise.resolve({
      ok: true,
      status: 200,
      bytes: serving,
      clone() {
        return { body: 'audio', bytes: serving };
      },
    });

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function('self', 'caches', 'Response', 'fetch', src)(self, caches, Response, fetch);

  /** Ask for a file, the way a player does, and let the worker finish its work. */
  const play = async (path: string, bytes: number) => {
    serving = bytes;
    const waits: Promise<unknown>[] = [];
    let answered: Promise<unknown> = Promise.resolve();
    handlers.get('fetch')?.({
      request: { url: `${ORIGIN}${path}`, mode: 'no-cors', method: 'GET' },
      respondWith: (p: Promise<unknown>) => {
        answered = p;
      },
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    });
    await answered;
    // `waitUntil` is called from inside the response promise, so the list is
    // only complete once that has settled — and a sweep can add more.
    for (let i = 0; i < 6 && waits.length; i += 1) await Promise.all(waits.splice(0));
  };

  const ledger = async () => {
    const held = media.entries.get(`${BASE}__media-ledger`);
    return held ? (JSON.parse(held.body) as { played: Record<string, number>; shed: unknown }) : null;
  };

  return { media, play, ledger };
}

const held = (w: ReturnType<typeof loadWorker>) =>
  [...w.media.entries.keys()].filter((p) => !p.endsWith('__media-ledger')).sort();

describe('the cap on played media', () => {
  let w: ReturnType<typeof loadWorker>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T09:00:00Z'));
    w = loadWorker();
  });

  it('keeps everything while there is room', async () => {
    await w.play(`${BASE}audio/lessons/psci/unit-0.mp3`, 10 * MB);
    await w.play(`${BASE}audio/lessons/psci/unit-1.mp3`, 10 * MB);

    expect(held(w)).toEqual([
      `${BASE}audio/lessons/psci/unit-0.mp3`,
      `${BASE}audio/lessons/psci/unit-1.mp3`,
    ]);
  });

  it('throws out the least recently played, not the first downloaded', async () => {
    /*
     * The whole reason the ledger exists. `unit-0` is downloaded first and
     * played again in December; `unit-1` is downloaded second and never
     * touched. Insertion order would drop `unit-0`, which is the one still in
     * use.
     */
    await w.play(`${BASE}audio/lessons/psci/unit-0.mp3`, 80 * MB);
    vi.setSystemTime(new Date('2026-09-02T09:00:00Z'));
    await w.play(`${BASE}audio/lessons/psci/unit-1.mp3`, 60 * MB);

    vi.setSystemTime(new Date('2026-12-01T09:00:00Z'));
    await w.play(`${BASE}audio/lessons/psci/unit-0.mp3`, 80 * MB); // a cache hit

    vi.setSystemTime(new Date('2026-12-02T09:00:00Z'));
    await w.play(`${BASE}audio/psci-podcast.mp3`, 40 * MB); // now over the cap

    expect(held(w)).toEqual([
      `${BASE}audio/lessons/psci/unit-0.mp3`,
      `${BASE}audio/psci-podcast.mp3`,
    ]);
  });

  it('stops as soon as it is under, rather than emptying the cache', async () => {
    await w.play(`${BASE}audio/a-podcast.mp3`, 60 * MB);
    vi.setSystemTime(new Date('2026-09-02T09:00:00Z'));
    await w.play(`${BASE}audio/b-podcast.mp3`, 60 * MB);
    vi.setSystemTime(new Date('2026-09-03T09:00:00Z'));
    await w.play(`${BASE}audio/c-podcast.mp3`, 60 * MB);

    // 180 MB against a 150 MB cap: one file over, so one file goes.
    expect(held(w)).toEqual([`${BASE}audio/b-podcast.mp3`, `${BASE}audio/c-podcast.mp3`]);
  });

  it('writes down what it took, because shedding is never silent', async () => {
    await w.play(`${BASE}audio/lessons/econ/unit-0.mp3`, 100 * MB);
    vi.setSystemTime(new Date('2026-09-05T09:00:00Z'));
    await w.play(`${BASE}audio/lessons/psci/unit-0.mp3`, 100 * MB);

    const shed = (await w.ledger())?.shed as { bytes: number; paths: string[]; at: number };
    expect(shed.paths).toEqual([`${BASE}audio/lessons/econ/unit-0.mp3`]);
    expect(shed.bytes).toBe(100 * MB);
    expect(shed.at).toBe(new Date('2026-09-05T09:00:00Z').getTime());
  });

  it('treats a file the ledger never saw as the oldest thing there is', async () => {
    // Cached by a build before the ledger existed. The alternative to sorting
    // it oldest is an entry no eviction can ever reach.
    w.media.entries.set(`${BASE}audio/before-the-ledger.mp3`, { body: 'audio', bytes: 100 * MB });

    await w.play(`${BASE}audio/lessons/psci/unit-0.mp3`, 100 * MB);

    expect(held(w)).toEqual([`${BASE}audio/lessons/psci/unit-0.mp3`]);
  });

  it('does not rewrite the ledger once per range request', async () => {
    /*
     * An `<audio>` element makes several requests for one track — a probe, the
     * body, another range on every scrub — and each reaches the handler. A
     * cache write on all of them records a fact that has not changed.
     */
    await w.play(`${BASE}audio/lessons/psci/unit-0.mp3`, 10 * MB);
    const first = (await w.ledger())?.played[`${BASE}audio/lessons/psci/unit-0.mp3`];

    vi.setSystemTime(new Date('2026-09-01T09:00:20Z')); // twenty seconds later
    await w.play(`${BASE}audio/lessons/psci/unit-0.mp3`, 10 * MB);
    expect((await w.ledger())?.played[`${BASE}audio/lessons/psci/unit-0.mp3`]).toBe(first);

    vi.setSystemTime(new Date('2026-09-01T09:05:00Z')); // a real second play
    await w.play(`${BASE}audio/lessons/psci/unit-0.mp3`, 10 * MB);
    expect((await w.ledger())?.played[`${BASE}audio/lessons/psci/unit-0.mp3`]).not.toBe(first);
  });

  it('never counts or evicts its own ledger', async () => {
    await w.play(`${BASE}audio/lessons/psci/unit-0.mp3`, 149 * MB);
    await w.play(`${BASE}audio/lessons/psci/unit-1.mp3`, 149 * MB);

    // Whatever else happened, the ledger is still there — losing it would lose
    // the eviction order and the record of what went.
    expect([...w.media.entries.keys()]).toContain(`${BASE}__media-ledger`);
  });
});
