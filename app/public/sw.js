/*
 * The service worker.
 *
 * Two jobs. It makes the app installable — a real window on a Mac or a PC, an
 * icon on a phone home screen — and it makes it work with no signal, which for
 * a study app is the case that matters: a lesson on the walk to class, a drill
 * on a plane, the guide in a basement library.
 *
 * The strategy is deliberately dull:
 *
 *   navigation → network first, fall back to the cached shell
 *   audio, decks, handouts → cache first, and keep what has been played
 *   everything else → cache first, refreshed in the background
 *
 * Audio is never pre-cached. Sixty megabytes of lessons downloaded on first
 * open would be a hostile thing to do to a phone plan; what you actually
 * listened to is kept, and that is enough.
 */

const VERSION = 'semester-v1';
const SHELL = `${VERSION}-shell`;
const MEDIA = `${VERSION}-media`;

/*
 * Where a shared syllabus waits between the POST and the page that reads it.
 *
 * Up here with the other two because `activate` has to know about it. Its name
 * is not derived from VERSION and must not be: `src/lib/shared.ts` opens the
 * same cache from the page, and a worker cannot import from the app, so the
 * string is agreed by being written the same in both places. Change one and
 * you change both.
 */
const SHARE_CACHE = 'semester-shared';

/** The three caches this worker owns. Anything else under this origin is not ours. */
const OURS = [SHELL, MEDIA, SHARE_CACHE];

// The worker is served from wherever the app is — '/' locally, '/semester/' on
// GitHub Pages — so every path it holds is derived from its own location. A
// hard-coded '/index.html' would cache the wrong page, or none.
const BASE = new URL('./', self.location).pathname;
const SHELL_FILES = [BASE, `${BASE}index.html`, `${BASE}manifest.webmanifest`, `${BASE}icon.svg`];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  );
});

/*
 * Cache what the first load already used.
 *
 * A worker does not exist while the page that registers it is loading, so the
 * document and its bundles never pass through the handler below — and nothing
 * asks again, because this app routes on the hash and a hash change does not
 * reload. Measured on the production build: install one visit, lose signal,
 * reload, and the shell came back from cache with every one of its scripts
 * 404ing around it — eight failed requests and an empty `#root`.
 *
 * So the promise on the front of the README held for anybody who came back a
 * second time online, and broke for anybody who installed it and lost signal
 * first — which is the case it is for.
 *
 * The page sends the list, because the page is the only one that knows what it
 * actually loaded: the bundles are hashed and code-split, so no list written
 * here could stay right. See `src/lib/warm.ts`.
 *
 * `ignoreVary` on the lookup: a bundle fetched by the page as a module carries
 * different request headers from one this worker fetches, and a strict `Vary`
 * match treats those as different entries — so without it the same file is
 * fetched and stored again on every warm, and the offline lookup still misses.
 */
/*
 * Where the build the cache was filled for is written down.
 *
 * A cache entry, because a worker has no storage of its own that survives the
 * worker being stopped, and this is the one thing it has to remember between
 * page loads. It lives in SHELL and is excluded from the prune below by name.
 */
const BUILD_KEY = `${BASE}__build`;

async function builtFor(cache) {
  try {
    const hit = await cache.match(BUILD_KEY, { ignoreVary: true });
    return hit ? await hit.text() : '';
  } catch {
    return '';
  }
}

/*
 * Throw away the last build's assets, and only when there is a last build.
 *
 * Everything kept here is named after a file on the server, and those names
 * are content-hashed — so a deploy does not update these entries, it orphans
 * them. `activate` cannot clear them: it runs when `sw.js` changes, and
 * `sw.js` is a static file that does not change per build. So the cache only
 * ever grew, and an installed app held every version of every chunk it had
 * ever loaded.
 *
 * Pruning against the warm list on *every* load would have been the obvious
 * fix and would have been wrong. That list is what the first load fetched; a
 * screen opened later is cached by the fetch handler and is not in it, so
 * pruning every time would evict precisely the screens the offline promise is
 * about. A build change is the one moment the old entries are certainly dead.
 *
 * What is kept: the shell, the page's own list, and the note recording which
 * build this now is. Deleting rather than emptying the cache, so there is no
 * moment where an offline reload finds no index.html.
 */
async function pruneTo(cache, urls) {
  const keep = new Set([...SHELL_FILES, ...urls, BUILD_KEY].map(toPath));
  for (const req of await cache.keys()) {
    if (!keep.has(toPath(req.url))) await cache.delete(req);
  }
}

/** A cache key and a URL compared as the same thing: the path they name. */
function toPath(url) {
  try {
    return new URL(url, self.location.origin).pathname;
  } catch {
    return String(url);
  }
}

