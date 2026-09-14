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
 *
 * Kept, but not for ever and not without limit — see `MEDIA_CAP`.
 */

const VERSION = 'semester-v1';
const SHELL = `${VERSION}-shell`;
const MEDIA = `${VERSION}-media`;

/*
 * Where a shared file waits between the worker and the page.
 *
 * Declared up here rather than beside `stashShared` because `activate` has to
 * know about it, and `activate` is written above that. It is not one of this
 * worker's own caches — it is a handover — and the sweep below has to leave it
 * alone.
 */
const SHARE_CACHE = 'semester-shared';
const SHARE_KEY = './__shared';

/**
 * How much played media this worker will hold.
 *
 * "Keep what has been played" had no ceiling, and the site ships 212 MB of
 * audio: 46 MB of lessons across the four courses and 167 MB of podcast
 * editions. A student who works through a term plays their way to most of it,
 * and every byte counts against `navigator.storage.estimate()` — which on iOS
 * is the number Safari evicts an origin by when the device runs low. The
 * lessons are the least valuable thing in the cache and the largest, and
 * without a cap they could take the shell and the whole offline promise with
 * them.
 *
 * 150 MB is a judgement rather than a measurement, and it is one line to
 * change. What it is meant to hold: every lesson of every course, with room
 * for the four or five podcast editions somebody actually listens to. What it
 * is meant to stop: the long tail of everything played once in September and
 * never again.
 */
const MEDIA_CAP = 150 * 1024 * 1024;


// The worker is served from wherever the app is — '/' locally, '/semester/' on
// GitHub Pages — so every path it holds is derived from its own location. A
// hard-coded '/index.html' would cache the wrong page, or none.
const BASE = new URL('./', self.location).pathname;
const SHELL_FILES = [BASE, `${BASE}index.html`, `${BASE}manifest.webmanifest`, `${BASE}icon.svg`];

/**
 * When each cached file was last played, and what was thrown out to make room.
 *
 * A ledger is needed because the cache cannot answer either question.
 * `cache.keys()` is insertion order, which is *first download* order — so
 * evicting by it would drop the lessons somebody is still working through and
 * keep the edition they played once in the first week. Least recently played
 * is the order that matches how the cache is used.
 *
 * It holds only the time. Sizes are read from each cached response's
 * `content-length` at the moment they are needed, so there is no second
 * number to go stale, and reading a header off a cached response costs
 * nothing like reading its body.
 *
 * It lives in the media cache so that clearing downloads clears it too, and
 * its key is not one `isMedia` matches, so the fetch handler will never serve
 * it or count it as a download.
 */
const LEDGER = `${BASE}__media-ledger`;

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

/*
 * Drop the caches a previous version of this worker left, and nothing else.
 *
 * `semester-shared` is not one of them. It is the handover slot for a file
 * somebody shared into the app, it does not carry the version in its name, and
 * the sweep used to delete it — which matters because `install` calls
 * `skipWaiting`, so a deploy activates the moment it installs. Share a PDF into
 * the app while a new build is going out and the worker stashed the file, the
 * new worker activated, the file was deleted, and the importer opened with its
 * empty file picker as if nothing had been shared. The same sweep also threw
 * away a share that was opened and never collected, which `lib/shared.ts`
 * treats as somebody else's file this device is still holding.
 */
