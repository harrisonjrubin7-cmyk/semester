import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { stripTypeScriptTypes } from 'node:module';

const require = createRequire(import.meta.url);
const playwright = process.env.SMOKE_PLAYWRIGHT ?? '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const { chromium } = require(playwright);
const source = await readFile(new URL('../src/lib/sync/engine/attachments-idb.ts', import.meta.url), 'utf8');
const javascript = stripTypeScriptTypes(source, { mode: 'transform' });
const server = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
  res.end('<!doctype html><title>synthetic offline attachment adapter</title>');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert(address && typeof address === 'object');
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN ?? '/usr/bin/chromium', args: ['--no-sandbox'] });

try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/`);
  const result = await page.evaluate(async (code) => {
    const moduleUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    const adapter = await import(moduleUrl);
    URL.revokeObjectURL(moduleUrl);

    let opens = 0;
    const disabled = await adapter.openAttachmentPersistence({
      enabled: false,
      factory: { open: () => { opens += 1; throw new Error('disabled runtime opened storage'); } },
    });
    if (disabled !== undefined || opens !== 0) throw new Error('disabled runtime is not inert');

    const identity = { tenantId: 'synthetic-tenant', userId: 'synthetic-user', deviceId: 'synthetic-device' };
    const scope = [identity.tenantId, identity.userId, identity.deviceId].map(encodeURIComponent).join('|');
    const deleteDatabase = () => new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(adapter.ATTACHMENT_DB);
      request.onsuccess = () => resolve(undefined);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('synthetic database deletion was blocked'));
    });
    const legacyFile = (overrides = {}) => ({
      id: 'legacy-file', tenantId: identity.tenantId, dataClass: 'course_content', ownerEntityId: 'course', mime: 'text/plain', size: 1,
      contentSha256: 'legacy', scan: 'clean', aclEpoch: 1, fetchedAt: 1, lastReadAt: 1, pinned: false,
      wrappedKey: new Uint8Array([1]), blobName: 'legacy.generation', ...overrides,
    });
    const seedLegacy = (row) => new Promise((resolve, reject) => {
      const request = indexedDB.open(adapter.ATTACHMENT_DB, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('attachments', { keyPath: 'key' });
        request.result.createObjectStore('blobs', { keyPath: 'key' });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(['attachments', 'blobs'], 'readwrite');
        transaction.objectStore('attachments').put(row);
        transaction.objectStore('blobs').put({ key: `${scope}\u0000legacy.generation`, scope, bytes: new Uint8Array([7]) });
        transaction.oncomplete = () => { database.close(); resolve(undefined); };
        transaction.onerror = () => reject(transaction.error);
      };
    });
    const inspectLegacy = () => new Promise((resolve, reject) => {
      const request = indexedDB.open(adapter.ATTACHMENT_DB);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(['attachments', 'blobs'], 'readonly');
        const metadata = transaction.objectStore('attachments').getAll();
        const blobs = transaction.objectStore('blobs').getAll();
        transaction.oncomplete = () => { const answer = { version: database.version, metadata: metadata.result.length, blobs: blobs.result.length }; database.close(); resolve(answer); };
        transaction.onerror = () => reject(transaction.error);
      };
    });

    const first = await adapter.openAttachmentPersistence({ enabled: true, identity });
    const second = await adapter.openAttachmentPersistence({ enabled: true, identity });
    const make = (id) => ({
      id, tenantId: identity.tenantId, dataClass: 'course_content', ownerEntityId: 'course', mime: 'text/plain', size: 1,
      contentSha256: id, scan: 'clean', aclEpoch: 1, fetchedAt: 1, lastReadAt: 1, pinned: false,
      wrappedKey: new Uint8Array([1]), blobName: `${id}.generation`,
    });
    await Promise.all(Array.from({ length: 24 }, (_, i) => (i % 2 ? first : second).index.update((rows) => ({
      rows: [...rows, make(`file-${i}`)], value: undefined,
    }))));
    const ids = (await first.index.load()).map((row) => row.id).sort();
    await first.blobs.put('persistent-generation', new Uint8Array([9]));
    first.close();
    second.close();
    const reopened = await adapter.openAttachmentPersistence({ enabled: true, identity });
    if ((await reopened.blobs.get('persistent-generation'))?.[0] !== 9) throw new Error('blob did not survive a reopened adapter');
    const other = await adapter.openAttachmentPersistence({ enabled: true, identity: { ...identity, userId: 'synthetic-other' } });
    if ((await other.index.load()).length !== 0 || await other.blobs.get('persistent-generation')) throw new Error('identity scopes shared attachment state');
    reopened.close(); other.close();
    await deleteDatabase();

    // Ambiguous v1 rows fail activation and the aborted versionchange leaves
    // both metadata and bytes in the old schema.
    await seedLegacy({ key: `${scope}\u0000legacy-file`, file: legacyFile(), /* deliberately no scope */ });
    let ambiguous = '';
    try { await adapter.openAttachmentPersistence({ enabled: true, identity }); } catch (error) { ambiguous = error?.code ?? error?.name ?? ''; }
    if (ambiguous !== 'ambiguous_legacy_attachment') throw new Error(`ambiguous legacy activation was not rejected: ${ambiguous}`);
    const preservedAmbiguous = await inspectLegacy();
    if (preservedAmbiguous.version !== 1 || preservedAmbiguous.metadata !== 1 || preservedAmbiguous.blobs !== 1) throw new Error('ambiguous upgrade changed legacy storage');
    await deleteDatabase();

    // A browser-aborted upgrade is atomic. A later adapter open retries the
    // migration and preserves the generation and ciphertext.
    await seedLegacy({ key: `${scope}\u0000legacy-file`, scope, file: legacyFile() });
    await new Promise((resolve) => {
      const request = indexedDB.open(adapter.ATTACHMENT_DB, 2);
      request.onupgradeneeded = () => request.transaction.abort();
      request.onerror = () => resolve(undefined);
    });
    const afterAbort = await inspectLegacy();
    if (afterAbort.version !== 1 || afterAbort.metadata !== 1 || afterAbort.blobs !== 1) throw new Error('interrupted upgrade was partially committed');
    const migrated = await adapter.openAttachmentPersistence({ enabled: true, identity });
    if ((await migrated.index.load()).map((row) => row.blobName).join() !== 'legacy.generation') throw new Error('retry did not migrate the exact generation');
    if ((await migrated.blobs.get('legacy.generation'))?.[0] !== 7) throw new Error('retry lost legacy ciphertext');
    migrated.close();
    await deleteDatabase();

    // Persist the cleanup obligation before deletion, close like a crash, and
    // finish it after restart without targeting another generation.
    const crash = await adapter.openAttachmentPersistence({ enabled: true, identity });
    const retired = legacyFile({ retired: true });
    await crash.blobs.put(retired.blobName, new Uint8Array([5]));
    await crash.index.update(() => ({ rows: [retired], value: undefined }));
    crash.close();
    const recovery = await adapter.openAttachmentPersistence({ enabled: true, identity });
    if (!(await recovery.index.load())[0]?.retired || (await recovery.blobs.get(retired.blobName))?.[0] !== 5) throw new Error('retired cleanup identity did not survive restart');
    await recovery.blobs.delete(retired.blobName);
    await recovery.index.update((rows) => ({ rows: rows.filter((row) => row.blobName !== retired.blobName), value: undefined }));

    // A future upgrade request must not remain blocked by this adapter.
    await new Promise((resolve, reject) => {
      const request = indexedDB.open(adapter.ATTACHMENT_DB, 3);
      request.onupgradeneeded = () => undefined;
      request.onblocked = () => reject(new Error('adapter did not close on versionchange'));
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { request.result.close(); resolve(undefined); };
    });
    recovery.close();
    await deleteDatabase();
    return { opens, count: ids.length, distinct: new Set(ids).size, ambiguous, interruptedUpgrade: 'recovered', retiredRestart: 'recovered', versionchange: 'closed' };
  }, javascript);
  assert.deepEqual(result, { opens: 0, count: 24, distinct: 24, ambiguous: 'ambiguous_legacy_attachment', interruptedUpgrade: 'recovered', retiredRestart: 'recovered', versionchange: 'closed' });
  console.log(JSON.stringify({ browser: 'chromium', indexedDB: 'native', atomicUpdates: 24, upgrades: 'abort-safe', cleanupRestart: 'pass', result: 'pass' }));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
