import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const config = JSON.parse(read('vercel.json'));

function activate(base, present) {
  const listeners = new Map();
  const waits = [];
  const deleted = [];
  const self = {
    location: new URL(`https://preview.example${base}sw.js`),
    addEventListener: (name, handler) => listeners.set(name, handler),
    skipWaiting: () => Promise.resolve(),
    registration: { showNotification: () => Promise.resolve() },
    clients: {
      claim: () => Promise.resolve(),
      matchAll: () => Promise.resolve([]),
      openWindow: () => Promise.resolve(null),
    },
  };
  const caches = {
    keys: () => Promise.resolve([...present]),
    delete: async (key) => {
      deleted.push(key);
      return true;
    },
    open: () => Promise.resolve({
      addAll: () => Promise.resolve(),
      match: () => Promise.resolve(null),
      put: () => Promise.resolve(),
    }),
    match: () => Promise.resolve(null),
  };
  new Function('self', 'caches', 'URL', 'Response', 'fetch', read('app/public/sw.js'))(
    self,
    caches,
    URL,
    Response,
    () => Promise.reject(new Error('network disabled in routing test')),
  );
  listeners.get('activate')({ waitUntil: (promise) => waits.push(promise) });
  return Promise.all(waits).then(() => deleted);
}

function intercepted(path, init = {}) {
  const listeners = new Map();
  const self = {
    location: new URL('https://preview.example/app/sw.js'),
    addEventListener: (name, handler) => listeners.set(name, handler),
    skipWaiting: () => Promise.resolve(),
    registration: { showNotification: () => Promise.resolve() },
    clients: { claim: () => Promise.resolve(), matchAll: () => Promise.resolve([]), openWindow: () => Promise.resolve(null) },
  };
  const caches = {
    keys: () => Promise.resolve([]),
    delete: () => Promise.resolve(true),
    open: () => Promise.resolve({ addAll: () => Promise.resolve(), match: () => Promise.resolve(null), put: () => Promise.resolve() }),
    match: () => Promise.resolve(null),
  };
  new Function('self', 'caches', 'URL', 'Response', 'fetch', read('app/public/sw.js'))(
    self, caches, URL, Response, () => Promise.reject(new Error('network disabled in routing test')),
  );
  const { syntheticMode, ...requestInit } = init;
  const nativeRequest = new Request(new URL(path, self.location.origin), requestInit);
  const request = syntheticMode
    ? {
        method: nativeRequest.method,
        url: nativeRequest.url,
        cache: nativeRequest.cache,
        mode: syntheticMode,
        headers: nativeRequest.headers,
      }
    : nativeRequest;
  let handled = false;
  listeners.get('fetch')({
    request,
    respondWith: (promise) => {
      handled = true;
      void Promise.resolve(promise).catch(() => {});
    },
    waitUntil: (promise) => { void Promise.resolve(promise).catch(() => {}); },
  });
  return handled;
}

test('unified routes keep APIs and lab ahead of /app and the company catch-all', () => {
  assert.deepEqual(config.redirects, [
    {
      source: '/app',
      has: [{ type: 'host', value: '(?:(?:www\\.)?semesterintel\\.tech|.*\\.vercel\\.app)' }],
      destination: '/app/',
      permanent: true,
    },
  ]);
  assert.deepEqual(config.rewrites.slice(7), [
    { source: '/lab', destination: { service: 'workflow-lab' } },
    { source: '/lab/(.*)', destination: { service: 'workflow-lab' } },
    { source: '/app/:path*', destination: { service: 'app', path: '/:path*' } },
    { source: '/(.*)', destination: { service: 'company-site' } },
  ]);
  assert.equal(config.services.app.buildCommand, 'VITE_BASE=/app/ npm run build');
  assert.deepEqual(config.services.app.routes, [{
    src: '/app/(.*)',
    transforms: [{ type: 'request.path', op: 'set', args: '/$1' }],
  }]);
});

test('semester.website remains an earlier company-site host rule', () => {
  assert.deepEqual(config.rewrites[0], {
    source: '/(.*)',
    has: [{ type: 'host', value: '(www\\.)?semester\\.website' }],
    destination: { service: 'company-site' },
  });
});

test('the /app worker removes only old /app caches', async () => {
  assert.deepEqual(await activate('/app/', [
    'semester-v0-scope-app-shell',
    'semester-v0-scope-app-media',
    'semester-v1-scope-app-shell',
    'semester-v0-scope-semester-shell',
    'semester-v0-shell',
    'semester-shared',
    'unrelated-media',
  ]), [
    'semester-v0-scope-app-shell',
    'semester-v0-scope-app-media',
  ]);
});

test('root and unsupported nested workers never sweep CacheStorage', async () => {
  const present = ['semester-v0-shell', 'semester-v0-scope-app-shell', 'unrelated'];
  assert.deepEqual(await activate('/', present), []);
  assert.deepEqual(await activate('/nested/app/', present), []);
});

test('the /app worker never handles root APIs or personalized request shapes', () => {
  assert.equal(intercepted('/api/institution/health'), false);
  assert.equal(intercepted('/api/productivity/items'), false);
  assert.equal(intercepted('/app/data.json?student=1'), false);
  assert.equal(intercepted('/app/?screen=study', { syntheticMode: 'navigate' }), true);
  assert.equal(intercepted('/app/data.json', { headers: { Authorization: 'Bearer synthetic' } }), false);
  assert.equal(intercepted('/app/assets/app.js'), true);
});

test('download controls address only media caches from the two supported scopes', () => {
  const downloads = read('app/src/lib/downloads.ts');
  assert.match(downloads, /scope-\(\?:app\|semester\)-media/);
  assert.doesNotMatch(downloads, /endsWith\(MEDIA_SUFFIX\)/);
});

test('the canonical company host opts into /app without changing semester.website links', () => {
  const site = read('company-site/site.js');
  assert.ok(site.includes('semesterintel\\.tech'));
  assert.match(site, /\/app\//);
  assert.match(site, /startsWith\("demo\/"\)/);
  assert.match(site, /installed app/i);
  assert.match(site, /account/i);
});

test('the preview runbook keeps data continuity and PWA limits explicit', () => {
  const runbook = read('docs/infrastructure/UNIFIED-HOSTING-PREVIEW.md');
  assert.match(runbook, /lzrqvlugnawcgywkhqlz/);
  assert.match(runbook, /kpuulmnicidgdmwgfngv/);
  assert.match(runbook, /real-user status is unknown/i);
  assert.match(runbook, /no automatic/i);
  assert.match(runbook, /multipart/i);
  assert.match(runbook, /iOS\/Safari/i);
  assert.match(runbook, /#1427/);
  assert.match(runbook, /#1386/);
  assert.match(runbook, /student-authored/i);
});
