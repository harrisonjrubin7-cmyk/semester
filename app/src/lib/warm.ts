/**
 * The first visit is the one the worker cannot cache, so the page helps.
 *
 * ## What was wrong
 *
 * `main.tsx` registers the service worker, and the worker caches its shell —
 * the page, the manifest, the icon — and then serves everything else cache
 * first, filling the cache as things are asked for. That is a sound strategy
 * and it has a hole in it exactly one visit wide.
 *
 * A worker does not exist while the page that registers it is loading. The
 * document, its entry bundle and every module it statically imports have all
 * been requested before there is anything to intercept them, so none of them
 * passes through the fetch handler and none of them is cached. Nothing asks
 * for them again in that session: a hash change routes without reloading.
 *
 * Measured against the production build, first visit, then offline:
 *
 *     cached: /  /index.html  /manifest.webmanifest  /icon.svg  …
 *     failed: /assets/index-*.js  rolldown-runtime  jsx-runtime
 *             preload-helper  store
 *     #root children: 0
 *
 * A blank page — the shell HTML restored from cache with nothing to boot it.
 * From the second visit on it is right, because by then the worker controls
 * the page and the same requests do go through it. So the app has always kept
 * its offline promise to anybody who came back, and broken it for anybody who
 * installed it and lost signal before returning — which is a phone on a
 * campus, and the case the promise was written for.
 *
 * ## Why the page does it rather than the worker
 *
 * The worker has no way to know what the page loaded. It could be given a
 * build-time list of every asset, which is the usual answer and means
 * generating one and keeping it in step; or it can be told, by the only thing
 * that knows — the document, which is still holding the URLs in its own
 * `<script>` and `<link rel="modulepreload">` tags.
 *
 * So this asks for them again once the worker is in control. They come back
 * from the browser's own HTTP cache, and on the way through they land in the
 * worker's. Strictly additive: it issues fetches and reads nothing, so the
 * worst it can do is nothing at all. Every failure is swallowed for the same
 * reason — a cache that could not be warmed is the situation this is
 * improving, not a new one to report.
 */

/** The same-origin assets this document booted from, in the order it holds them. */
export function bootAssets(doc: Document, origin: string): string[] {
  const seen = new Set<string>();
  const from = doc.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
    'script[src], link[rel="modulepreload"][href], link[rel="stylesheet"][href]',
  );

  for (const el of from) {
    const raw = el instanceof HTMLScriptElement ? el.src : el.href;
    if (!raw) continue;
    let url: URL;
    try {
      url = new URL(raw, doc.baseURI);
    } catch {
      continue;
    }
    // Only this origin. A worker's cache cannot help with anything else, and
    // re-fetching a third party would be a request the page did not need to
    // make twice.
    if (url.origin !== origin) continue;
    seen.add(url.href);
  }
  return [...seen];
}

/**
 * Wait until the worker is actually driving this page's requests.
 *
 * `ready` says a worker is active for the scope; `controller` says this
 * document's fetches go through it, which is the thing that matters here and
 * is set a moment later by the `clients.claim()` in the worker's activate.
 * Warming before that would fetch straight past the worker and cache nothing.
 */
async function controlled(sw: ServiceWorkerContainer): Promise<boolean> {
  await sw.ready;
  if (sw.controller) return true;
  return new Promise<boolean>((resolve) => {
    const done = () => resolve(Boolean(sw.controller));
    sw.addEventListener('controllerchange', done, { once: true });
    // A worker that never claims this page is a worker that will control the
    // next load instead, which is fine and is not worth waiting on for ever.
    setTimeout(done, 5_000);
  });
}

/** Ask for everything this page booted from, so the worker's cache gets it. */
export async function warmShell(): Promise<number> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 0;
  try {
    if (!(await controlled(navigator.serviceWorker))) return 0;
  } catch {
    return 0;
  }

  const urls = bootAssets(document, location.origin);
  let asked = 0;
  await Promise.all(
    urls.map(async (url) => {
      try {
        /*
         * A plain GET, deliberately, and not a copy of however the document
         * asked. Vite marks its module scripts `crossorigin` and a server may
         * answer those `Vary: Origin` — `vite preview` does — so a warmed
         * entry and the browser's own request are two different cache keys.
         * Reproducing the mode here was tried and is the wrong end of it: it
         * moved which assets missed rather than making them hit. The fix is
         * in the worker, which now looks up with `ignoreVary`, because a
         * same-origin asset does not vary by origin whatever the header says.
         */
        await fetch(url, { credentials: 'same-origin' });
        asked += 1;
      } catch {
        // Offline already, or the asset is gone. Either way there is nothing
        // useful to do about it here.
      }
    }),
  );
  return asked;
}
