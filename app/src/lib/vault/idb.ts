import { store } from '../idb';
import type { VaultStorage } from './vault';

/**
 * The vault's sealed records and its key, in IndexedDB.
 *
 * Its own database (`semester-vault`), apart from `semester-store`, so that
 * "Erase device" (`lib/erase.ts`) can clear exactly this, and so a schema
 * change to the working copy cannot touch it. A `CryptoKey` is structured-
 * cloneable, which is what lets the non-extractable key be stored at all.
 */
export const VAULT_DB = 'semester-vault';
const STORE = 'sealed';

export function idbStorage(): VaultStorage {
  const s = store(VAULT_DB, STORE);
  return {
    get: async (id) => ((await s.tx('readonly', (o) => o.get(id) as IDBRequest<{ id: string; value: unknown } | undefined>)))?.value,
    put: (id, value) => s.tx('readwrite', (o) => o.put({ id, value })).then(() => undefined),
    del: (id) => s.tx('readwrite', (o) => o.delete(id)).then(() => undefined),
    keys: async () => (await s.tx('readonly', (o) => o.getAllKeys())).map(String),
  };
}

/** Empty the whole database: every vault on this device, every key. For Erase device. */
export async function eraseVaults(): Promise<void> {
  try {
    await store(VAULT_DB, STORE).tx('readwrite', (o) => o.clear());
  } catch {
    // Never opened, so nothing was ever kept.
  }
}
