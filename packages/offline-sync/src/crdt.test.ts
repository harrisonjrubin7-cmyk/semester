import { describe, expect, it } from 'vitest'
import { AddWinsSet, gateUpdate, TextDoc, type CrdtUpdate, type GateDeps, type TextOp } from './crdt.ts'

/** A small deterministic generator, so a failing seed can be replayed. */
const prng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
const shuffle = <T,>(a: T[], r: () => number) => { const o = [...a]; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j]!, o[i]!] } return o }

describe('TextDoc', () => {
  it('edits like text', () => {
    const d = new TextDoc('a')
    d.insert(0, 'hello'); d.insert(5, ' world'); d.delete(0, 1)
    expect(d.text()).toBe('ello world')
  })

  it('puts concurrent inserts at the same spot in one agreed order', () => {
    const a = new TextDoc('a'); const b = new TextDoc('b')
    const base = a.insert(0, 'x'); base.forEach((o) => b.apply(o))
    const oa = a.insert(1, 'A'); const ob = b.insert(1, 'B')
    oa.forEach((o) => b.apply(o)); ob.forEach((o) => a.apply(o))
    expect(a.text()).toBe(b.text())
    expect(a.text()).toHaveLength(3)
  })

  it('ignores a duplicate, and waits for a dependency that has not arrived', () => {
    const a = new TextDoc('a'); const b = new TextDoc('b')
    const [o1, o2, o3] = a.insert(0, 'abc') as [TextOp, TextOp, TextOp]
    b.apply(o3); b.apply(o2)
    expect(b.text()).toBe(''); expect(b.waitingCount()).toBe(2)
    b.apply(o1); b.apply(o1); b.apply(o2)
    expect(b.text()).toBe('abc'); expect(b.waitingCount()).toBe(0)
  })

  it('keeps a deletion from being undone by a concurrent insert next to it', () => {
    const a = new TextDoc('a'); const b = new TextDoc('b')
    a.insert(0, 'abc').forEach((o) => b.apply(o))
    const del = a.delete(1, 1); const ins = b.insert(2, 'X')
    del.forEach((o) => b.apply(o)); ins.forEach((o) => a.apply(o))
    expect(a.text()).toBe(b.text())
    expect(a.text()).toBe('aXc')
  })

  it('converges for three replicas under random edits, reordering and duplicated delivery', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const r = prng(seed)
      const docs = ['a', 'b', 'c'].map((n) => new TextDoc(n))
      const all: TextOp[] = []
      for (let step = 0; step < 30; step++) {
        const d = docs[Math.floor(r() * 3)]!
        const len = d.text().length
        const ops = r() < 0.7 || len === 0 ? d.insert(Math.floor(r() * (len + 1)), 'xyz'.charAt(Math.floor(r() * 3))) : d.delete(Math.floor(r() * len), 1)
        all.push(...ops)
        if (r() < 0.3) { // a partial sync
          const from = docs[Math.floor(r() * 3)]!; const to = docs[Math.floor(r() * 3)]!
          shuffle(from.opsSince(to.stateVector()), r).forEach((o) => to.apply(o))
        }
      }
      for (const d of docs) shuffle([...all, ...all.slice(0, 10)], r).forEach((o) => d.apply(o))
      expect(docs[1]!.text(), `seed ${seed}`).toBe(docs[0]!.text())
      expect(docs[2]!.text(), `seed ${seed}`).toBe(docs[0]!.text())
      for (const d of docs) expect(d.waitingCount()).toBe(0)
    }
  })

  it('reports what a peer is missing', () => {
    const a = new TextDoc('a'); const b = new TextDoc('b')
    a.insert(0, 'hello')
    b.apply(a.opsSince(b.stateVector())[0]!)
    expect(a.opsSince(b.stateVector())).toHaveLength(4)
    a.opsSince(b.stateVector()).forEach((o) => b.apply(o))
    expect(b.text()).toBe('hello')
    expect(a.opsSince(b.stateVector())).toEqual([])
  })
})

describe('AddWinsSet', () => {
  it('keeps an item that one person re-added while another removed it', () => {
    const a = new AddWinsSet<string>('a'); const b = new AddWinsSet<string>('b')
    const add = a.add('comment-1'); b.apply(add)
    const rm = b.remove('comment-1'); const re = a.add('comment-1')
    a.apply(rm); b.apply(re)
    expect(a.values()).toEqual(['comment-1']); expect(b.values()).toEqual(['comment-1'])
  })
  it('removes for good when nobody re-added it', () => {
    const a = new AddWinsSet<string>('a'); const b = new AddWinsSet<string>('b')
    const add = a.add('x'); b.apply(add); const rm = b.remove('x'); a.apply(rm)
    expect(a.values()).toEqual([]); expect(b.values()).toEqual([])
  })
})

describe('the update gate', () => {
  const ops: TextOp[] = [{ kind: 'ins', id: 'a:1', actor: 'a', seq: 1, ts: 1, after: null, ch: 'x' }]
  const upd = (o: Partial<CrdtUpdate> = {}): CrdtUpdate => ({ updateId: 'u1', docId: 'doc', tenantId: 't', userId: 'u', deviceId: 'd', ops, stateVector: {}, policyVersion: '1', permissionEpoch: 1, payloadHash: 'H', dataClass: 'shared_document', ...o })
  const deps = (o: Partial<GateDeps> = {}): GateDeps => ({
    member: () => ({ role: 'editor', epoch: 1 }), docTenant: () => 't', seen: () => false, recent: () => 0, hash: async () => 'H', limits: { maxOps: 100, maxPerMinute: 10 }, ...o,
  })

  it('accepts a good update and recognises a duplicate', async () => {
    expect(await gateUpdate(upd(), deps())).toEqual({ accepted: true, duplicate: false })
    expect(await gateUpdate(upd(), deps({ seen: () => true }))).toEqual({ accepted: true, duplicate: true })
  })

  const refused: [string, Partial<CrdtUpdate>, Partial<GateDeps>][] = [
    ['not_a_crdt_class', { dataClass: 'grade' }, {}],
    ['not_a_crdt_class', { dataClass: 'payment' }, {}],
    ['tenant_mismatch', {}, { docTenant: () => 'other' }],
    ['not_a_member', {}, { member: () => null }],
    ['read_only', {}, { member: () => ({ role: 'viewer', epoch: 1 }) }],
    ['permission_epoch_stale', { permissionEpoch: 1 }, { member: () => ({ role: 'editor', epoch: 2 }) }],
    ['too_large', {}, { limits: { maxOps: 0, maxPerMinute: 10 } }],
    ['rate_limited', {}, { recent: () => 10 }],
    ['hash_mismatch', { payloadHash: 'tampered' }, {}],
    ['malformed', { ops: [] }, {}],
  ]
  for (const [reason, u, g] of refused) {
    it(`refuses: ${reason}`, async () => {
      expect(await gateUpdate(upd(u), deps(g))).toMatchObject({ accepted: false, reason })
    })
  }

  it('refuses a replayed update from someone removed since they queued it', async () => {
    let member: ReturnType<GateDeps['member']> = { role: 'editor', epoch: 1 }
    const g = deps({ member: () => member })
    expect((await gateUpdate(upd(), g)).accepted).toBe(true)
    member = null
    expect(await gateUpdate(upd({ updateId: 'u2' }), g)).toMatchObject({ accepted: false, reason: 'not_a_member' })
  })
})
