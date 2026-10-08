import { describe, expect, it } from 'vitest'
import { decodeSnapshot, encodeSnapshot, memoryStore, type StoreSnapshot } from './memory-store.ts'
import { SyncEngine } from './engine.ts'
import { ReferenceGateway } from './testing/reference-gateway.ts'
import { NOW } from './fixtures.ts'
import type { OutboxRow } from './types.ts'

const row = (o: Partial<OutboxRow> = {}): OutboxRow => ({
  id: 'c1', tenantId: 't', userId: 'u', deviceId: 'd', dataClass: 'task', entityId: 'T', op: 'patch', payload: { a: 1 }, baseVersion: 1,
  hlc: { wall: NOW, counter: 0, node: 'd' }, policyVersion: '1', permissionEpoch: 0, createdAt: NOW, expiresAt: NOW + 1, seq: 1, phase: 'queued', attempts: 0, nextAttemptAt: NOW, ...o,
})

describe('snapshot codec', () => {
  it('keeps a terminal rejection terminal across a restart (Infinity is not JSON)', () => {
    const s: StoreSnapshot = { outbox: [row({ phase: 'rejected', nextAttemptAt: Infinity })], entities: [], cursors: { a: '1' } }
    expect(JSON.parse(JSON.stringify(s)).outbox[0].nextAttemptAt).toBeNull() // what plain JSON would have done
    const back = decodeSnapshot(encodeSnapshot(s))
    expect(back.outbox[0]!.nextAttemptAt).toBe(Infinity)
    expect(back.cursors).toEqual({ a: '1' })
  })
  it('reads an old or partial snapshot as empty rather than throwing', () => {
    expect(decodeSnapshot('{}')).toEqual({ outbox: [], entities: [], cursors: {} })
  })
})

describe('write-through store', () => {
  it('persists once per committed transaction and never for a rolled-back one', async () => {
    const writes: StoreSnapshot[] = []
    const s = memoryStore({ onCommit: async (x) => { writes.push(x) } })
    await s.transaction(async () => { await s.outbox.put(row()); await s.cursors.set('k', 'v'); await s.outbox.put(row({ id: 'c2', seq: 2 })) })
    await s.flush()
    expect(writes).toHaveLength(1)
    expect(writes[0]!.outbox).toHaveLength(2)
    await expect(s.transaction(async () => { await s.outbox.put(row({ id: 'c3', seq: 3 })); throw new Error('boom') })).rejects.toThrow('boom')
    await s.flush()
    expect(writes).toHaveLength(1)
    expect(await s.outbox.get('c3')).toBeUndefined()
  })

  it('writes a change made outside a transaction too, and in order', async () => {
    const seen: number[] = []
    const s = memoryStore({ onCommit: async (x) => { await new Promise((r) => setTimeout(r, x.outbox.length === 1 ? 10 : 0)); seen.push(x.outbox.length) } })
    await s.outbox.put(row()); await s.outbox.put(row({ id: 'c2', seq: 2 }))
    await s.flush()
    expect(seen).toEqual([1, 2])
  })

  it('reports a failed write on flush instead of throwing into the engine', async () => {
    const s = memoryStore({ onCommit: async () => { throw new Error('disk full') } })
    await s.outbox.put(row())
    await expect(s.flush()).rejects.toThrow('disk full')
    await expect(s.flush()).resolves.toBeUndefined()
  })

  it('survives a restart: a queued command is still there, unsent, with the same key', async () => {
    let disk = ''
    const gw = new ReferenceGateway({ now: () => NOW })
    const mk = (initial?: StoreSnapshot) => memoryStore({ initial, onCommit: async (x) => { disk = encodeSnapshot(x) } })
    const s1 = mk()
    const e1 = new SyncEngine({ store: s1, transport: gw, identity: { tenantId: 't1', userId: 'u1', deviceId: 'd' }, now: () => NOW, newId: () => 'k1' })
    await e1.write({ dataClass: 'task', entityId: 'T', op: 'create', payload: { title: 'x' } })
    await s1.flush()
    const s2 = mk(decodeSnapshot(disk))
    const e2 = new SyncEngine({ store: s2, transport: gw, identity: { tenantId: 't1', userId: 'u1', deviceId: 'd' }, now: () => NOW, newId: () => 'k2' })
    await e2.recover()
    expect((await s2.outbox.all()).map((r) => r.id)).toEqual(['k1'])
    expect((await e2.syncOnce()).acknowledged).toBe(1)
    expect(gw.seenKeys.has('k1')).toBe(true)
  })
})
