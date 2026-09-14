import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SHARE_CACHE } from './shared';

/**
 * What survives a deploy, and what a deploy is allowed to throw away.
 *
 * `sw.js`'s `activate` sweeps the caches a previous version of the worker
 * left. Its filter was `!key.startsWith(VERSION)`, and `semester-shared` — the
 * slot a shared file waits in between the worker and the page — does not carry
 * the version in its name. So the sweep deleted it.
 *
 * That is not a theoretical window. `install` calls `skipWaiting`, so a new
 * build activates the moment it installs: share a PDF into the app while a
 * deploy is going out and the worker stashed the file, the new worker
 * activated, the file was deleted, and the importer opened with its own empty
 * file picker as though nothing had been shared. It also threw away any share
 * opened and never collected, which `lib/shared.ts` treats as somebody else's
 * file this device is still holding on to.
 *
 * Run rather than read: the handler is evaluated in a stub worker scope and
 * asked what it actually deletes. A test that greps the source would pass on
 * any rewrite that kept the words and lost the behaviour.
 */
function activateWith(present: string[]): { deleted: string[]; claimed: boolean } {
  const deleted: string[] = [];
  let claimed = false;
  const listeners = new Map<string, (event: unknown) => void>();
  const waiting: Promise<unknown>[] = [];

  const self = {
    location: new URL('https://x.test/semester/sw.js'),
    addEventListener: (name: string, fn: (event: unknown) => void) => listeners.set(name, fn),
    skipWaiting: () => Promise.resolve(),
    registration: { showNotification: () => Promise.resolve() },
    clients: {
      claim: () => {
        claimed = true;
        return Promise.resolve();
      },
      matchAll: () => Promise.resolve([]),
      openWindow: () => Promise.resolve(null),
    },
  };

  const caches = {
    keys: () => Promise.resolve([...present]),
    delete: (key: string) => {
      deleted.push(key);
      return Promise.resolve(true);
    },
    open: () => Promise.resolve({ addAll: () => Promise.resolve(), match: () => Promise.resolve(null), put: () => Promise.resolve() }),
    match: () => Promise.resolve(null),
  };

  const source = readFileSync('public/sw.js', 'utf8');
  new Function('self', 'caches', 'URL', 'Response', 'fetch', source)(
    self,
    caches,
    URL,
    Response,
    () => Promise.reject(new Error('no network in this test')),
  );

  const activate = listeners.get('activate');
  if (!activate) throw new Error('sw.js registered no activate handler');
  activate({ waitUntil: (p: Promise<unknown>) => waiting.push(p) });

  // The handler's work is synchronous against these stubs; the promises are
  // settled by the time the caller's `await` drains the microtask queue.
  void waiting;
  return { deleted, claimed };
}

describe('what activate sweeps', () => {
  it('drops the caches an older version of the worker left', async () => {
    const { deleted } = activateWith(['semester-v0-shell', 'semester-v0-media', 'semester-v1-shell']);
    await Promise.resolve();
    expect(deleted).toContain('semester-v0-shell');
    expect(deleted).toContain('semester-v0-media');
  });

  it('keeps this version’s own caches', async () => {
    const { deleted } = activateWith(['semester-v1-shell', 'semester-v1-media']);
    await Promise.resolve();
    expect(deleted).toEqual([]);
  });

  // The bug: a deploy landing between the share and the importer took the file
  // with it, and the importer had nothing to say about where it went.
  it('keeps the shared-file handover, which carries no version in its name', async () => {
    const { deleted } = activateWith(['semester-v0-shell', SHARE_CACHE]);
    await Promise.resolve();
    expect(deleted).toEqual(['semester-v0-shell']);
    expect(deleted).not.toContain(SHARE_CACHE);
  });

  it('is the name `lib/shared.ts` and the worker both use, or the handover misses', () => {
    expect(readFileSync('public/sw.js', 'utf8')).toContain(`const SHARE_CACHE = '${SHARE_CACHE}'`);
  });
});
