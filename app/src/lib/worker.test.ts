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
});
