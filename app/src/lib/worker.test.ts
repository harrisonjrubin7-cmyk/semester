import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The service worker is actually registered.
 *
 * It was not, for as long as the registration has been where it is. The code
 * reads `window.addEventListener('load', register)` — correct on its own, and
 * wrong there, because it sits inside `.finally()` on a chain that awaits
 * `completeAuth()` and then an IndexedDB read. Both settle after the document
 * has finished loading, so the app subscribed to an event that had already
 * happened and `register` was never called.
 *
 * Nothing failed. Subscribing to a past event is not an error, the app works
 * perfectly without a worker, and `sw.js` was built, deployed and served
 * correctly the whole time — nothing ever asked for it. What it cost was
 * every offline promise the app makes: the installed app with no signal, the
 * cached lessons, the podcast editions.
 *
 * A source-level check, like `header.test.ts`. `main.tsx` boots the whole app
 * — a DOM, a store, IndexedDB and an OAuth redemption — so importing it in a
 * unit test would test the harness. Reading it is enough to catch the shape
 * of the mistake, which is the part that was invisible.
 */
function bootSource(): string {
  return readFileSync('src/main.tsx', 'utf8');
}

describe('the service worker', () => {
  it('is registered from somewhere that runs after the page has loaded', () => {
    const src = bootSource();
    expect(src, 'main.tsx should still register the worker').toContain('serviceWorker.register');

    /*
     * The registration must not depend on `load` alone. By the time this code
     * runs the event has usually gone, so there has to be a `readyState`
     * check — or an equivalent — that registers immediately in that case.
     */
    const usesLoadEvent = /addEventListener\('load'/.test(src);
    const checksReadyState = /document\.readyState/.test(src);
    expect(
      !usesLoadEvent || checksReadyState,
      'main.tsx waits for `load` without checking document.readyState — by the ' +
        'time this runs the event has already fired and register is never called',
    ).toBe(true);
  });

  it('registers under the deployment’s own base, not the root', () => {
    // Pages serves this from /semester/, so a worker registered at `/sw.js`
    // would 404 and its scope would not cover the app.
    const src = bootSource();
    expect(src).toMatch(/BASE_URL/);
    expect(src).toMatch(/register\(`\$\{base\}sw\.js`, \{ scope: base \}\)/);
  });

  it('registers only in a build', () => {
    // In dev the worker would serve yesterday's bundle back.
    expect(bootSource()).toMatch(/import\.meta\.env\.PROD && 'serviceWorker' in navigator/);
  });

  /*
   * The next layer of the same bug, and it took the same method to find:
   * driving the production build and pulling the network out from under it.
   *
   * Registering the worker is not the same as the worker having anything.
   * Nothing it needs is fetched through it on the visit that registers it —
   * the document and its bundles were requested before there was a handler —
   * and nothing asks for them again, because a hash change routes without
   * reloading. Measured: first visit, then offline, and the shell HTML came
   * back from cache with `#root` empty and five requests failing.
   *
   * So `warmShell` asks again once the worker is in control. Held here rather
   * than only in `warm.test.ts` because the failure was never in that
   * function; it was in nobody calling one.
   */
  it('warms the cache with what the page booted from', () => {
    expect(
      bootSource(),
      'main.tsx registers the worker but never fills its cache — the first ' +
        'offline visit is then a blank page',
    ).toMatch(/warmShell\(\)/);
  });

  it('looks a cached asset up without letting Vary hide it', () => {
    /*
     * `caches.match` honours `Vary` by default. Vite marks its module scripts
     * `crossorigin`, and a server that answers those `Vary: Origin` — `vite
     * preview` does — turns one file into two cache keys depending on how it
     * was asked for. The asset is then in the cache, the page still fails
     * offline, and nothing reports a problem. Safe to ignore because the
     * handler is already down to same-origin GETs by this point.
     */
    const sw = readFileSync('public/sw.js', 'utf8');
    expect(sw).toMatch(/ignoreVary:\s*true/);
    expect(
      sw.match(/caches\.match\(request\)/g) ?? [],
      'a lookup that still honours Vary is one that can miss what it has',
    ).toEqual([]);
  });
});
