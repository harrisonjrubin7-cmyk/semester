/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * The worker's cache, driven rather than read.
 *
 * `warm.test.ts` checks that `sw.js` contains the right shapes, which is worth
 * having and is not the same as knowing it behaves. What is being fixed here
 * cannot be seen in the source at all — it is what the cache holds after two
 * builds — so this loads the worker into a fake `self` and a fake `caches` and
 * runs its message handler.
 *
 * The bug: asset names are content-hashed, so a deploy orphans everything the
 * worker is holding rather than updating it, and `activate` cannot clear them
 * because `activate` runs when `sw.js` changes and `sw.js` is a static file
 * that does not. An installed app accumulated every version of every chunk it
 * had ever loaded.
 *
 * The rule the tests below pin down:
 *
 *   same build  → add what is new, keep everything (including screens the
 *                 fetch handler cached after the first load — evicting those
 *                 is exactly what the offline promise is about)
 *   new build   → keep the shell, the page's list and the build note; the rest
 *                 is named after files the server no longer serves
 *   no build    → never prune, because nothing can be known
 */

const ORIGIN = 'https://x.test';
const BASE = '/semester/';

class FakeCache {
  entries = new Map<string, string>();

  private key(k: unknown): string {
    const url = typeof k === 'string' ? k : ((k as { url: string }).url ?? String(k));
    return new URL(url, ORIGIN).pathname;
  }

  match(k: unknown) {
    const hit = this.entries.get(this.key(k));
    return Promise.resolve(hit === undefined ? undefined : { text: () => Promise.resolve(hit) });
  }

  keys() {
    return Promise.resolve([...this.entries.keys()].map((url) => ({ url })));
  }

  add(url: string) {
    this.entries.set(this.key(url), 'fetched');
    return Promise.resolve();
  }

  addAll(urls: string[]) {
    for (const u of urls) this.entries.set(this.key(u), 'installed');
    return Promise.resolve();
  }

  put(k: unknown, res: { body: string }) {
    this.entries.set(this.key(k), res.body);
    return Promise.resolve();
  }

  delete(k: unknown) {
    return Promise.resolve(this.entries.delete(this.key(k)));
  }
}

/** Load `sw.js` with the globals a worker would have, and hand back its handlers. */
function loadWorker() {
  const src = readFileSync('public/sw.js', 'utf8');
  const handlers = new Map<string, (e: unknown) => void>();
  const shell = new FakeCache();
  const caches = {
    open: () => Promise.resolve(shell),
    keys: () => Promise.resolve([] as string[]),
    delete: () => Promise.resolve(true),
    match: () => Promise.resolve(undefined),
  };
  const self = {
    location: new URL(`${ORIGIN}${BASE}sw.js`),
    addEventListener: (name: string, fn: (e: unknown) => void) => handlers.set(name, fn),
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
    registration: {},
  };
  const waits: Promise<unknown>[] = [];
  const Response = class {
    body: string;
    constructor(body: string) {
      this.body = body;
    }
  };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function('self', 'caches', 'Response', 'fetch', src)(self, caches, Response, () => {
    throw new Error('the message handler must not reach the network');
  });

  const warm = async (build: string, urls: string[]) => {
    handlers.get('message')?.({
      data: { type: 'warm', build, urls },
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    });
    await Promise.all(waits.splice(0));
  };

  /** What `install` puts there before any page has said a word. */
  const install = async () => {
    handlers.get('install')?.({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits.splice(0));
  };

  return { shell, warm, install };
}

const asset = (name: string) => `${ORIGIN}${BASE}assets/${name}`;
const paths = (c: FakeCache) => [...c.entries.keys()].sort();

describe('the shell cache across builds', () => {
  let w: ReturnType<typeof loadWorker>;

  beforeEach(async () => {
    w = loadWorker();
    await w.install();
  });

  it('keeps a screen cached after the first load, on the same build', async () => {
    await w.warm('build-1', [asset('index-a.js')]);
    // A screen opened later: the fetch handler put it here, and it is not in
    // any warm list. Pruning against the list alone would evict it.
    w.shell.entries.set(`${BASE}assets/Calendar-a.js`, 'fetched');

    await w.warm('build-1', [asset('index-a.js')]);

    expect(paths(w.shell)).toContain(`${BASE}assets/Calendar-a.js`);
  });

  it('drops the last build once a new one arrives', async () => {
    await w.warm('build-1', [asset('index-a.js')]);
    w.shell.entries.set(`${BASE}assets/Calendar-a.js`, 'fetched');

    await w.warm('build-2', [asset('index-b.js')]);

    const kept = paths(w.shell);
    expect(kept).toContain(`${BASE}assets/index-b.js`);
    // Both are named after files the server stopped serving at the deploy.
    expect(kept).not.toContain(`${BASE}assets/index-a.js`);
    expect(kept).not.toContain(`${BASE}assets/Calendar-a.js`);
  });

  it('never drops the shell, so an offline reload still finds a page', async () => {
    await w.warm('build-1', [asset('index-a.js')]);
    await w.warm('build-2', [asset('index-b.js')]);

    expect(paths(w.shell)).toContain(`${BASE}index.html`);
  });

  it('does not grow without bound across many builds', async () => {
    for (let i = 0; i < 8; i++) await w.warm(`build-${i}`, [asset(`index-${i}.js`)]);

    // The shell, the one asset of the current build, and the build note.
    expect(paths(w.shell).filter((p) => p.includes('/assets/'))).toEqual([
      `${BASE}assets/index-7.js`,
    ]);
  });

  it('prunes nothing when the page cannot say which build it is', async () => {
    await w.warm('', [asset('index-a.js')]);
    await w.warm('', [asset('index-b.js')]);

    const kept = paths(w.shell);
    expect(kept).toContain(`${BASE}assets/index-a.js`);
    expect(kept).toContain(`${BASE}assets/index-b.js`);
  });
});
