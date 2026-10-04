import { assertCacheable, freshness, type DataClass, type TenantOfflinePolicy, NO_OPT_IN } from './policy.ts'

/**
 * Key hierarchy
 *
 *   hardware KEK (Keychain/Secure Enclave or Android Keystore; non-exportable;
 *   gated by biometrics/passkey)
 *     └─ wraps → DEK, random 256-bit, one per environment+tenant+person+device
 *          ├─ SQLCipher key for the content database
 *          └─ wraps → FEK, random 256-bit per cached file (AES-256-GCM)
 *
 * Nothing is derived from a password, email, student id or tenant id. Deleting
 * the KEK erases everything; deleting one wrapped FEK erases one file.
 */

const subtle = () => globalThis.crypto.subtle
const rand = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n))
const buf = (u: Uint8Array): ArrayBuffer => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer

/** A random 256-bit key. A file key must be extractable to be wrapped; a long-lived key held in memory need not be. */
export async function newKey(extractable = true): Promise<CryptoKey> {
  return subtle().generateKey({ name: 'AES-GCM', length: 256 }, extractable, ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'])
}

/** Wrap `inner` under `outer`. The output is IV‖ciphertext; `aad` binds it to what it is for. */
export async function wrapKey(inner: CryptoKey, outer: CryptoKey, aad: string): Promise<Uint8Array> {
  const iv = rand(12)
  const wrapped = new Uint8Array(await subtle().wrapKey('raw', inner, outer, { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad) }))
  return concat(iv, wrapped)
}

export async function unwrapKey(blob: Uint8Array, outer: CryptoKey, aad: string): Promise<CryptoKey> {
  return subtle().unwrapKey('raw', buf(blob.subarray(12)), outer, { name: 'AES-GCM', iv: buf(blob.subarray(0, 12)), additionalData: new TextEncoder().encode(aad) }, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function seal(key: CryptoKey, bytes: Uint8Array, aad: string): Promise<Uint8Array> {
  const iv = rand(12)
  return concat(iv, new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad) }, key, buf(bytes))))
}

