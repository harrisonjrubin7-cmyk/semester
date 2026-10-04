import { describe, expect, it } from 'vitest'
import { AttachmentCache, AttachmentError, DEFAULT_QUOTA, memoryBlobs, newKey, open, seal, sha256Hex, unwrapKey, wrapKey, type CachedFile } from './vault.ts'

const NOW = 1_800_000_000_000
const HOUR = 3_600_000
const bytes = (s: string) => new TextEncoder().encode(s)
const text = (b: Uint8Array) => new TextDecoder().decode(b)
const meta = (id: string, o: Partial<Parameters<AttachmentCache['put']>[0]> = {}) => ({ id, tenantId: 't', dataClass: 'course_content' as const, ownerEntityId: 'course-1', mime: 'application/pdf', scan: 'clean' as const, aclEpoch: 1, pinned: false, ...o })

async function cache(o: { quota?: Partial<typeof DEFAULT_QUOTA>; tenant?: { optIn: never[] } } = {}) {
  const t = { now: NOW }
  const blobs = memoryBlobs()
  let rows: CachedFile[] = []
  const dek = await newKey()
  const c = new AttachmentCache({
    dek, blobs, now: () => t.now, quota: { ...DEFAULT_QUOTA, ...o.quota },
    index: { load: async () => rows, save: async (r) => { rows = r } },
    scope: { tenantId: 't', userId: 'u', deviceId: 'd' },
  })
  return { c, t, blobs, rows: () => rows, dek }
}

