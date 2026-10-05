/**
 * An encrypted record store, one per tenant, person and device.
 *
 * ## What it is
 *
 * Every record is sealed with AES-256-GCM under a key made on this device
 * from random bytes — never derived from the student's id, email or tenant,
 * which are guessable. The key is a non-extractable `CryptoKey`, so script on
 * the page can *use* it but cannot read its bytes out or copy it elsewhere.
 * Each record's tenant, person, device, id, class and clock stamp are bound in
 * as additional authenticated data, so a ciphertext lifted from one record
 * and written into another, or into another person's namespace, fails to open
 * rather than opening as the wrong thing.
 *
 * `wipe()` deletes the key first and then the records: with the key gone the
 * rest is noise even if a record survives in a backup or a journal the
 * browser has not compacted yet.
 *
 * ## What it is not
 *
 * Not the native SQLCipher database in `docs/architecture/offline-sync-contract.md`.
 * That one wraps its key in the iOS Keychain or Android Keystore, where this
 * one relies on the browser's own key storage, which is software. A page that
 * is compromised (XSS) can still ask the key to decrypt. So this closes one
 * thing — a copied profile, a disk image, a shared computer's leftover
 * storage — and not the other. Neither the web client nor this module may
 * claim "encrypted FERPA offline mobile client"; the contract's wording for
 * the web is "encrypted at rest in the browser's storage".
 *
 * ## What it refuses
 *
 * A class `classes.ts` says is not kept offline is refused before encryption,
 * not encrypted: see that file for why. Unknown classes are refused too.
 */

import { OFFLINE_RULES, mayKeep, minimise, type DataClass } from './classes';

/** Where sealed records and the key live. IndexedDB in the app; a map in tests. */
export interface VaultStorage {
  get(id: string): Promise<unknown>;
  put(id: string, value: unknown): Promise<void>;
  del(id: string): Promise<void>;
  keys(): Promise<string[]>;
}

export function memoryStorage(): VaultStorage {
  const m = new Map<string, unknown>();
  return {
    get: async (id) => m.get(id),
    put: async (id, v) => void m.set(id, v),
    del: async (id) => void m.delete(id),
    keys: async () => [...m.keys()],
  };
}

export interface Identity {
  tenantId: string;
  personId: string;
  deviceId: string;
}

export type VaultErrorCode = 'denied_class' | 'unknown_class' | 'wiped' | 'tampered' | 'unavailable' | 'bad_identity';

export class VaultError extends Error {
  readonly code: VaultErrorCode;
  constructor(code: VaultErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'VaultError';
  }
}

interface Sealed {
  id: string;
  cls: DataClass;
  stamp: string;
  storedAt: number;
  expiresAt: number | null;
  iv: Uint8Array;
  ct: Uint8Array;
}

export interface Item<T = unknown> {
  id: string;
  cls: DataClass;
  stamp: string;
  storedAt: number;
  value: T;
}

export interface Vault {
  readonly namespace: string;
  /**
   * Seal and store. Refuses a class that may not be kept offline, and drops
   * fields the class does not allowlist. `envelope: true` skips only that
   * second step, for a wrapper that carries its own bookkeeping (the queue's
   * mutation) and has already minimised the record data inside it; the class
   * gate still applies.
   */
  put(id: string, cls: DataClass, value: Record<string, unknown>, stamp: string, opts?: { envelope?: boolean }): Promise<void>;
  /** Open one. `null` if absent or past its class's age limit (which also deletes it). Throws `tampered` if it will not open. */
  get<T = Record<string, unknown>>(id: string): Promise<Item<T> | null>;
  remove(id: string): Promise<void>;
  /** Ids held, optionally of one class. Reads the unencrypted header only. */
  list(cls?: DataClass): Promise<string[]>;
  /** Destroy the key, then every record. Every later call throws `wiped`. */
  wipe(): Promise<void>;
}

const VERSION = 'semester-vault/v1';
const enc = new TextEncoder();
const dec = new TextDecoder();

