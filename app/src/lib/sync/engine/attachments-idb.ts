import type { BlobStore, CachedFile } from '@semester/offline-sync';

export interface AttachmentIdentity {
  tenantId: string;
  userId: string;
  deviceId: string;
}

export interface AttachmentIndex {
  load(): Promise<CachedFile[]>;
  update<T>(change: (rows: CachedFile[]) => { rows: CachedFile[]; value: T }): Promise<T>;
}

export interface AttachmentPersistence {
  index: AttachmentIndex;
  blobs: BlobStore;
  close(): void;
}

export type AttachmentPersistenceConfig =
  | { enabled: false; factory?: IDBFactory }
  | { enabled: true; identity: AttachmentIdentity; factory?: IDBFactory };

export const ATTACHMENT_DB = 'semester-offline-attachments';
const VERSION = 2;
const GENERATIONS = 'generations';
const BLOBS = 'blobs';
const LEGACY_GENERATIONS = 'attachments';

export class AmbiguousLegacyAttachmentError extends Error {
  readonly code = 'ambiguous_legacy_attachment';
  constructor() {
    super('Legacy attachment metadata has no safe scope or generation identity; activation was aborted.');
    this.name = 'AmbiguousLegacyAttachmentError';
  }
}

interface StoredGeneration {
  key: string;
  scope: string;
  file: CachedFile;
}

interface StoredBlob {
  key: string;
  scope: string;
  bytes: Uint8Array;
}

function scopeOf(identity: AttachmentIdentity): string {
  const parts = [identity.tenantId, identity.userId, identity.deviceId];
  if (parts.some((part) => typeof part !== 'string' || part.length === 0)) throw new TypeError('attachment persistence requires a current identity scope');
  return parts.map(encodeURIComponent).join('|');
}

const scoped = (scope: string, generation: string) => `${scope}\u0000${generation}`;

function request<T>(operation: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error ?? new Error('IndexedDB request failed'));
  });
}

function complete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