describe('key wrapping and sealing', () => {
  it('round-trips, and refuses a blob presented under a different purpose', async () => {
    const k = await newKey()
    const sealed = await seal(k, bytes('hello'), 'file-1')
    expect(text(await open(k, sealed, 'file-1'))).toBe('hello')
    await expect(open(k, sealed, 'file-2')).rejects.toBeTruthy()
  })
  it('never writes plaintext into the sealed form', async () => {
    const sealed = await seal(await newKey(), bytes('SECRET-GRADE-DATA'), 'a')
    expect(text(sealed)).not.toContain('SECRET')
  })
  it('wraps a file key under the database key and not under any other', async () => {
    const dek = await newKey(); const other = await newKey(); const fek = await newKey()
    const w = await wrapKey(fek, dek, 'a')
    await expect(unwrapKey(w, other, 'a')).rejects.toBeTruthy()
    await expect(unwrapKey(w, dek, 'b')).rejects.toBeTruthy()
    expect(await unwrapKey(w, dek, 'a')).toBeTruthy()
  })
  it('hashes the way the server does', async () => {
    expect(await sha256Hex(bytes('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('attachment cache', () => {
  it('stores ciphertext only, and reads the plaintext back', async () => {
    const { c, blobs } = await cache()
    await c.put(meta('f1'), bytes('lecture notes'))
    for (const n of blobs.names()) expect(text((await blobs.get(n))!)).not.toContain('lecture')
    expect(text(await c.read('f1', { aclEpoch: 1 }))).toBe('lecture notes')
  })

  it('refuses a file the server has not scanned clean, for every other verdict', async () => {
    const { c } = await cache()
    for (const scan of ['pending', 'infected', 'unscannable'] as const) {
      await expect(c.put(meta(`f-${scan}`, { scan }), bytes('x'))).rejects.toMatchObject({ why: 'scan_not_clean' })
    }
  })

  it('opens only types it was told to, and caps size', async () => {
    const { c } = await cache({ quota: { maxFileBytes: 10 } })
    await expect(c.put(meta('a', { mime: 'application/x-msdownload' }), bytes('x'))).rejects.toMatchObject({ why: 'type_not_allowed' })
    await expect(c.put(meta('b'), new Uint8Array(100))).rejects.toMatchObject({ why: 'too_large' })
  })

  it('never caches a class the content database must not hold, or an official one without the tenant opting in', async () => {
    const { c } = await cache()
    await expect(c.put(meta('p', { dataClass: 'payment' }), bytes('x'))).rejects.toMatchObject({ why: 'not_cacheable' })
    await expect(c.put(meta('g', { dataClass: 'grade' }), bytes('x'))).rejects.toMatchObject({ why: 'tenant_has_not_opted_in' })
  })

  it('evicts the least recently read unpinned file to make room, and never a pinned one', async () => {
    const { c, t } = await cache({ quota: { totalBytes: 200, maxFileBytes: 200 } })
    const sz = 60 // 12 IV + 16 tag + 60 = 88 sealed
    await c.put(meta('old'), new Uint8Array(sz)); t.now += 10
    await c.put(meta('pinned', { pinned: true }), new Uint8Array(sz)); t.now += 10
    await c.put(meta('new'), new Uint8Array(sz))
    expect((await c.usage()).files).toBe(2)
    await expect(c.read('old', { aclEpoch: 1 })).rejects.toMatchObject({ why: 'not_found' })
    expect(await c.read('pinned', { aclEpoch: 1 })).toBeTruthy()
  })

  it('says the storage is full rather than evict what a person pinned', async () => {
    const { c } = await cache({ quota: { totalBytes: 100, maxFileBytes: 100 } })
    await c.put(meta('pinned', { pinned: true }), new Uint8Array(50))
    await expect(c.put(meta('x'), new Uint8Array(50))).rejects.toMatchObject({ why: 'quota_full' })
    expect(await c.read('pinned', { aclEpoch: 1 })).toBeTruthy()
  })

  it('stops serving a file once access is revoked (a newer permission epoch)', async () => {
    const { c } = await cache()
    await c.put(meta('f'), bytes('x'))
    await expect(c.read('f', { aclEpoch: 2 })).rejects.toMatchObject({ why: 'access_revoked' })
  })

  it('stops serving a file past its freshness limit, even if pinned, and sweeps it', async () => {
    const { c, t, blobs } = await cache()
    await c.put(meta('f', { pinned: true }), bytes('x'))
    t.now += 15 * 24 * HOUR
    await expect(c.read('f', { aclEpoch: 1 })).rejects.toMatchObject({ why: 'expired' })
    expect(await c.sweep()).toBe(1)
    expect(blobs.names()).toEqual([])
  })

  it('erases the bytes and the key when revoked by file, by owner, or all', async () => {
    const { c, blobs, rows } = await cache()
    await c.put(meta('a'), bytes('1')); await c.put(meta('b', { ownerEntityId: 'course-2' }), bytes('2')); await c.put(meta('c', { ownerEntityId: 'course-2' }), bytes('3'))
    expect(await c.revoke({ ids: ['a'] })).toBe(1)
    expect(await c.revoke({ ownerEntityIds: ['course-2'] })).toBe(2)
    expect(blobs.names()).toEqual([]); expect(rows()).toEqual([])
  })

  it('detects a tampered blob', async () => {
    const { c, blobs } = await cache()
    await c.put(meta('f'), bytes('original'))
    const n = blobs.names()[0]!
    const b = new Uint8Array((await blobs.get(n))!); b[b.length - 1]! ^= 1
    await blobs.put(n, b)
    await expect(c.read('f', { aclEpoch: 1 })).rejects.toMatchObject({ why: 'integrity_failed' })
  })

  it('cannot be read with a different database key — destroying the key destroys the cache', async () => {
    const { c, blobs, rows, t } = await cache()
    await c.put(meta('f'), bytes('x'))
    const c2 = new AttachmentCache({ dek: await newKey(), blobs, now: () => t.now, index: { load: async () => rows(), save: async () => {} }, scope: { tenantId: 't', userId: 'u', deviceId: 'd' } })
    await expect(c2.read('f', { aclEpoch: 1 })).rejects.toBeInstanceOf(AttachmentError)
  })

  it('will not read a blob moved to another device, user or tenant (bound by context)', async () => {
    const { c, blobs, rows, dek, t } = await cache()
    await c.put(meta('f'), bytes('x'))
    const moved = new AttachmentCache({ dek, blobs, now: () => t.now, index: { load: async () => rows(), save: async () => {} }, scope: { tenantId: 't', userId: 'someone-else', deviceId: 'd' } })
    await expect(moved.read('f', { aclEpoch: 1 })).rejects.toMatchObject({ why: 'integrity_failed' })
  })
})