export async function open(key: CryptoKey, blob: Uint8Array, aad: string): Promise<Uint8Array> {
  return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: buf(blob.subarray(0, 12)), additionalData: new TextEncoder().encode(aad) }, key, buf(blob.subarray(12))))
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return [...new Uint8Array(await subtle().digest('SHA-256', buf(bytes)))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

// ---- attachment cache ------------------------------------------------------

/** Where ciphertext lives: the app's private files directory on native, OPFS on the web. */
export interface BlobStore {
  put(name: string, bytes: Uint8Array): Promise<void>
  get(name: string): Promise<Uint8Array | undefined>
  delete(name: string): Promise<void>
}

export function memoryBlobs(): BlobStore & { names(): string[] } {
  const m = new Map<string, Uint8Array>()
  return {
    async put(n, b) { m.set(n, b) },
    async get(n) { return m.get(n) },
    async delete(n) { m.delete(n) },
    names: () => [...m.keys()],
  }
}

/** What the server says about the bytes. The device never decides this itself. */
export type ScanState = 'clean' | 'pending' | 'infected' | 'unscannable'

export interface CachedFile {
  id: string
  tenantId: string
  dataClass: DataClass
  /** The entity this file belongs to; revoking that entity revokes the file. */
  ownerEntityId: string
  mime: string
  size: number
  contentSha256: string
  scan: ScanState
  /** Server permission epoch the file was fetched under. */
  aclEpoch: number
  fetchedAt: number
  lastReadAt: number
  pinned: boolean
  wrappedKey: Uint8Array
  blobName: string
}

export interface QuotaPolicy {
  /** Total ciphertext bytes this tenant's cache may hold on this device. */
  totalBytes: number
  /** Largest single file. */
  maxFileBytes: number
  /** Types that may be opened in-app at all. Anything else is saved only as an inert, unopenable file. */
  allowedMime: readonly string[]
}

export const DEFAULT_QUOTA: QuotaPolicy = {
  totalBytes: 250 * 1024 * 1024,
  maxFileBytes: 50 * 1024 * 1024,
  allowedMime: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/markdown'],
}

export type CacheError =
  | 'scan_not_clean'
  | 'type_not_allowed'
  | 'too_large'
  | 'quota_full'
  | 'expired'
  | 'access_revoked'
  | 'integrity_failed'
  | 'not_found'

export class AttachmentError extends Error {
  readonly why: CacheError
  constructor(why: CacheError) {
    super(why)
    this.name = 'AttachmentError'
    this.why = why
  }
}

export interface AttachmentCacheDeps {
  dek: CryptoKey
  blobs: BlobStore
  /** Persisted inside the encrypted database; here, anything that survives a restart. */
  index: { load(): Promise<CachedFile[]>; save(rows: CachedFile[]): Promise<void> }
  now: () => number
  quota?: QuotaPolicy
  tenant?: TenantOfflinePolicy
  scope: { tenantId: string; userId: string; deviceId: string }
}

/**
 * Encrypted, quota-bound, revocable file cache.
 *
 * Only a file the *server* has scanned clean is ever written, and only a clean
 * one is ever opened; a later infected verdict (a re-scan) arrives as a
 * revocation and the bytes are erased. The device runs no antivirus of its own
 * because a mobile one is not a control worth the claim.
 */
export class AttachmentCache {
  private readonly d: AttachmentCacheDeps
  private readonly quota: QuotaPolicy
  constructor(deps: AttachmentCacheDeps) {
    this.d = deps
    this.quota = deps.quota ?? DEFAULT_QUOTA
  }

  private aad(id: string, sha: string): string {
    const s = this.d.scope
    return `${s.tenantId}|${s.userId}|${s.deviceId}|${id}|${sha}`
  }

  async put(meta: Pick<CachedFile, 'id' | 'tenantId' | 'dataClass' | 'ownerEntityId' | 'mime' | 'scan' | 'aclEpoch' | 'pinned'>, bytes: Uint8Array): Promise<CachedFile> {
    assertCacheable(meta.dataClass, this.d.tenant ?? NO_OPT_IN)
    if (meta.scan !== 'clean') throw new AttachmentError('scan_not_clean')
    if (!this.quota.allowedMime.includes(meta.mime)) throw new AttachmentError('type_not_allowed')
    if (bytes.length > this.quota.maxFileBytes) throw new AttachmentError('too_large')

    let rows = await this.d.index.load()
    rows = rows.filter((r) => r.id !== meta.id)
    const sha = await sha256Hex(bytes)
    const fek = await newKey()
    const sealed = await seal(fek, bytes, this.aad(meta.id, sha))
    rows = await this.makeRoom(rows, sealed.length)
    const t = this.d.now()
    const blobName = `${meta.id}.${sha.slice(0, 12)}`
    await this.d.blobs.put(blobName, sealed)
    const row: CachedFile = { ...meta, size: sealed.length, contentSha256: sha, fetchedAt: t, lastReadAt: t, wrappedKey: await wrapKey(fek, this.d.dek, this.aad(meta.id, sha)), blobName }
    await this.d.index.save([...rows, row])
    return row
  }

  /** Evict least-recently-read, unpinned files until `need` bytes fit. Never touches pinned ones. */
  private async makeRoom(rows: CachedFile[], need: number): Promise<CachedFile[]> {
    let used = rows.reduce((n, r) => n + r.size, 0)
    const out = [...rows]
    for (const r of [...rows].filter((x) => !x.pinned).sort((a, b) => a.lastReadAt - b.lastReadAt)) {
      if (used + need <= this.quota.totalBytes) break
      await this.d.blobs.delete(r.blobName)
      out.splice(out.indexOf(r), 1)
      used -= r.size
    }
    if (used + need > this.quota.totalBytes) throw new AttachmentError('quota_full')
    return out
  }

  /** Decrypt and verify. Anything stale, revoked, unclean or altered is refused, never served. */
  async read(id: string, ctx: { aclEpoch: number }): Promise<Uint8Array> {
    const rows = await this.d.index.load()
    const r = rows.find((x) => x.id === id)
    if (!r) throw new AttachmentError('not_found')
    if (r.scan !== 'clean') throw new AttachmentError('scan_not_clean')
    if (ctx.aclEpoch > r.aclEpoch) throw new AttachmentError('access_revoked')
    if (freshness(r.dataClass, r.fetchedAt, this.d.now(), this.d.tenant ?? NO_OPT_IN) === 'expired') throw new AttachmentError('expired')
    const sealed = await this.d.blobs.get(r.blobName)
    if (!sealed) throw new AttachmentError('not_found')
    let bytes: Uint8Array
    try {
      const fek = await unwrapKey(r.wrappedKey, this.d.dek, this.aad(r.id, r.contentSha256))
      bytes = await open(fek, sealed, this.aad(r.id, r.contentSha256))
    } catch {
      throw new AttachmentError('integrity_failed')
    }
    if ((await sha256Hex(bytes)) !== r.contentSha256) throw new AttachmentError('integrity_failed')
    await this.d.index.save(rows.map((x) => (x.id === id ? { ...x, lastReadAt: this.d.now() } : x)))
    return bytes
  }

  /** Erase by file id, by owning entity (membership removed), or everything. Bytes and wrapped key both go. */
  async revoke(match: { ids?: string[]; ownerEntityIds?: string[]; all?: boolean }): Promise<number> {
    const rows = await this.d.index.load()
    const gone = rows.filter((r) => match.all || match.ids?.includes(r.id) || match.ownerEntityIds?.includes(r.ownerEntityId))
    for (const r of gone) await this.d.blobs.delete(r.blobName)
    await this.d.index.save(rows.filter((r) => !gone.includes(r)))
    return gone.length
  }

  /** Drop everything past its class's freshness limit; pinning protects against eviction, not expiry. */
  async sweep(): Promise<number> {
    const rows = await this.d.index.load()
    const stale = rows.filter((r) => freshness(r.dataClass, r.fetchedAt, this.d.now(), this.d.tenant ?? NO_OPT_IN) === 'expired')
    return this.revoke({ ids: stale.map((r) => r.id) })
  }

  async usage(): Promise<{ used: number; limit: number; files: number }> {
    const rows = await this.d.index.load()
    return { used: rows.reduce((n, r) => n + r.size, 0), limit: this.quota.totalBytes, files: rows.length }
  }
}