/** Default-off browser persistence for server-issued offline attachments. */
export async function openAttachmentPersistence(config: AttachmentPersistenceConfig): Promise<AttachmentPersistence | undefined> {
  if (!config.enabled) return undefined;
  const scope = scopeOf(config.identity);
  const factory = config.factory ?? globalThis.indexedDB;
  if (!factory) throw new Error('IndexedDB is unavailable');

  let closed = false;
  const opened = new Promise<IDBDatabase>((resolve, reject) => {
    const operation = factory.open(ATTACHMENT_DB, VERSION);
    let upgradeError: Error | undefined;
    let answered = false;
    const answer = (database?: IDBDatabase, error?: Error) => {
      if (answered) {
        database?.close();
        return;
      }
      answered = true;
      if (error) reject(error);
      else resolve(database!);
    };
    operation.onupgradeneeded = (event) => {
      const database = operation.result;
      const oldVersion = (event as IDBVersionChangeEvent).oldVersion;
      if (oldVersion === 0) {
        database.createObjectStore(GENERATIONS, { keyPath: 'key' });
        database.createObjectStore(BLOBS, { keyPath: 'key' });
        return;
      }
      if (oldVersion === 1) {
        const transaction = operation.transaction!;
        if (!database.objectStoreNames.contains(LEGACY_GENERATIONS) || !database.objectStoreNames.contains(BLOBS)) {
          upgradeError = new AmbiguousLegacyAttachmentError();
          transaction.abort();
          return;
        }
        const generations = database.createObjectStore(GENERATIONS, { keyPath: 'key' });
        const cursor = transaction.objectStore(LEGACY_GENERATIONS).openCursor();
        cursor.onerror = () => {
          upgradeError = new AmbiguousLegacyAttachmentError();
          transaction.abort();
        };
        cursor.onsuccess = () => {
          const item = cursor.result;
          if (!item) {
            database.deleteObjectStore(LEGACY_GENERATIONS);
            return;
          }
          const row = item.value as Partial<StoredGeneration> | undefined;
          const file = row?.file as Partial<CachedFile> | undefined;
          if (!row || typeof row.scope !== 'string' || row.scope.length === 0 || !file || typeof file.blobName !== 'string' || file.blobName.length === 0) {
            upgradeError = new AmbiguousLegacyAttachmentError();
            transaction.abort();
            return;
          }
          generations.put({ key: scoped(row.scope, file.blobName), scope: row.scope, file: row.file } satisfies StoredGeneration);
          item.continue();
        };
      }
    };
    operation.onsuccess = () => {
      const database = operation.result;
      database.onversionchange = () => database.close();
      if (closed) {
        database.close();
        answer(undefined, new Error('attachment persistence was closed while opening'));
      } else answer(database);
    };
    operation.onblocked = () => answer(undefined, new Error('attachment persistence upgrade was blocked by another connection'));
    operation.onerror = () => answer(undefined, upgradeError ?? operation.error ?? new Error('IndexedDB open failed'));
  });
  const database = await opened;

  const rowsForScope = async (store: IDBObjectStore): Promise<StoredGeneration[]> => {
    const rows = await request(store.getAll() as IDBRequest<StoredGeneration[]>);
    return rows.filter((row) => row.scope === scope);
  };

  const index: AttachmentIndex = {
    async load() {
      const transaction = database.transaction(GENERATIONS, 'readonly');
      const rows = await rowsForScope(transaction.objectStore(GENERATIONS));
      await complete(transaction);
      return rows.map((row) => structuredClone(row.file));
    },
    async update<T>(change: (rows: CachedFile[]) => { rows: CachedFile[]; value: T }): Promise<T> {
      const transaction = database.transaction(GENERATIONS, 'readwrite');
      const store = transaction.objectStore(GENERATIONS);
      let answer!: T;
      try {
        const current = await rowsForScope(store);
        const next = change(current.map((row) => structuredClone(row.file)));
        const names = new Set<string>();
        for (const file of next.rows) {
          if (file.tenantId !== config.identity.tenantId) throw new Error('attachment row escaped its tenant scope');
          if (!file.blobName || names.has(file.blobName)) throw new Error('attachment generations require unique blob names');
          names.add(file.blobName);
        }
        for (const row of current) store.delete(row.key);
        for (const file of next.rows) store.put({ key: scoped(scope, file.blobName), scope, file: structuredClone(file) } satisfies StoredGeneration);
        answer = next.value;
      } catch (error) {
        transaction.abort();
        await complete(transaction).catch(() => undefined);
        throw error;
      }
      await complete(transaction);
      return answer;
    },
  };

  const blobs: BlobStore = {
    async put(name, bytes) {
      const transaction = database.transaction(BLOBS, 'readwrite');
      transaction.objectStore(BLOBS).put({ key: scoped(scope, name), scope, bytes: structuredClone(bytes) } satisfies StoredBlob);
      await complete(transaction);
    },
    async get(name) {
      const transaction = database.transaction(BLOBS, 'readonly');
      const row = await request(transaction.objectStore(BLOBS).get(scoped(scope, name)) as IDBRequest<StoredBlob | undefined>);
      await complete(transaction);
      return row && new Uint8Array(row.bytes);
    },
    async delete(name) {
      const transaction = database.transaction(BLOBS, 'readwrite');
      transaction.objectStore(BLOBS).delete(scoped(scope, name));
      await complete(transaction);
    },
  };

  return { index, blobs, close: () => { closed = true; database.close(); } };
}

/** Clear every schema generation, including an ambiguous legacy one, only for explicit device erasure. */
export async function clearOfflineAttachmentPersistence(factory: IDBFactory = globalThis.indexedDB): Promise<void> {
  if (!factory) return;
  await new Promise<void>((resolve) => {
    const operation = factory.open(ATTACHMENT_DB);
    operation.onerror = () => resolve();
    operation.onsuccess = () => {
      const database = operation.result;
      const names = [GENERATIONS, LEGACY_GENERATIONS, BLOBS].filter((name) => database.objectStoreNames.contains(name));
      if (names.length === 0) {
        database.close();
        resolve();
        return;
      }
      const transaction = database.transaction(names, 'readwrite');
      for (const name of names) transaction.objectStore(name).clear();
      const done = () => { database.close(); resolve(); };
      transaction.oncomplete = done;
      transaction.onerror = done;
      transaction.onabort = done;
    };
  });
}