function namespaceOf(who: Identity): string {
  for (const [k, v] of Object.entries(who)) {
    if (typeof v !== 'string' || v.length === 0) throw new VaultError('bad_identity', `The vault needs a ${k}.`);
  }
  // encodeURIComponent always escapes "/" and "|" but not ".", so "|" is the
  // separator: no part can contain it, and two different identities cannot
  // spell the same namespace (or, through it, share a key or an AAD).
  return [who.tenantId, who.personId, who.deviceId].map(encodeURIComponent).join('|');
}

const aad = (ns: string, id: string, cls: string, stamp: string): Uint8Array =>
  enc.encode([VERSION, ns, id, cls, stamp].join('|'));

export async function openVault(
  who: Identity,
  storage: VaultStorage,
  opts: { now?: () => number; subtle?: SubtleCrypto; random?: (n: number) => Uint8Array } = {},
): Promise<Vault> {
  const ns = namespaceOf(who);
  const subtle = opts.subtle ?? globalThis.crypto?.subtle;
  if (!subtle) throw new VaultError('unavailable', 'This browser has no Web Crypto, so nothing can be kept encrypted.');
  const now = opts.now ?? Date.now;
  const random = opts.random ?? ((n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n)));
  const keyId = `${ns}/key`;
  const recordId = (id: string) => `${ns}/r/${id}`;
  let wiped = false;

  const alive = () => {
    if (wiped) throw new VaultError('wiped', 'This vault was wiped; open a new one.');
  };

  async function key(create: boolean): Promise<CryptoKey | null> {
    const have = (await storage.get(keyId)) as CryptoKey | undefined;
    if (have) return have;
    if (!create) return null;
    const fresh = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await storage.put(keyId, fresh);
    return fresh;
  }

  return {
    namespace: ns,

    async put(id, cls, value, stamp, opts) {
      alive();
      const verdict = mayKeep(cls);
      if (!verdict.ok) throw new VaultError(verdict.reason, verdict.why);
      const kept = opts?.envelope ? value : minimise(cls, value);
      const iv = random(12);
      const k = (await key(true)) as CryptoKey;
      const ct = new Uint8Array(
        await subtle.encrypt(
          { name: 'AES-GCM', iv: iv as BufferSource, additionalData: aad(ns, id, cls, stamp) as BufferSource },
          k,
          enc.encode(JSON.stringify(kept)) as BufferSource,
        ),
      );
      const maxAge = OFFLINE_RULES[cls].maxAgeMs;
      const sealed: Sealed = { id, cls, stamp, storedAt: now(), expiresAt: maxAge === null ? null : now() + maxAge, iv, ct };
      await storage.put(recordId(id), sealed);
    },

    async get<T>(id: string) {
      alive();
      const sealed = (await storage.get(recordId(id))) as Sealed | undefined;
      if (!sealed) return null;
      if (sealed.expiresAt !== null && now() >= sealed.expiresAt) {
        await storage.del(recordId(id));
        return null;
      }
      const k = await key(false);
      if (!k) throw new VaultError('tampered', 'A record is here but the key that sealed it is not.');
      try {
        const plain = await subtle.decrypt(
          { name: 'AES-GCM', iv: sealed.iv as BufferSource, additionalData: aad(ns, id, sealed.cls, sealed.stamp) as BufferSource },
          k,
          sealed.ct as BufferSource,
        );
        return { id, cls: sealed.cls, stamp: sealed.stamp, storedAt: sealed.storedAt, value: JSON.parse(dec.decode(plain)) as T };
      } catch {
        throw new VaultError('tampered', 'A record did not open: it was changed, moved, or sealed under another key.');
      }
    },

    async remove(id) {
      alive();
      await storage.del(recordId(id));
    },

    async list(cls) {
      alive();
      const prefix = `${ns}/r/`;
      const out: string[] = [];
      for (const k of await storage.keys()) {
        if (!k.startsWith(prefix)) continue;
        if (cls) {
          const sealed = (await storage.get(k)) as Sealed | undefined;
          if (sealed?.cls !== cls) continue;
        }
        out.push(k.slice(prefix.length));
      }
      return out.sort();
    },

    async wipe() {
      // Key first: if the page closes between the two steps, what is left is
      // ciphertext with no key anywhere, which is the outcome wanted.
      await storage.del(keyId);
      for (const k of await storage.keys()) if (k.startsWith(`${ns}/`)) await storage.del(k);
      wiped = true;
    },
  };
}
