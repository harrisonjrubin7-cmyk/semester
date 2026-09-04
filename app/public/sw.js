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

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
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
const SHARE_CACHE = 'semester-shared';
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
        caches.match(`${BASE}index.html`).then((r) => r || fetch(request)),
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
    caches.match(request).then((hit) => {
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
