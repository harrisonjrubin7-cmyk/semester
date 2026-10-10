import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, resolve, sep } from 'node:path';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';

const engine = process.env.HOSTING_BROWSER_ENGINE || 'chromium';
const playwrightPath = process.env.HOSTING_PLAYWRIGHT;
const playwright = playwrightPath
  ? createRequire(import.meta.url)(playwrightPath)
  : await import('playwright');
const browserType = playwright[engine];
assert.ok(browserType, `unsupported Playwright browser: ${engine}`);

const dist = resolve(process.cwd(), 'app/dist');
const appIndex = resolve(dist, 'app/index.html');
await stat(appIndex);

const types = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
]);

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://127.0.0.1');
  if (url.pathname === '/__seed') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><title>Seed</title>');
    return;
  }
  if (url.pathname === '/__legacy-sw.js') {
    response.writeHead(200, {
      'content-type': 'text/javascript; charset=utf-8',
      'service-worker-allowed': '/legacy/',
    });
    response.end(`
      const sharedKey = () =>
        new Request(new URL('/legacy-shared', self.location.origin).href, { method: 'GET' });
      self.addEventListener('install', (event) => {
        event.waitUntil(
          caches.open('semester-shared')
            .then((cache) => cache.put(sharedKey(), new Response('legacy-share-sentinel')))
            .then(() => self.skipWaiting())
        );
      });
      self.addEventListener('message', (event) => {
        event.waitUntil((async () => {
          const cache = await caches.open('semester-shared');
          const beforeKeys = await cache.keys();
          const beforeHit = await cache.match(sharedKey());
          await cache.put(sharedKey(), new Response('legacy-share-sentinel'));
          const keys = await cache.keys();
          const hit = await cache.match(sharedKey());
          event.ports[0].postMessage({
            before: {
              entries: beforeKeys.map((request) => ({ url: request.url, method: request.method })),
              present: Boolean(beforeHit),
            },
            after: {
              entries: keys.map((request) => ({ url: request.url, method: request.method })),
              present: Boolean(hit),
              bytes: hit ? (await hit.clone().arrayBuffer()).byteLength : null,
              contentType: hit ? hit.headers.get('content-type') : null,
              vary: hit ? hit.headers.get('vary') : null,
              body: hit ? await hit.text() : null,
            },
          });
        })());
      });
    `);
    return;
  }
  if (url.pathname === '/api/synthetic') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ source: 'origin-server', authorization: request.headers.authorization || null }));
    return;
  }
  if (url.pathname === '/app') {
    response.writeHead(308, { location: '/app/' });
    response.end();
    return;
  }

  let pathname = url.pathname;
  if (pathname === '/app/' || (pathname.startsWith('/app/') && !extname(pathname))) {
    pathname = '/app/index.html';
  }
  const candidate = resolve(dist, `.${pathname}`);
  if (!candidate.startsWith(`${dist}${sep}`)) {
    response.writeHead(400);
    response.end('bad path');
    return;
  }
  try {
    const body = await readFile(candidate);
    response.writeHead(200, { 'content-type': types.get(extname(candidate)) || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('not found');
  }
});

await new Promise((resolveListen, rejectListen) => {
  server.once('error', rejectListen);
  server.listen(0, '127.0.0.1', resolveListen);
});
const address = server.address();
assert.ok(address && typeof address === 'object');
// WebKit's CacheStorage is not durable for service-worker writes on the numeric\n// loopback host in its Linux test shell. localhost is also a trustworthy\n// loopback origin and exercises the same hosted path/scoping contract.\nconst origin = `http://localhost:${address.port}`;
const appUrl = `${origin}/app/`;

let browser;
let context;
let page;
const evidence = { engine, origin, checks: {}, capabilities: {} };
const artifact = `artifacts/unified-hosting-browser-${engine}.json`;

