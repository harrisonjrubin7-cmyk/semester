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

self.addEventListener('fetch', (event) => {
  const { request } = event;
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
