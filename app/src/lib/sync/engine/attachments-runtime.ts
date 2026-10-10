import { AttachmentCache, type PolicyPurgeRow, type TenantOfflinePolicy } from '@semester/offline-sync';
import { openAttachmentPersistence, type AttachmentIdentity } from './attachments-idb.ts';

export type OfflineAttachmentRuntimeConfig =
  | { enabled: false; factory?: IDBFactory }
  | { enabled: true; identity: AttachmentIdentity; factory?: IDBFactory; dek: CryptoKey; now: () => number; tenantPolicy?: TenantOfflinePolicy };

export interface OfflineAttachmentRuntime {
  cache: AttachmentCache;
  onPolicyPurge(rows: readonly PolicyPurgeRow[]): Promise<void>;
  close(): void;
}

export function createAttachmentPolicyPurge(cache: AttachmentCache): (rows: readonly PolicyPurgeRow[]) => Promise<void> {
  return async (rows) => {
    // Outbox rows describe commands that were removed, not entities that were
    // removed. Their authored entity (and its attachments) can remain locally.
    const owners = [...new Map(rows
      .filter((row) => row.kind === 'entity')
      .map((row) => [`${row.dataClass}\u0000${row.id}`, { dataClass: row.dataClass, id: row.id }])).values()];
    if (owners.length) await cache.revoke({ owners });
  };
}

export async function openOfflineAttachmentRuntime(config: OfflineAttachmentRuntimeConfig): Promise<OfflineAttachmentRuntime | undefined> {
  if (!config.enabled) return undefined;
  const key = config.dek as Partial<CryptoKey> | undefined;
  if (typeof CryptoKey === 'undefined' || !(config.dek instanceof CryptoKey)
    || key.type !== 'secret' || typeof key.extractable !== 'boolean' || key.algorithm?.name !== 'AES-GCM'
    || !Array.isArray(key.usages) || !key.usages.includes('wrapKey') || !key.usages.includes('unwrapKey')) {
    throw new TypeError('offline attachment persistence requires a genuine AES-GCM wrapping encryption key');
  }
  const persistence = await openAttachmentPersistence(config);
  if (!persistence) throw new Error('enabled attachment persistence did not open');
  const cache = new AttachmentCache({
    dek: config.dek,
    blobs: persistence.blobs,
    index: persistence.index,
    now: config.now,
    tenant: config.tenantPolicy,
    scope: config.identity,
  });
  return { cache, onPolicyPurge: createAttachmentPolicyPurge(cache), close: persistence.close };
}

export type { AttachmentIdentity };