async function saveEvidence() {
  await mkdir('artifacts', { recursive: true });
  await writeFile(artifact, `${JSON.stringify(evidence, null, 2)}\n`);
}

async function readSyntheticDb() {
  return page.evaluate(() => new Promise((resolveRead, rejectRead) => {
    const request = indexedDB.open('semester-hosting-contract-v1');
    request.onerror = () => rejectRead(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('records', 'readonly');
      const get = tx.objectStore('records').getAll();
      get.onerror = () => rejectRead(get.error);
      get.onsuccess = () => resolveRead(get.result);
      tx.oncomplete = () => db.close();
    };
  }));
}

try {
  browser = await browserType.launch({ headless: true });
  evidence.browserVersion = browser.version();
  context = await browser.newContext({ serviceWorkers: 'allow' });
  page = await context.newPage();
  const runtimeEvents = [];
  page.on('console', (message) => runtimeEvents.push(`console:${message.type()}:${message.text()}`));
  page.on('pageerror', (error) => runtimeEvents.push(`pageerror:${error.message}`));
  page.on('requestfailed', (request) => {
    runtimeEvents.push(`requestfailed:${request.url()}:${request.failure()?.errorText || 'unknown'}`);
  });
  evidence.runtimeEvents = runtimeEvents;

  // Seed the same origin before the /app worker exists. These are synthetic
  // authored/pending sentinels, not production account or offline-policy rows.
  await page.goto(`${origin}/__seed`);
  const seedCacheSnapshot = await page.evaluate(async () => {
    localStorage.setItem('semester.contract.authored', 'student-authored-plan');
    localStorage.setItem('semester.contract.pending', 'pending-outbox-item');
    const db = await new Promise((resolveOpen, rejectOpen) => {
      const request = indexedDB.open('semester-hosting-contract-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('records', { keyPath: 'id' });
      request.onerror = () => rejectOpen(request.error);
      request.onsuccess = () => resolveOpen(request.result);
    });
    await new Promise((resolveTx, rejectTx) => {
      const tx = db.transaction('records', 'readwrite');
      const store = tx.objectStore('records');
      store.put({ id: 'authored', value: 'student-authored-plan' });
      store.put({ id: 'pending', value: 'pending-outbox-item' });
      tx.oncomplete = resolveTx;
      tx.onerror = () => rejectTx(tx.error);
      tx.onabort = () => rejectTx(tx.error);
    });
    db.close();

    const cacheNames = [
      'semester-v0-shell',
      'semester-v0-scope-app-shell',
      'semester-v0-scope-nested%2Fapp-shell',
      'semester-shared',
      'unrelated-cache',
    ];
    for (const name of cacheNames) {
      const cache = await caches.open(name);
      await cache.put(`/synthetic/${encodeURIComponent(name)}`, new Response(name));
    }
    const shared = await caches.open('semester-shared');
    await shared.put('/legacy-shared', new Response('legacy-share-sentinel'));

    const keys = await shared.keys();
    const absolute = new URL('/legacy-shared', location.href).href;
    const exact = keys.find((request) => request.url === absolute) || null;
    const describe = async (request) => {
      const response = request ? await shared.match(request) : undefined;
      return response
        ? {
            present: true,
            bytes: (await response.clone().arrayBuffer()).byteLength,
            contentType: response.headers.get('content-type'),
            vary: response.headers.get('vary'),
          }
        : { present: false, bytes: null, contentType: null, vary: null };
    };
    return {
      absolute,
      entries: keys.map((request) => ({ url: request.url, method: request.method })),
      pathMatch: await describe('/legacy-shared'),
      absoluteMatch: await describe(absolute),
      exactMatch: await describe(exact),
    };
  });
  evidence.checks.sharedCacheAtSeed = seedCacheSnapshot;
  assert.equal(seedCacheSnapshot.pathMatch.present, true, 'shared entry must exist when seeded');
  assert.equal(seedCacheSnapshot.absoluteMatch.present, true, 'absolute shared entry must match when seeded');
  assert.equal(seedCacheSnapshot.exactMatch.present, true, 'enumerated shared entry must match when seeded');

  await page.goto(`${origin}/__seed?roundtrip=1`);
  const seedRoundTripSnapshot = await page.evaluate(async () => {
    const cache = await caches.open('semester-shared');
    const keys = await cache.keys();
    const absolute = new URL('/legacy-shared', location.href).href;
    const hit = await cache.match(absolute);
    return {
      absolute,
      entries: keys.map((request) => ({ url: request.url, method: request.method })),
      present: Boolean(hit),
      bytes: hit ? (await hit.clone().arrayBuffer()).byteLength : null,
      vary: hit?.headers.get('vary') || null,
    };
  });
  evidence.checks.sharedCacheAfterSeedNavigation = seedRoundTripSnapshot;
  if (!seedRoundTripSnapshot.present) {
    evidence.limitations ??= [];
    evidence.limitations.push('page-seeded-cache-entry-not-durable-before-worker');
  }

  // A legacy installed app's cache is worker-owned. Seed through a synthetic
  // non-root worker and retain that isolated registration during migration,
  // matching the no-automatic-retirement requirement. It has no fetch handler,
  // cannot control /app, and is not the experimental bridge.
  const legacyWorkerSeed = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register('/__legacy-sw.js', {
      scope: '/legacy/',
    });
    await new Promise((resolveActivated, rejectActivated) => {
      const worker = registration.installing || registration.waiting || registration.active;
      if (worker?.state === 'activated') {
        resolveActivated();
        return;
      }
      if (!worker) {
        rejectActivated(new Error('legacy fixture worker did not install'));
        return;
      }
      const timeout = setTimeout(
        () => rejectActivated(new Error('legacy fixture worker activation timed out')),
        10_000,
      );
      worker.addEventListener('statechange', () => {
        if (worker.state !== 'activated') return;
        clearTimeout(timeout);
        resolveActivated();
      });
    });
    const workerView = await new Promise((resolveView, rejectView) => {
      const channel = new MessageChannel();
      const timeout = setTimeout(
        () => rejectView(new Error('legacy fixture worker probe timed out')),
        10_000,
      );
      channel.port1.onmessage = (event) => {
        clearTimeout(timeout);
        resolveView(event.data);
      };
      registration.active.postMessage({ type: 'inspect-shared-cache' }, [channel.port2]);
    });
    const cache = await caches.open('semester-shared');
    const keys = await cache.keys();
    const absolute = new URL('/legacy-shared', location.href).href;
    const hit = await cache.match(absolute);
    return {
      workerScope: registration.scope,
      workerView,
      entries: keys.map((request) => ({ url: request.url, method: request.method })),
      present: Boolean(hit),
      bytes: hit ? (await hit.clone().arrayBuffer()).byteLength : null,
      contentType: hit?.headers.get('content-type') || null,
      vary: hit?.headers.get('vary') || null,
      registrationRetained: true,
    };
  });
  evidence.checks.sharedCacheFromLegacyWorker = legacyWorkerSeed;
  assert.equal(legacyWorkerSeed.workerScope, `${origin}/legacy/`);
  assert.equal(
    legacyWorkerSeed.workerView.after.body,
    'legacy-share-sentinel',
    `legacy worker must read its exact shared entry: ${JSON.stringify(legacyWorkerSeed)}`,
  );
  assert.equal(
    legacyWorkerSeed.present,
    true,
    `page must see the legacy worker's shared entry: ${JSON.stringify(legacyWorkerSeed)}`,
  );
  assert.equal(legacyWorkerSeed.registrationRetained, true);

  evidence.timings = { appNavigationStartedAt: Date.now() };
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.some((registration) => (
        new URL(registration.scope).pathname === '/app/' &&
        registration.active?.state === 'activated' &&
        new URL(registration.active.scriptURL).pathname === '/app/sw.js'
      ));
    }, undefined, { timeout: 15_000 });
  } catch (error) {
    const registrationDiagnostics = await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      return {
        readyState: document.readyState,
        title: document.title,
        registrations: registrations.map((registration) => ({
          scope: registration.scope,
          active: registration.active?.scriptURL || null,
          installing: registration.installing?.scriptURL || null,
          waiting: registration.waiting?.scriptURL || null,
        })),
      };
    });
    throw new Error(
      `service worker did not become active: ${JSON.stringify({ registrationDiagnostics, runtimeEvents })}`,
      { cause: error },
    );
  }
  evidence.timings.workerActivatedAt = Date.now();
  if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) {
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  try {
    await page.waitForFunction(
      () => Boolean(navigator.serviceWorker.controller),
      undefined,
      { timeout: 15_000 },
    );
  } catch (error) {
    const controllerDiagnostics = await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      return {
        url: location.href,
        controller: navigator.serviceWorker.controller?.scriptURL || null,
        registrations: registrations.map((registration) => ({
          scope: registration.scope,
          active: registration.active
            ? { scriptURL: registration.active.scriptURL, state: registration.active.state }
            : null,
        })),
      };
    });
    throw new Error(
      `activated service worker did not control /app/: ${JSON.stringify({ controllerDiagnostics, runtimeEvents })}`,
      { cause: error },
    );
  }
  await page.waitForFunction(
    async () => !(await caches.keys()).includes('semester-v0-scope-app-shell'),
    undefined,
    { timeout: 15_000 },
  );

  const manifest = await page.evaluate(async () => {
    const response = await fetch('./manifest.webmanifest');
    const body = await response.json();
    const here = location.href;
    const fileAction = new URL(body.file_handlers[0].action, here);
    const protocol = new URL(body.protocol_handlers[0].url.replace('%s', 'today'), here);
    return {
      status: response.status,
      start: new URL(body.start_url, here).pathname,
      scope: new URL(body.scope, here).pathname,
      id: new URL(body.id, here).pathname,
      share: new URL(body.share_target.action, here).pathname,
      fileAction: `${fileAction.pathname}${fileAction.search}`,
      protocol: `${protocol.pathname}${protocol.search}`,
    };
  });
  assert.deepEqual(manifest, {
    status: 200,
    start: '/app/',
    scope: '/app/',
    id: '/app/',
    share: '/app/share',
    fileAction: '/app/?screen=import',
    protocol: '/app/?screen=today',
  });
  evidence.checks.manifest = manifest;

  const worker = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration('/app/');
    return {
      scope: registration ? new URL(registration.scope).pathname : null,
      script: registration?.active ? new URL(registration.active.scriptURL).pathname : null,
      controlled: Boolean(navigator.serviceWorker.controller),
    };
  });
  assert.deepEqual(worker, { scope: '/app/', script: '/app/sw.js', controlled: true });
  evidence.checks.worker = worker;
  evidence.checks.workerArtifact = await page.evaluate(async () => {
    const text = await (await fetch('/app/sw.js', { cache: 'no-store' })).text();
    return {
      version: text.match(/const VERSION = '([^']+)'/)?.[1] || null,
      bytes: new TextEncoder().encode(text).byteLength,
    };
  });

  const cachesAfterActivation = await page.evaluate(() => caches.keys());
  assert.ok(!cachesAfterActivation.includes('semester-v0-scope-app-shell'));
  for (const preserved of [
    'semester-v0-shell',
    'semester-v0-scope-nested%2Fapp-shell',
    'semester-shared',
    'unrelated-cache',
  ]) assert.ok(cachesAfterActivation.includes(preserved), `${preserved} must survive /app activation`);
  assert.ok(cachesAfterActivation.includes('semester-v1-scope-app-shell'));
  evidence.checks.cacheIsolation = cachesAfterActivation.sort();

  const legacyShareAfterActivation = await page.evaluate(async () => {
    const cache = await caches.open('semester-shared');
    const keys = await cache.keys();
    const absolute = new URL('/legacy-shared', location.href).href;
    const exact = keys.find((request) => request.url === absolute) || null;
    const pathHit = await cache.match('/legacy-shared');
    const absoluteHit = await cache.match(absolute);
    const exactHit = exact ? await cache.match(exact) : undefined;
    return {
      absolute,
      entries: keys.map((request) => ({ url: request.url, method: request.method })),
      pathPresent: Boolean(pathHit),
      absolutePresent: Boolean(absoluteHit),
      exactPresent: Boolean(exactHit),
      bytes: exactHit ? (await exactHit.clone().arrayBuffer()).byteLength : null,
      vary: exactHit?.headers.get('vary') || null,
      body: exactHit ? await exactHit.text() : null,
    };
  });
  evidence.checks.legacyShareAfterActivation = legacyShareAfterActivation;
  assert.equal(
    legacyShareAfterActivation.body,
    'legacy-share-sentinel',
    `activation must preserve existing shared-cache entries: ${JSON.stringify(legacyShareAfterActivation)}`,
  );

  const storageBeforeOffline = {
    authored: await page.evaluate(() => localStorage.getItem('semester.contract.authored')),
    pending: await page.evaluate(() => localStorage.getItem('semester.contract.pending')),
    db: await readSyntheticDb(),
  };
  assert.equal(storageBeforeOffline.authored, 'student-authored-plan');
  assert.equal(storageBeforeOffline.pending, 'pending-outbox-item');
  assert.deepEqual(storageBeforeOffline.db, [
    { id: 'authored', value: 'student-authored-plan' },
    { id: 'pending', value: 'pending-outbox-item' },
  ]);
  evidence.checks.storageAfterActivation = storageBeforeOffline;

  const api = await page.evaluate(async () => {
    const response = await fetch('/api/synthetic?student=1', {
      headers: { Authorization: 'Bearer synthetic-only' },
    });
    return { status: response.status, body: await response.json() };
  });
  assert.deepEqual(api, {
    status: 200,
    body: { source: 'origin-server', authorization: 'Bearer synthetic-only' },
  });
  evidence.checks.rootApiBypass = api;

  const share = await page.evaluate(async () => {
    const form = new FormData();
    form.append('file', new File(['synthetic syllabus'], 'Econ 1010 – Syllabus.pdf', { type: 'application/pdf' }));
    const response = await fetch('/app/share', { method: 'POST', body: form });
    const cache = await caches.open('semester-shared');
    const hit = await cache.match('./__shared');
    const legacy = await cache.match('/legacy-shared');
    return {
      responsePath: new URL(response.url).pathname,
      responseSearch: new URL(response.url).search,
      name: hit ? decodeURIComponent(hit.headers.get('x-shared-name') || '') : null,
      type: hit?.headers.get('x-shared-type') || null,
      body: hit ? await hit.text() : null,
      legacy: legacy ? await legacy.text() : null,
    };
  });
  assert.equal(share.responsePath, '/app/');
  assert.equal(share.responseSearch, '?screen=import&shared=1');
  assert.equal(share.legacy, 'legacy-share-sentinel');
  if (engine === 'chromium') {
    assert.deepEqual(
      { name: share.name, type: share.type, body: share.body },
      {
        name: 'Econ 1010 – Syllabus.pdf',
        type: 'application/pdf',
        body: 'synthetic syllabus',
      },
    );
  } else if (share.body !== null) {
    // WebKit support is accepted when available, but the hosted Linux engine
    // currently exercises the safe redirect without exposing the multipart
    // File to the service worker. Real Safari/device consumption remains a gate.
    assert.equal(share.name, 'Econ 1010 – Syllabus.pdf');
    assert.equal(share.type, 'application/pdf');
    assert.equal(share.body, 'synthetic syllabus');
  } else {
    assert.equal(share.name, null);
    assert.equal(share.type, null);
    evidence.limitations ??= [];
    evidence.limitations.push('webkit-hosted-multipart-share-not-consumed');
  }
  evidence.checks.multipartShare = {
    ...share,
    consumed: share.body === 'synthetic syllabus',
  };

  // The persisted store and route modules finish booting after DOMContentLoaded.
  // Let that online boot settle before taking the performance snapshot, or
  // late startup chunks would never be part of the durable-readiness proof.
  await page.waitForFunction(
    () => (document.body?.innerText || '').trim().length > 100,
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForLoadState('networkidle', { timeout: 30_000 });

  // warm() posts asynchronously to the worker. Do not infer readiness from
  // registration: prove every same-origin startup resource used by this page
  // is durable before taking the browser offline.
  const warmedAssets = await page.evaluate(() => {
    const wanted = /\.(js|mjs|css|woff2?|svg|json|webmanifest)$/i;
    return [...new Set(
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name.split('?')[0])
        .filter((url) => url.startsWith(`${location.origin}/app/`) && wanted.test(new URL(url).pathname)),
    )];
  });
  assert.ok(warmedAssets.length > 0, 'the production page must load at least one warmable asset');
  await page.waitForFunction(async (urls) => {
    const cache = await caches.open('semester-v1-scope-app-shell');
    const hits = await Promise.all(urls.map((url) => cache.match(url, { ignoreVary: true })));
    return hits.every(Boolean);
  }, warmedAssets);
  evidence.checks.warmedAssets = warmedAssets.map((url) => new URL(url).pathname).sort();

  await context.setOffline(true);
  await page.goto(`${appUrl}?screen=study`, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.title(), 'Semester');
  try {
    await page.waitForFunction(
      () => (document.body?.innerText || '').trim().length > 100,
      undefined,
      { timeout: 15_000 },
    );
  } catch (error) {
    const offlineDiagnostics = await page.evaluate(async () => ({
      url: location.href,
      body: (document.body?.innerText || '').slice(0, 1_000),
      controller: navigator.serviceWorker.controller?.scriptURL || null,
      caches: await caches.keys(),
    }));
    throw new Error(
      `offline /app relaunch did not render: ${JSON.stringify({
        offlineDiagnostics,
        runtimeEvents: runtimeEvents.slice(-50),
      })}`,
      { cause: error },
    );
  }
  evidence.checks.offlineQueryRelaunch = true;

  const storageOffline = {
    authored: await page.evaluate(() => localStorage.getItem('semester.contract.authored')),
    pending: await page.evaluate(() => localStorage.getItem('semester.contract.pending')),
    db: await readSyntheticDb(),
  };
  assert.deepEqual(storageOffline, storageBeforeOffline);
  evidence.checks.storageAfterOfflineRelaunch = storageOffline;
  await context.setOffline(false);

  const legacyWorkerCleanup = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration('/legacy/');
    return registration ? registration.unregister() : false;
  });
  assert.equal(legacyWorkerCleanup, true, 'synthetic legacy worker must be removed after continuity checks');
  evidence.checks.legacyWorkerCleanup = legacyWorkerCleanup;

  evidence.capabilities = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration('/app/');
    return {
      cacheStorage: 'caches' in window,
      indexedDb: 'indexedDB' in window,
      launchQueue: 'launchQueue' in window,
      pushManager: Boolean(registration?.pushManager),
      beforeInstallPromptObservableOnlyWithBrowserPolicy: true,
    };
  });

  await saveEvidence();
  console.log(`unified hosting browser contract passed (${engine})`);
  console.log(`evidence: ${artifact}`);
} catch (error) {
  evidence.error = {
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };
  await saveEvidence().catch(() => {});
  throw error;
} finally {
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise((resolveClose) => server.close(resolveClose));
}