const KEEP_CACHES = (key) => key.startsWith(VERSION) || key === SHARE_CACHE;

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP_CACHES(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isMedia = (url) =>
  /\/(audio|decks|handouts)\//.test(url.pathname) ||
  /\.(mp3|mp4|pptx|docx|pdf)$/i.test(url.pathname);

/** The ledger as it stands, or an empty one. Never throws; this is bookkeeping. */
async function readLedger(cache) {
  try {
    const held = await cache.match(LEDGER);
    if (!held) return { played: {}, shed: null };
    const parsed = await held.json();
    return {
      played: parsed && typeof parsed.played === 'object' && parsed.played ? parsed.played : {},
      shed: parsed && typeof parsed.shed === 'object' ? parsed.shed : null,
    };
  } catch {
    return { played: {}, shed: null };
  }
}

async function writeLedger(cache, ledger) {
  try {
    await cache.put(
      LEDGER,
      new Response(JSON.stringify(ledger), { headers: { 'Content-Type': 'application/json' } }),
    );
  } catch {
    // A ledger that cannot be written costs the eviction order, not the app.
    // `sweep` falls back to what the cache itself can tell it.
  }
}

/** A path, however the key naming it was spelt. */
function pathOf(url) {
  try {
    return new URL(url, self.location.origin).pathname;
  } catch {
    return String(url);
  }
}

/** What a cached response weighs, from its header rather than its body. */
async function weigh(cache, request) {
  try {
    const held = await cache.match(request);
    const said = Number(held && held.headers.get('content-length'));
    return Number.isFinite(said) && said > 0 ? said : 0;
  } catch {
    return 0;
  }
}

/**
 * How close together two plays of one file count as the same play.
 *
 * An `<audio>` element does not make one request per track. It makes several —
 * a ranged probe, the body, another range on every scrub — and each one
 * reaches the handler below. Writing the ledger on all of them would be a
 * cache write per seek to record a fact that has not changed. A minute is far
 * below any interval at which the eviction order could differ.
 */
const PLAY_AGAIN_MS = 60 * 1000;

/**
 * Note that something was played, so the cap knows what to keep.
 *
 * Called on a cache hit as well as on a first download, which is the whole
 * point: a lesson replayed in December must not be evicted as though it had
 * last been touched in September.
 */
async function played(path) {
  const cache = await caches.open(MEDIA);
  const ledger = await readLedger(cache);
  const now = Date.now();
  if (now - (ledger.played[path] ?? 0) < PLAY_AGAIN_MS) return;
  ledger.played[path] = now;
  await writeLedger(cache, ledger);
}

/**
 * Bring the media cache back under the cap, least recently played first.
 *
 * Runs after a download rather than on a schedule, because a download is the
 * only thing that makes the cache bigger.
 *
 * An entry the ledger has never heard of — cached by a build before this
 * existed, or after a ledger that would not write — sorts as the oldest thing
 * there is. That is the right guess: it has not been played since the ledger
 * started, and the alternative is an entry no eviction can ever reach.
 *
 * What went is written down. `lib/keep.ts` argues this about shedding a full
 * store and the argument is the same here: a cache that quietly threw away
 * last month's lessons is the same betrayal in a smaller coat. The page reads
 * this and says so — see `lib/downloads.ts`.
 */
async function sweep() {
  const cache = await caches.open(MEDIA);
  const ledger = await readLedger(cache);

  const entries = [];
  let total = 0;
  for (const request of await cache.keys()) {
    const path = pathOf(request.url);
    if (path === LEDGER) continue;
    const bytes = await weigh(cache, request);
    total += bytes;
    entries.push({ request, path, bytes, at: ledger.played[path] ?? 0 });
  }
  if (total <= MEDIA_CAP) return;

  entries.sort((a, b) => a.at - b.at);
  const gone = [];
  let freed = 0;
  for (const entry of entries) {
    if (total - freed <= MEDIA_CAP) break;
    if (!(await cache.delete(entry.request))) continue;
    delete ledger.played[entry.path];
    freed += entry.bytes;
    gone.push(entry.path);
  }
  if (!gone.length) return;

  ledger.shed = { at: Date.now(), bytes: freed, paths: gone };
  await writeLedger(cache, ledger);
}

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
      caches.match(request).then((hit) => {
        if (hit) {
          // Played again. Noted off the critical path — the response is
          // already on its way back — but inside `waitUntil`, so the worker is
          // not stopped halfway through writing the ledger.
          event.waitUntil(played(url.pathname));
          return hit;
        }
        return fetch(request).then((res) => {
          // Range requests come back as 206 and cannot be cached whole; the
          // full response arrives on a later play and is kept then.
          if (res.ok && res.status === 200) {
            const copy = res.clone();
            event.waitUntil(
              caches
                .open(MEDIA)
                .then((cache) => cache.put(request, copy))
                .then(() => played(url.pathname))
                // A download is the only thing that makes this cache bigger,
                // so it is the only moment the cap has to be checked.
                .then(sweep)
                .catch(() => {}),
            );
          }
          return res;
        });
      }),
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
