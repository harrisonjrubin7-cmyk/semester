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
    const owners = [...new Map(rows.map((row) => [`${row.dataClass}\u0000${row.id}`, { dataClass: row.dataClass, id: row.id }])).values()];
    if (owners.length) await cache.revoke({ owners });
  };
}

export async function openOfflineAttachmentRuntime(config: OfflineAttachmentRuntimeConfig): Promise<OfflineAttachmentRuntime | undefined> {
  const persistence = await openAttachmentPersistence(config);
  if (!persistence) return undefined;
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

