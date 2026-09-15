// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';

/**
 * A shared file keeps its name, whatever the name is.
 *
 * The worker stashes a shared syllabus in the Cache API and puts its filename
 * in a response header. A header value is a byte string: `new Response` throws
 * on any code point above U+00FF — measured in Chromium, "String contains non
 * ISO-8859-1 code point" — and the names that do it are ordinary ones.
 *
 *     syllabus.pdf                    fine
 *     Économie.pdf                    fine, é is U+00E9
 *     Econ 1010 – Syllabus.pdf        throws, en dash U+2013
 *     Mankiw’s Principles.pdf         throws, curly apostrophe U+2019
 *     講義.pdf                         throws
 *
 * The throw landed in the handler's catch, which exists for a share with
 * nothing usable in it — so the file was dropped for the shape of its name and
 * the importer opened empty with nothing said. Word and macOS both produce
 * that en dash without being asked.
 *
 * This drives the real `public/sw.js` expression rather than a copy of it, so
 * the two halves cannot drift: the worker's encode and `takeShared`'s decode
 * have to stay a matching pair.
 */
const SW = readFileSync(join(__dirname, '..', '..', 'public', 'sw.js'), 'utf8');

/** The worker's own encoding of the name, lifted from its source. */
function workerEncode(name: string): string {
  const line = SW.split('\n').find((l) => l.includes("'x-shared-name':"));
  if (!line) throw new Error('sw.js no longer sets x-shared-name');
  const expr = line.slice(line.indexOf(':') + 1).replace(/,\s*$/, '').trim();
  // eslint-disable-next-line no-new-func -- the point is to run sw.js's own expression
  return new Function('file', `return ${expr};`)({ name });
}

const NAMES = [
  'syllabus.pdf',
  'Économie.pdf',
  'Econ 1010 – Syllabus.pdf',
  'Mankiw’s Principles.pdf',
  '講義.pdf',
  'Плани.pdf',
  '100% of the reading.pdf',
];

describe('a shared file keeps its name', () => {
  it('encodes to something a header can actually hold', () => {
    for (const name of NAMES) {
      const encoded = workerEncode(name);
      // The real check: this is exactly what the worker does, and it must not throw.
      expect(() => new Response('x', { headers: { 'x-shared-name': encoded } })).not.toThrow();
    }
  });

  it('survives the round trip unchanged', async () => {
    const { takeShared, SHARE_CACHE, SHARE_KEY } = await import('./shared');
    for (const name of NAMES) {
      const store = new Map<string, Response>();
      (globalThis as unknown as { caches: unknown }).caches = {
        open: async () => ({
          match: async (k: string) => store.get(k),
          put: async (k: string, v: Response) => void store.set(k, v),
          delete: async (k: string) => store.delete(k),
        }),
        delete: async () => true,
      };
      const cache = await (globalThis as unknown as { caches: { open: (n: string) => Promise<{ put: (k: string, v: Response) => Promise<void> }> } }).caches.open(SHARE_CACHE);
      await cache.put(SHARE_KEY, new Response('x', { headers: { 'x-shared-name': workerEncode(name) } }));
      const [file] = await takeShared();
      expect(file?.name).toBe(name);
    }
  });

  it('still reads a name an older worker stashed raw', async () => {
    const { takeShared, SHARE_CACHE, SHARE_KEY } = await import('./shared');
    const store = new Map<string, Response>();
    (globalThis as unknown as { caches: unknown }).caches = {
      open: async () => ({
        match: async (k: string) => store.get(k),
        put: async (k: string, v: Response) => void store.set(k, v),
        delete: async (k: string) => store.delete(k),
      }),
      delete: async () => true,
    };
    const cache = await (globalThis as unknown as { caches: { open: (n: string) => Promise<{ put: (k: string, v: Response) => Promise<void> }> } }).caches.open(SHARE_CACHE);
    // Unencoded, and with a stray % that would make a blind decode throw.
    await cache.put(SHARE_KEY, new Response('x', { headers: { 'x-shared-name': '100% off.pdf' } }));
    const [file] = await takeShared();
    expect(file?.name).toBe('100% off.pdf');
  });
});
