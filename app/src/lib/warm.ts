/**
 * Tell the worker what this load actually used, so the next one can be offline.
 *
 * A service worker does not exist while the page registering it loads. The
 * document and every bundle it pulls go straight to the network, so none of
 * them passes through the worker's `fetch` handler — and nothing asks again,
 * because this app routes on the hash and a hash change does not reload.
 *
 * The worker's own install list is the shell and nothing else: the bundles are
 * content-hashed and code-split, so no list written inside `sw.js` could stay
 * right across a build. Measured on the production build — install one visit,
 * lose signal, reload:
 *
 *     root text length: 0
 *     failed requests:  8   (index-*.js, rolldown-runtime-*.js, jsx-runtime-*,
 *                            preload-helper-*, store-*, Icons-*, …)
 *
 * The cached shell came back and every script around it 404'd. So the promise
 * on the front of the README held for anybody who came back a second time
 * online, and broke for anybody who installed it and lost signal first —
 * which is the case it exists for.
 *
 * The page is the only party that knows what it loaded, which is why the list
 * goes this way round. `performance.getEntriesByType('resource')` is that
 * list, already kept by the browser and needing no bookkeeping of its own.
 *
 * Same-origin and under the app's own base only: a font or an analytics
 * script from somewhere else is not this worker's to keep, and `cache.add`
 * on an opaque cross-origin response stores something that cannot be read
 * back anyway.
 */

/** What is worth keeping: the code and styles the shell cannot start without. */
const WANTED = /\.(js|mjs|css|woff2?|svg|json|webmanifest)$/i;

/** The resources this page loaded that the worker should hold on to. */
export function usedAssets(
  entries: readonly { name: string }[],
  origin: string,
  base: string,
): string[] {
  const seen = new Set<string>();
  for (const { name } of entries) {
    if (!name.startsWith(origin)) continue;
    const path = name.slice(origin.length).split('?')[0];
    if (!path.startsWith(base)) continue;
    if (!WANTED.test(path)) continue;
    seen.add(name.split('?')[0]);
  }
  return [...seen];
}

/**
 * Hand the list over, once the worker is there to take it.
 *
 * `ready` rather than the `register` promise: a registration exists before its
 * worker is active, and a message posted to a worker that is still installing
 * is dropped. Waiting costs nothing — the page has already loaded by then, and
 * this runs after it.
 *
 * Everything here is best-effort and silent. A browser with no worker support,
 * a private window that refuses one, a quota error mid-cache: none of them is
 * something the student could act on, and the app works exactly as it did
 * before any of this existed — online.
 */
export async function warm(base: string): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const worker = reg.active;
    if (!worker) return;
    const urls = usedAssets(
      performance.getEntriesByType('resource'),
      location.origin,
      base,
    );
    if (urls.length === 0) return;
    worker.postMessage({ type: 'warm', urls });
  } catch {
    // See above: nothing here is worth telling anybody about.
  }
}
