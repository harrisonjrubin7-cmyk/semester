import { describe, expect, it } from 'vitest'
import { AttachmentCache, AttachmentError, DEFAULT_QUOTA, memoryBlobs, newKey, open, seal, sha256Hex, unwrapKey, wrapKey, type CachedFile } from './vault.ts'

const NOW = 1_800_000_000_000
const HOUR = 3_600_000
const bytes = (s: string) => new TextEncoder().encode(s)
const text = (b: Uint8Array) => new TextDecoder().decode(b)
const meta = (id: string, o: Partial<Parameters<AttachmentCache['put']>[0]> = {}) => ({ id, tenantId: 't', dataClass: 'course_content' as const, ownerEntityId: 'course-1', mime: 'application/pdf', scan: 'clean' as const, aclEpoch: 1, pinned: false, ...o })
const indexFor = (read: () => CachedFile[], write: (rows: CachedFile[]) => void) => ({
  load: async () => structuredClone(read()),
  update: async <T>(change: (rows: CachedFile[]) => { rows: CachedFile[]; value: T }) => {
    const result = change(structuredClone(read()))
    write(structuredClone(result.rows))
    return result.value
  },
})

async function cache(o: { quota?: Partial<typeof DEFAULT_QUOTA>; tenant?: { optIn: never[] } } = {}) {
  const t = { now: NOW }
  const blobs = memoryBlobs()
  let rows: CachedFile[] = []
  const dek = await newKey()
  const c = new AttachmentCache({
    dek, blobs, now: () => t.now, quota: { ...DEFAULT_QUOTA, ...o.quota },
    index: indexFor(() => rows, (next) => { rows = next }),
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
  it('does not delete a concurrent same-content replacement when expiring an observed row', async () => {
    const blobs = memoryBlobs()
    let rows: CachedFile[] = []
    let now = NOW
    let replaceDuringLoad = false
    let loads = 0
    let c: AttachmentCache
    const index = {
      load: async () => {
        const observed = structuredClone(rows)
        loads += 1
        // read() first checks for unfinished retired cleanup, then observes the
        // active generation. Replace only after that operation-level snapshot.
        if (replaceDuringLoad && loads === 2) {
          replaceDuringLoad = false
          await c.put(meta('file'), bytes('old file'))
        }
        return observed
      },
      update: indexFor(() => rows, (next) => { rows = next }).update,
    }
    c = new AttachmentCache({ dek: await newKey(), blobs, index, now: () => now, scope: { tenantId: 't', userId: 'u', deviceId: 'd' } })
    const old = await c.put(meta('file'), bytes('old file'))
    now += 15 * 24 * HOUR
    loads = 0
    replaceDuringLoad = true
    await expect(c.read('file', { aclEpoch: 1 })).rejects.toMatchObject({ why: 'expired' })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.blobName).not.toBe(old.blobName)
    expect(blobs.names()).toEqual([rows[0]!.blobName])
  })

  it('lets a same-id replacement win revoke and sweep interleavings', async () => {
    for (const operation of ['revoke', 'sweep'] as const) {
      const blobs = memoryBlobs()
      let rows: CachedFile[] = []
      let now = NOW
      let replaceDuringLoad = false
      let loads = 0
      let c: AttachmentCache
      const index = {
        load: async () => {
          const observed = structuredClone(rows)
          loads += 1
          // revoke()/sweep() first replay retired cleanup, then take the
          // generation-specific snapshot that this race needs to replace.
          if (replaceDuringLoad && loads === 2) {
            replaceDuringLoad = false
            await c.put(meta('file'), bytes(`new-${operation}`))
          }
          return observed
        },
        update: indexFor(() => rows, (next) => { rows = next }).update,
      }
      c = new AttachmentCache({ dek: await newKey(), blobs, index, now: () => now, scope: { tenantId: 't', userId: 'u', deviceId: 'd' } })
      const old = await c.put(meta('file'), bytes(`old-${operation}`))
      if (operation === 'sweep') now += 15 * 24 * HOUR
      loads = 0
      replaceDuringLoad = true
      if (operation === 'revoke') await c.revoke({ ids: ['file'] })
      else await c.sweep()
      expect(rows, operation).toHaveLength(1)
      expect(rows[0]?.blobName, operation).not.toBe(old.blobName)
      expect(blobs.names(), operation).toEqual([rows[0]!.blobName])
    }
  })

  it('preserves a replacement written during generation-specific blob cleanup', async () => {
    const raw = memoryBlobs()
    let rows: CachedFile[] = []
    let replaceOnDelete = false
    let c: AttachmentCache
    const blobs = {
      put: raw.put,
      get: raw.get,
      delete: async (name: string) => {
        if (replaceOnDelete) {
          replaceOnDelete = false
          await c.put(meta('file'), bytes('same content'))
        }
        await raw.delete(name)
      },
    }
    c = new AttachmentCache({ dek: await newKey(), blobs, index: indexFor(() => rows, (next) => { rows = next }), now: () => NOW, scope: { tenantId: 't', userId: 'u', deviceId: 'd' } })
    const old = await c.put(meta('file'), bytes('same content'))
    replaceOnDelete = true
    expect(await c.revoke({ ids: ['file'] })).toBe(1)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.blobName).not.toBe(old.blobName)
    expect(raw.names()).toEqual([rows[0]!.blobName])
  })

  it('retains exact retry identity when blob deletion is interrupted', async () => {
    const raw = memoryBlobs()
    let rows: CachedFile[] = []
    let fail = true
    const blobs = {
      put: raw.put,
      get: raw.get,
      delete: async (name: string) => {
        if (fail) { fail = false; throw new Error('delete interrupted') }
        await raw.delete(name)
      },
    }
    const c = new AttachmentCache({ dek: await newKey(), blobs, index: indexFor(() => rows, (next) => { rows = next }), now: () => NOW, scope: { tenantId: 't', userId: 'u', deviceId: 'd' } })
    const row = await c.put(meta('file'), bytes('protected'))
    await expect(c.revoke({ ids: ['file'] })).rejects.toThrow(/delete interrupted/)
    expect(rows.map((candidate) => candidate.blobName)).toEqual([row.blobName])
    expect(raw.names()).toEqual([row.blobName])
    expect(await c.revoke({ ids: ['file'] })).toBe(1)
    expect(rows).toEqual([])
    expect(raw.names()).toEqual([])
  })

  it('durably marks the exact generation retired before deleting its blob', async () => {
    const raw = memoryBlobs()
    let rows: CachedFile[] = []
    const blobs = {
      put: raw.put,
      get: raw.get,
      delete: async (name: string) => {
        expect(rows.find((row) => row.blobName === name)?.retired).toBe(true)
        await raw.delete(name)
      },
    }
    const c = new AttachmentCache({ dek: await newKey(), blobs, index: indexFor(() => rows, (next) => { rows = next }), now: () => NOW, scope: { tenantId: 't', userId: 'u', deviceId: 'd' } })
    await c.put(meta('file'), bytes('protected'))
    expect(await c.revoke({ ids: ['file'] })).toBe(1)
    expect(rows).toEqual([])
  })

  it('retains durable cleanup identity when replacement cleanup is interrupted', async () => {
    const raw = memoryBlobs()
    let rows: CachedFile[] = []
    let fail = true
    const blobs = {
      put: raw.put,
      get: raw.get,
      delete: async (name: string) => {
        if (fail) { fail = false; throw new Error('replacement cleanup interrupted') }
        await raw.delete(name)
      },
    }
    const c = new AttachmentCache({ dek: await newKey(), blobs, index: indexFor(() => rows, (next) => { rows = next }), now: () => NOW, scope: { tenantId: 't', userId: 'u', deviceId: 'd' } })
    const old = await c.put(meta('file'), bytes('old'))
    await expect(c.put(meta('file'), bytes('new'))).rejects.toThrow(/cleanup interrupted/)
    expect(rows.filter((row) => row.retired).map((row) => row.blobName)).toEqual([old.blobName])
    expect(rows.filter((row) => !row.retired)).toHaveLength(1)
    expect(raw.names()).toHaveLength(2)
    expect((await c.usage()).files).toBe(1)
    expect(rows.some((row) => row.retired)).toBe(false)
    expect(raw.names()).toHaveLength(1)
  })

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

  it('never caches grades, transcripts, aid, guardian projections or other prohibited classes', async () => {
    const { c } = await cache()
    for (const dataClass of ['grade', 'academic_record', 'financial_aid', 'guardian_projection', 'payment'] as const) {
      await expect(c.put(meta(dataClass, { dataClass }), bytes('x')), dataClass).rejects.toMatchObject({ why: 'not_cacheable' })
    }
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

  it('stops serving and immediately purges a file past its freshness limit, even if pinned', async () => {
    const { c, t, blobs } = await cache()
    await c.put(meta('f', { pinned: true }), bytes('x'))
    t.now += 15 * 24 * HOUR
    await expect(c.read('f', { aclEpoch: 1 })).rejects.toMatchObject({ why: 'expired' })
    expect(await c.sweep()).toBe(0)
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
    const c2 = new AttachmentCache({ dek: await newKey(), blobs, now: () => t.now, index: indexFor(rows, () => {}), scope: { tenantId: 't', userId: 'u', deviceId: 'd' } })
    await expect(c2.read('f', { aclEpoch: 1 })).rejects.toBeInstanceOf(AttachmentError)
  })

  it('will not read a blob moved to another device, user or tenant (bound by context)', async () => {
    const { c, blobs, rows, dek, t } = await cache()
    await c.put(meta('f'), bytes('x'))
    const moved = new AttachmentCache({ dek, blobs, now: () => t.now, index: indexFor(rows, () => {}), scope: { tenantId: 't', userId: 'someone-else', deviceId: 'd' } })
    await expect(moved.read('f', { aclEpoch: 1 })).rejects.toMatchObject({ why: 'integrity_failed' })
  })
})