self.addEventListener('message', (event) => {
  const said = event.data && event.data.type === 'warm' ? event.data : null;
  const urls = said && Array.isArray(said.urls) ? said.urls : null;
  if (!urls) return;
  const build = typeof said.build === 'string' ? said.build : '';
  event.waitUntil(
    caches.open(SHELL).then(async (cache) => {
      for (const url of urls) {
        try {
          if (await cache.match(url, { ignoreVary: true })) continue;
          await cache.add(url);
        } catch {
          // One asset that will not cache must not stop the rest.
        }
      }
      // After the adds, never before: a prune that ran first would delete the
      // shell of the build now being warmed and have to fetch it all back.
      if (!build) return;
      try {
        if ((await builtFor(cache)) !== build) {
          await pruneTo(cache, urls);
          await cache.put(BUILD_KEY, new Response(build));
        }
      } catch {
        // A full or refusing cache. Growing is better than failing.
      }
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      /*
       * Drop the caches of previous versions of this worker, and only those.
       *
       * It used to test `!k.startsWith(VERSION)`, which read as "anything that
       * is not the current version" and meant something else: `semester-shared`
       * does not start with `semester-v1`, so every activation deleted the
       * cache holding a syllabus somebody had just shared into the app. The
       * window is narrow — share, stash, redirect, read — but `skipWaiting()`
       * on install is exactly what can put an activation inside it, which
       * makes the first share after a deploy the one that loses the file.
       *
       * Naming what we keep rather than pattern-matching what we drop: a list
       * of three cannot go wrong the way a prefix test did.
       */
      .then((keys) =>
        Promise.all(keys.filter((k) => !OURS.includes(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

const isMedia = (url) =>
  /\/(audio|decks|handouts)\//.test(url.pathname) ||
  /\.(mp3|mp4|pptx|docx|pdf)$/i.test(url.pathname);

/*
 * A syllabus shared into the app.
 *
 * The share arrives as a POST with the file in a multipart body, and a worker
 * cannot hand a File to a page. So the body is stashed in a cache under a
 * known key and the browser is redirected to a plain GET the app can boot
 * from; the page picks the file up and deletes it. See `src/lib/shared.ts`.
 *
 * This is checked before the GET guard below, because it is the one POST this
 * worker has any business answering.
 */
const SHARE_KEY = './__shared';

async function stashShared(request) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (file && typeof file !== 'string') {
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(
        SHARE_KEY,
        new Response(file, {
          headers: {
            'x-shared-name': file.name || 'shared',
            'x-shared-type': file.type || 'application/octet-stream',
          },
        }),
      );
    }
  } catch {
    // A share with nothing usable in it. The redirect still happens, and the
    // importer opens with its own file picker — which is the right landing
    // place for somebody who meant to share something.
  }
  return Response.redirect(`${BASE}?screen=import&shared=1`, 303);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method === 'POST' && new URL(request.url).pathname === `${BASE}share`) {
    event.respondWith(stashShared(request));
    return;
  }

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Anything off this origin — the API, a provider, a calendar feed — is left
  // strictly alone. A cached answer from Claude or a stale calendar would be
  // worse than no answer.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(`${BASE}index.html`, { ignoreVary: true }).then((r) => r || fetch(request)),
      ),
    );
    return;
  }

  if (isMedia(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            // Range requests come back as 206 and cannot be cached whole; the
            // full response arrives on a later play and is kept then.
            if (res.ok && res.status === 200) {
              const copy = res.clone();
              caches.open(MEDIA).then((cache) => cache.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((hit) => {
      const live = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL).then((cache) => cache.put(request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || live;
    }),
  );
});


/*
 * A reminder arriving while the app is shut.
 *
 * The payload is written by the app, queued, and sent back by the function
 * that delivers it — so nothing here decides anything about semesters. It
 * shows what it was given and opens the app where the app asked.
 *
 * `userVisibleOnly` was promised at subscription time, so a push that shows
 * nothing would be a broken promise the browser eventually punishes by
 * dropping the subscription. Hence the fallback text: something always shows.
 */
self.addEventListener('push', (event) => {
  let said = { title: 'Semester', body: 'Something is due.', screen: '', item: '' };
  try {
    if (event.data) said = { ...said, ...event.data.json() };
  } catch {
    // A payload that is not JSON, or none at all. The fallback still shows.
  }

  event.waitUntil(
    self.registration.showNotification(said.title, {
      body: said.body,
      icon: `${BASE}icon-192.png`,
      badge: `${BASE}icon-192.png`,
      // One notification per reminder id, so a re-send replaces rather than
      // stacks — a phone that was off for a day should not wake to nine.
      tag: said.id || said.title,
      // `item` is what makes a tap land on the deadline the reminder named
      // rather than on the app. The page decides what to do with both — see
      // `lib/land.ts`; nothing here trusts either to name a real screen.
      data: { screen: said.screen || '', item: said.item || '' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const screen = event.notification.data?.screen;
  const item = event.notification.data?.item;
  // Both go on the cold-start URL, because a tap on a phone that has the app
  // closed is the common case and it deserves the same landing as a tap on a
  // phone that has it open.
  const query = [
    screen ? `screen=${encodeURIComponent(screen)}` : '',
    item ? `item=${encodeURIComponent(item)}` : '',
  ].filter(Boolean).join('&');
  const url = `${BASE}${query ? `?${query}` : ''}`;

  event.waitUntil(
    (async () => {
      // Focus a tab that is already open rather than opening a second one:
      // two tabs of the same app is exactly what the student did not ask for
      // by tapping a notification.
      const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of open) {
        if (client.url.startsWith(self.location.origin + BASE)) {
          await client.focus();
          if (screen || item) client.postMessage({ type: 'go', screen, item });
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
