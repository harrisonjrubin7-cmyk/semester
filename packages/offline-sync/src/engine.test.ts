import { describe, expect, it } from 'vitest'
import { memoryStore } from './memory-store.ts'
import { SyncEngine } from './engine.ts'
import { OfflinePolicyError } from './policy.ts'
import { ReferenceGateway } from './testing/reference-gateway.ts'
import { NOW, rig } from './fixtures.ts'
import type { SyncTransport } from './types.ts'

const hlc = (wall: number, node = 'x') => ({ wall, counter: 0, node })
const task = (title = 'Read ch. 3') => ({ dataClass: 'task' as const, entityId: 'T1', op: 'create' as const, payload: { title, done: false } })

describe('writing offline', () => {
  it('shows pending, not synced, until the server answers — and the value is readable meanwhile', async () => {
    const r = rig()
    const e = await r.engine.write(task())
    expect(r.engine.stateOf(e)).toBe('pending')
    expect(e.value).toEqual({ title: 'Read ch. 3', done: false })
    expect((await r.engine.summary()).counts.pending).toBe(1)
  })

  it('becomes synced only after an acknowledgement, and then stays one record on the server', async () => {
    const r = rig()
    await r.engine.write(task())
    const rep = await r.sync()
    expect(rep.acknowledged).toBe(1)
    const e = (await r.store.entities.get('task', 'T1'))!
    expect(r.engine.stateOf(e)).toBe('synced')
    expect(e.version).toBe(1)
    await r.sync(); await r.sync()
    expect(r.gw.records.get('task\u0000T1')!.version).toBe(1)
  })

  it('refuses to queue anything the policy forbids, and leaves no trace in the queue', async () => {
    const r = rig()
    for (const dataClass of ['grade_change', 'payment', 'registration', 'permission_grant', 'approval', 'academic_record'] as const) {
      await expect(r.engine.write({ dataClass, entityId: 'x', op: 'patch', payload: { a: 1 } }), dataClass).rejects.toBeInstanceOf(OfflinePolicyError)
    }
    expect(await r.store.outbox.all()).toEqual([])
    expect(await r.store.entities.all()).toEqual([])
  })

  it('folds successive edits that have not left the device into one command', async () => {
    const r = rig()
    await r.engine.write(task()); await r.sync()
    await r.engine.write({ dataClass: 'task', entityId: 'T1', op: 'patch', payload: { title: 'a' } })
    await r.engine.write({ dataClass: 'task', entityId: 'T1', op: 'patch', payload: { done: true } })
    const rows = await r.store.outbox.all()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.payload).toEqual({ title: 'a', done: true })
  })

  it('keeps one command per item in flight and rebases the next on what the server says', async () => {
    const r = rig()
    await r.engine.write(task()); await r.sync()
    await r.engine.write({ dataClass: 'task', entityId: 'T1', op: 'patch', payload: { title: 'one' } })
    // A second command for the same item that cannot coalesce (a different op kind).
    const first = (await r.store.outbox.all())[0]!
    await r.store.outbox.put({ ...first, id: 'second', seq: first.seq + 1, op: 'delete', payload: null })
    await r.sync()
    const after = await r.store.outbox.all()
    expect(after.map((x) => x.id)).toEqual(['second'])
    expect(after[0]!.baseVersion).toBe(2)
  })
})

describe('lost answers and crashes', () => {
  it('treats a lost response as unknown, asks, and ends with exactly one record', async () => {
    const r = rig({ gateway: { loseResponses: 1 } })
    await r.engine.write(task())
    expect((await r.sync()).stopped).toBe('offline')
    const row = (await r.store.outbox.all())[0]!
    expect(row.phase).toBe('pending_reconciliation')
    expect(r.engine.stateOf((await r.store.entities.get('task', 'T1'))!)).toBe('pending')
    r.advance(10 * 60_000)
    const rep = await r.sync()
    expect(rep.acknowledged).toBe(1)
    expect(r.gw.records.get('task\u0000T1')!.version).toBe(1)
    expect(r.engine.stateOf((await r.store.entities.get('task', 'T1'))!)).toBe('synced')
  })

  it('reads a row left "sent" by a crash as ambiguous, not as unsent', async () => {
    const r = rig()
    await r.engine.write(task())
    const row = (await r.store.outbox.all())[0]!
    await r.store.outbox.put({ ...row, phase: 'sent' })
    const reborn = new SyncEngine({ store: r.store, transport: r.gw, identity: { tenantId: 't1', userId: 'u1', deviceId: 'dev-a' }, now: () => r.t.now, newId: () => 'z' })
    await reborn.recover()
    expect((await r.store.outbox.all())[0]!.phase).toBe('pending_reconciliation')
    await reborn.syncOnce()
    expect((await r.store.outbox.all())).toEqual([])
  })

  it('sends again, with the same key, when the server never saw it', async () => {
    const r = rig()
    await r.engine.write(task())
    const row = (await r.store.outbox.all())[0]!
    await r.store.outbox.put({ ...row, phase: 'pending_reconciliation' })
    await r.sync()
    expect(r.gw.seenKeys.has(row.id)).toBe(true)
    expect(r.gw.records.get('task\u0000T1')!.version).toBe(1)
  })

  it('shares one run between overlapping syncs', async () => {
    let pushes = 0
    const r = rig()
    const inner = r.gw
    const counting: SyncTransport = { push: (q) => { pushes++; return inner.push(q) }, status: (q) => inner.status(q), pull: (q) => inner.pull(q) }
    const e = new SyncEngine({ store: r.store, transport: counting, identity: { tenantId: 't1', userId: 'u1', deviceId: 'dev-a' }, now: () => r.t.now, newId: () => 'c1' })
    await e.write(task())
    await Promise.all([e.syncOnce(), e.syncOnce(), e.syncOnce()])
    expect(pushes).toBe(1)
  })
})

describe('the order of durable writes', () => {
  it('records "sent" on disk before the network call, so a crash mid-call reads as ambiguous', async () => {
    const r = rig()
    let during: string | undefined
    const inner = r.gw
    const spy: SyncTransport = {
      push: async (q) => { during = (await r.store.outbox.get(q.commands[0]!.id))?.phase; return inner.push(q) },
      status: (q) => inner.status(q), pull: (q) => inner.pull(q),
    }
    const e = new SyncEngine({ store: r.store, transport: spy, identity: { tenantId: 't1', userId: 'u1', deviceId: 'dev-a' }, now: () => r.t.now, newId: () => 'c1' })
    await e.write(task()); await e.syncOnce()
    expect(during).toBe('sent')
  })
})

describe('retry, backoff and giving up', () => {
  it('waits before resending after a retry answer, and honours Retry-After', async () => {
    const r = rig()
    let first = true
    const real = r.gw.push.bind(r.gw)
    r.gw.push = async (q) => {
      if (first) { first = false; return { kind: 'results', results: q.commands.map((c) => ({ id: c.id, status: 'retry' as const, retryAfterMs: 60_000 })) } }
      return real(q)
    }
    await r.engine.write(task())
    await r.sync()
    const row = (await r.store.outbox.all())[0]!
    expect(row.phase).toBe('queued')
    expect(row.nextAttemptAt).toBeGreaterThanOrEqual(NOW + 60_000)
    expect((await r.sync()).acknowledged).toBe(0)
    r.advance(61_000)
    expect((await r.sync()).acknowledged).toBe(1)
  })

  it('dead-letters after the attempt limit, keeps the work, and says so', async () => {
    const r = rig({ backoff: { baseMs: 1, capMs: 1, maxAttempts: 3 } })
    r.gw.push = async (q) => ({ kind: 'results', results: q.commands.map((c) => ({ id: c.id, status: 'retry' as const })) })
    await r.engine.write(task())
    for (let i = 0; i < 6; i++) { await r.sync(); r.advance(1_000) }
    const row = (await r.store.outbox.all())[0]!
    expect(row.phase).toBe('rejected')
    expect(row.rejectReason).toBe('dead_letter')
    expect(r.engine.stateOf((await r.store.entities.get('task', 'T1'))!)).toBe('rejected')
    expect((await r.store.entities.get('task', 'T1'))!.value).toEqual({ title: 'Read ch. 3', done: false })
  })

  it('drops a command that grew too old instead of sending it late', async () => {
    const r = rig({ commandTtlMs: 1000 })
    await r.engine.write(task())
    r.advance(5_000)
    await r.sync()
    expect(r.gw.seenKeys.size).toBe(0)
    expect((await r.store.outbox.all())[0]!.rejectReason).toBe('expired')
  })
})

describe('held sends (a submission)', () => {
  const sub = { dataClass: 'submission' as const, entityId: 'S1', op: 'submit' as const, payload: { file: 'essay.pdf' } }

  it('stays on this device and is never sent until the person taps', async () => {
    const r = rig()
    const e = await r.engine.write(sub)
    expect(r.engine.stateOf(e)).toBe('local')
    await r.sync(); await r.sync()
    expect(r.gw.seenKeys.size).toBe(0)
    expect(r.gw.receipts).toEqual([])
  })

  it('is pending after the tap, and a receipt exists only once the server accepted', async () => {
    const r = rig()
    const e = await r.engine.write(sub)
    await r.engine.confirm(e.commandId!)
    expect(r.engine.stateOf((await r.store.entities.get('submission', 'S1'))!)).toBe('pending')
    expect(r.gw.receipts).toEqual([])
    await r.sync()
    expect(r.gw.receipts).toHaveLength(1)
    expect(r.engine.stateOf((await r.store.entities.get('submission', 'S1'))!)).toBe('synced')
  })

  it('does not send a held row even if something puts it in the queue without the tap', async () => {
    const r = rig()
    const e = await r.engine.write(sub)
    const row = (await r.store.outbox.get(e.commandId!))!
    await r.store.outbox.put({ ...row, phase: 'queued' })
    await r.sync()
    expect(r.gw.seenKeys.size).toBe(0)
  })

  it('cannot be confirmed twice, nor can an automatic class be "confirmed"', async () => {
    const r = rig()
    const e = await r.engine.write(sub)
    await r.engine.confirm(e.commandId!)
    await expect(r.engine.confirm(e.commandId!)).rejects.toThrow()
    const t = await r.engine.write(task())
    await expect(r.engine.confirm(t.commandId!)).rejects.toThrow()
  })

  it('keeps a draft class on the device and never queues it', async () => {
    const r = rig()
    const e = await r.engine.write({ dataClass: 'assignment_draft', entityId: 'D1', op: 'create', payload: { body: 'x' } })
    expect(r.engine.stateOf(e)).toBe('local')
    expect(await r.store.outbox.all()).toEqual([])
  })
})

describe('two devices', () => {
  it('merges edits to different fields with no conflict', async () => {
    const a = rig(); const b = rig({ with: a, device: 'dev-b' })
    await a.engine.write(task()); await a.sync(); await b.sync()
    await a.engine.write({ dataClass: 'task', entityId: 'T1', op: 'patch', payload: { title: 'Read ch. 4' } })
    await b.engine.write({ dataClass: 'task', entityId: 'T1', op: 'patch', payload: { done: true } })
    await a.sync(); await b.sync(); await a.sync()
    expect(a.gw.records.get('task\u0000T1')!.value).toMatchObject({ title: 'Read ch. 4', done: true })
    expect((await a.store.entities.get('task', 'T1'))!.value).toMatchObject({ title: 'Read ch. 4', done: true })
    expect((await b.store.entities.get('task', 'T1'))!.value).toMatchObject({ title: 'Read ch. 4', done: true })
  })

  it('does not let a phone with its clock a year ahead beat an edit that reaches the server after its own', async () => {
    const a = rig(); const b = rig({ with: a, device: 'dev-b' })
    await a.engine.write(task()); await a.sync(); await b.sync()
    // Device A's clock is a year fast. It edits offline and syncs; the server's clock is right.
    a.skew.ms = 365 * 86_400_000
    await a.engine.write({ dataClass: 'task', entityId: 'T1', op: 'patch', payload: { title: 'from the future' } })
    a.advance(1_000)
    await a.sync()
    expect(a.gw.records.get('task\u0000T1')!.value).toMatchObject({ title: 'from the future' })
    // Device B edits honestly afterwards, and must win: A's claim was clamped to when it actually arrived.
    a.advance(5_000)
    await b.engine.write({ dataClass: 'task', entityId: 'T1', op: 'patch', payload: { title: 'honest, later' } })
    await b.sync()
    expect(a.gw.records.get('task\u0000T1')!.value).toMatchObject({ title: 'honest, later' })
  })

  it('does not let a phone with its clock set back win by being slow either way: an old claim loses to a newer arrival', async () => {
    const a = rig(); const b = rig({ with: a, device: 'dev-b' })
    await a.engine.write(task()); await a.sync(); await b.sync()
    b.advance(10_000)
    await b.engine.write({ dataClass: 'task', entityId: 'T1', op: 'patch', payload: { title: 'newer edit' } }); await b.sync()
    a.skew.ms = -86_400_000
    await a.engine.write({ dataClass: 'task', entityId: 'T1', op: 'patch', payload: { title: 'edit with a slow clock' } })
    a.advance(20_000)
    await a.sync()
    expect(a.gw.records.get('task\u0000T1')!.value).toMatchObject({ title: 'newer edit' })
  })

  it('stops and keeps both versions when the same field of a note is edited on both', async () => {
    const a = rig(); const b = rig({ with: a, device: 'dev-b' })
    await a.engine.write({ dataClass: 'personal_note', entityId: 'N1', op: 'create', payload: { body: 'start' } }); await a.sync(); await b.sync()
    await a.engine.write({ dataClass: 'personal_note', entityId: 'N1', op: 'patch', payload: { body: 'A says' } })
    await b.engine.write({ dataClass: 'personal_note', entityId: 'N1', op: 'patch', payload: { body: 'B says' } })
    await a.sync(); await b.sync()
    const e = (await b.store.entities.get('personal_note', 'N1'))!
    expect(b.engine.stateOf(e)).toBe('conflicted')
    expect(e.value).toEqual({ body: 'B says' })
    const row = (await b.store.outbox.all())[0]!
    expect(row.conflict!.serverValue).toEqual({ body: 'A says' })
    await expect(b.engine.write({ dataClass: 'personal_note', entityId: 'N1', op: 'patch', payload: { body: 'more' } })).rejects.toThrow(/conflict/i)
  })

  it('resolves "mine": pending again, then synced, with what it replaced kept as evidence', async () => {
    const a = rig(); const b = rig({ with: a, device: 'dev-b' })
    await a.engine.write({ dataClass: 'personal_note', entityId: 'N1', op: 'create', payload: { body: 'start' } }); await a.sync(); await b.sync()
    await a.engine.write({ dataClass: 'personal_note', entityId: 'N1', op: 'patch', payload: { body: 'A says' } })
    await b.engine.write({ dataClass: 'personal_note', entityId: 'N1', op: 'patch', payload: { body: 'B says' } })
    await a.sync(); await b.sync()
    const row = (await b.store.outbox.all())[0]!
    await b.engine.resolveConflict(row.id, 'mine')
    expect(b.engine.stateOf((await b.store.entities.get('personal_note', 'N1'))!)).toBe('pending')
    await b.sync()
    const e = (await b.store.entities.get('personal_note', 'N1'))!
    expect(b.engine.stateOf(e)).toBe('synced')
    expect(a.gw.records.get('personal_note\u0000N1')!.value).toEqual({ body: 'B says' })
    expect(e.evidence!.some((x) => JSON.stringify(x.lost).includes('A says'))).toBe(true)
  })

  it('resolves "theirs": takes the server value and sends nothing', async () => {
    const a = rig(); const b = rig({ with: a, device: 'dev-b' })
    await a.engine.write({ dataClass: 'personal_note', entityId: 'N1', op: 'create', payload: { body: 'start' } }); await a.sync(); await b.sync()
    await a.engine.write({ dataClass: 'personal_note', entityId: 'N1', op: 'patch', payload: { body: 'A says' } })
    await b.engine.write({ dataClass: 'personal_note', entityId: 'N1', op: 'patch', payload: { body: 'B says' } })
    await a.sync(); await b.sync()
    const row = (await b.store.outbox.all())[0]!
    await b.engine.resolveConflict(row.id, 'theirs')
    expect(await b.store.outbox.all()).toEqual([])
    expect((await b.store.entities.get('personal_note', 'N1'))!.value).toEqual({ body: 'A says' })
    expect(b.engine.stateOf((await b.store.entities.get('personal_note', 'N1'))!)).toBe('synced')
  })

  it('converges a deletion made elsewhere', async () => {
    const a = rig(); const b = rig({ with: a, device: 'dev-b' })
    await a.engine.write(task()); await a.sync(); await b.sync()
    await a.engine.write({ dataClass: 'task', entityId: 'T1', op: 'delete', payload: null }); await a.sync(); await b.sync()
    expect(await b.store.entities.get('task', 'T1')).toBeUndefined()
  })
})

describe('refusals', () => {
  it('shows a refusal, keeps the work, and will not retry what can never be accepted', async () => {
    let allowed = true
    const r = rig({ gateway: { can: () => allowed } })
    await r.engine.write(task())
    allowed = false
    await r.sync()
    const row = (await r.store.outbox.all())[0]!
    expect(row.rejectReason).toBe('membership_removed')
    const e = (await r.store.entities.get('task', 'T1'))!
    expect(r.engine.stateOf(e)).toBe('rejected')
    expect(e.value).toEqual({ title: 'Read ch. 3', done: false })
    await expect(r.engine.retry(row.id)).rejects.toThrow(/cannot be sent again/)
  })

  it('discarding unsent work puts back the last confirmed value', async () => {
    const r = rig()
    await r.engine.write(task()); await r.sync()
    await r.engine.write({ dataClass: 'task', entityId: 'T1', op: 'patch', payload: { title: 'oops' } })
    await r.engine.discard((await r.store.outbox.all())[0]!.id)
    const e = (await r.store.entities.get('task', 'T1'))!
    expect(e.value).toEqual({ title: 'Read ch. 3', done: false })
    expect(r.engine.stateOf(e)).toBe('synced')
  })

  it('will not discard something that may already have arrived', async () => {
    const r = rig({ gateway: { loseResponses: 1 } })
    await r.engine.write(task()); await r.sync()
    await expect(r.engine.discard((await r.store.outbox.all())[0]!.id)).rejects.toThrow(/may already/)
  })

  it('stops for re-authentication without spending an attempt or losing the command', async () => {
    const r = rig()
    await r.engine.write(task())
    r.gw.expireSessions = true
    expect((await r.sync()).stopped).toBe('reauth')
    const row = (await r.store.outbox.all())[0]!
    expect(row.phase).toBe('queued'); expect(row.attempts).toBe(0)
    r.gw.expireSessions = false
    expect((await r.sync()).acknowledged).toBe(1)
  })
})

describe('revocation', () => {
  it('wipes once when the server says the device is revoked, then touches nothing again', async () => {
    const r = rig()
    await r.engine.write(task())
    r.gw.revokedDevices.add('dev-a')
    expect((await r.sync()).stopped).toBe('wiped')
    expect(r.wipes).toEqual(['revoked'])
    r.gw.revokedDevices.clear()
    expect((await r.sync()).stopped).toBe('wiped')
    expect(r.wipes).toEqual(['revoked'])
    expect(r.gw.seenKeys.size).toBe(0)
  })

  it('wipes when access has expired, without contacting the server', async () => {
    const r = rig({ access: () => 'wipe' })
    await r.engine.write(task())
    expect((await r.sync()).stopped).toBe('wiped')
    expect(r.wipes).toEqual(['access_expired'])
    expect(r.gw.seenKeys.size).toBe(0)
  })

  it('removes a record the person lost access to, and turns their unsent edits into an unmergeable copy', async () => {
    const r = rig()
    await r.engine.write({ dataClass: 'shared_note', entityId: 'SN', op: 'create', payload: { t: 1 } }); await r.sync()
    await r.engine.write({ dataClass: 'shared_note', entityId: 'SN', op: 'patch', payload: { t: 2 } })
    r.gw.revoke('shared_note', 'SN')
    // Run only the pull half: the queued edit must not be pushed past the revocation.
    r.gw.expireSessions = false
    const row = (await r.store.outbox.all())[0]!
    await r.store.outbox.put({ ...row, nextAttemptAt: Infinity })
    await r.sync()
    expect(await r.store.entities.get('shared_note', 'SN')).toBeUndefined()
    const after = (await r.store.outbox.all())[0]!
    expect(after.phase).toBe('rejected'); expect(after.rejectReason).toBe('membership_removed')
    expect(r.revoked).toEqual([{ dataClass: 'shared_note', id: 'SN' }])
    await expect(r.engine.retry(after.id)).rejects.toThrow()
  })
})

describe('the cursor', () => {
  it('repairs a valid-JSON but invalid admission marker before pulling', async () => {
    const store = memoryStore()
    await store.cursors.set('__offline_policy_admission__:t:u', '{}')
    let pulls = 0
    const transport: SyncTransport = {
      push: async () => ({ kind: 'results', results: [] }),
      status: async () => ({ kind: 'results', results: [] }),
      pull: async () => { pulls++; return { kind: 'changes', changes: [], nextCursor: '1', hasMore: false } },
    }
    await new SyncEngine({ store, transport, identity: { tenantId: 't', userId: 'u', deviceId: 'd' }, now: () => NOW, newId: () => 'id' }).syncOnce()
    expect(pulls).toBe(1)
    expect(JSON.parse((await store.cursors.get('__offline_policy_admission__:t:u'))!)).toBeInstanceOf(Array)
  })

  it('consumes but never persists inherited Object property names from the server feed', async () => {
    const store = memoryStore()
    const transport: SyncTransport = {
      push: async () => ({ kind: 'results', results: [] }),
      status: async () => ({ kind: 'results', results: [] }),
      pull: async () => ({ kind: 'changes', changes: [{ dataClass: 'toString', id: 'unknown', version: 1, value: { forbidden: true } }], nextCursor: '1', hasMore: false } as never),
    }
    await new SyncEngine({ store, transport, identity: { tenantId: 't', userId: 'u', deviceId: 'd' }, now: () => NOW, newId: () => 'id' }).syncOnce()
    expect(await store.entities.all()).toEqual([])
  })

  it('rebootstraps when policy newly admits a class without dropping authored pending work', async () => {
    const store = memoryStore()
    const cursors: Array<string | undefined> = []
    const transport: SyncTransport = {
      push: async () => ({ kind: 'results', results: [] }),
      status: async () => ({ kind: 'results', results: [] }),
      pull: async (request) => {
        cursors.push(request.cursor)
        return { kind: 'changes', changes: request.cursor ? [] : [{ dataClass: 'billing_summary', id: 'bill', version: 1, value: { balance: 100 } }], nextCursor: '1', hasMore: false, snapshot: !request.cursor } as const
      },
    }
    const deps = { store, transport, identity: { tenantId: 't', userId: 'u', deviceId: 'd' }, now: () => NOW, newId: () => 'pending' }
    await new SyncEngine(deps).syncOnce()
    await new SyncEngine({ ...deps, newId: () => 'authored' }).write({ dataClass: 'personal_plan', entityId: 'plan', op: 'create', payload: { estimate: 42 } })
    await new SyncEngine({ ...deps, tenantPolicy: { optIn: ['billing_summary'] } }).syncOnce()
    expect(cursors).toEqual([undefined, undefined])
    expect(await store.entities.get('billing_summary', 'bill')).toBeDefined()
    expect(await store.entities.get('personal_plan', 'plan')).toMatchObject({ value: { estimate: 42 }, phase: 'queued' })
    expect(await store.outbox.get('authored')).toBeDefined()
  })

  it('consumes but never persists grades, transcripts, aid or guardian projections from the server feed', async () => {
    const r = rig({ tenantPolicy: { optIn: ['grade', 'academic_record', 'financial_aid', 'guardian_projection'] } })
    for (const dataClass of ['grade', 'academic_record', 'financial_aid', 'guardian_projection'] as const) {
      r.gw.external(dataClass, dataClass, { protected: dataClass }, hlc(NOW))
    }
    await r.sync()
    expect(await r.store.entities.all()).toEqual([])
    expect(await r.store.outbox.all()).toEqual([])
  })

  it('pages, remembers where it got to, and does not refetch', async () => {
    const a = rig(); const b = rig({ with: a, device: 'dev-b' })
    for (let i = 0; i < 5; i++) a.gw.external('task', `X${i}`, { n: i }, hlc(NOW))
    await b.sync()
    expect((await b.store.entities.all()).length).toBe(5)
    expect((await b.sync()).pulled).toBe(0)
  })

  it('applies changes and moves the cursor together, or neither', async () => {
    const a = rig()
    a.gw.external('task', 'X', { n: 1 }, hlc(NOW))
    const store = memoryStore()
    const failing = { ...store, entities: { ...store.entities, put: async () => { throw new Error('disk full') } } }
    const b = rig({ with: a, device: 'dev-b', store: failing })
    await expect(b.sync()).rejects.toThrow('disk full')
    expect(await store.cursors.get('t1:u1')).toBeUndefined()
    expect(await store.entities.all()).toEqual([])
  })

  it('starts over from a snapshot when the server no longer keeps its cursor', async () => {
    const a = rig(); const b = rig({ with: a, device: 'dev-b' })
    a.gw.external('task', 'X', { n: 1 }, hlc(NOW)); await b.sync()
    a.gw.external('task', 'Y', { n: 2 }, hlc(NOW)); a.gw.compactFeed()
    a.gw.external('task', 'Z', { n: 3 }, hlc(NOW))
    await b.sync()
    expect((await b.store.entities.get('task', 'Z'))).toBeDefined()
  })

  it('drops a confirmed record the server no longer has when a snapshot arrives, but never one with unsent work', async () => {
    const a = rig(); const b = rig({ with: a, device: 'dev-b' })
    await a.engine.write({ dataClass: 'task', entityId: 'GONE', op: 'create', payload: { t: 1 } })
    await a.engine.write({ dataClass: 'task', entityId: 'KEPT', op: 'create', payload: { t: 2 } })
    await a.engine.write({ dataClass: 'task', entityId: 'MINE', op: 'create', payload: { t: 3 } })
    await a.sync(); await b.sync(); await b.engine.write({ dataClass: 'task', entityId: 'MINE', op: 'patch', payload: { t: 4 } })
    // The server forgets GONE (a swept tombstone) and the feed is compacted: b's cursor is no longer honoured.
    a.gw.records.delete('task\u0000GONE'); a.gw.external('task', 'LATER', { t: 9 }, hlc(NOW)); a.gw.compactFeed()
    b.t.now += 1; await b.store.outbox.put({ ...(await b.store.outbox.all())[0]!, nextAttemptAt: Infinity })
    await b.sync()
    expect(await b.store.entities.get('task', 'GONE')).toBeUndefined()
    expect(await b.store.entities.get('task', 'KEPT')).toBeDefined()
    expect(await b.store.entities.get('task', 'MINE')).toBeDefined()
  })

  it('marks an acknowledged change reconciled once the feed shows it', async () => {
    const r = rig()
    await r.engine.write(task())
    // Push, then see the answer but not the feed: acknowledged, and already shown as synced.
    const realPull = r.gw.pull.bind(r.gw)
    r.gw.pull = async () => ({ kind: 'changes', changes: [], nextCursor: '0' })
    await r.sync()
    expect((await r.store.entities.get('task', 'T1'))!.phase).toBe('acknowledged')
    expect(r.engine.stateOf((await r.store.entities.get('task', 'T1'))!)).toBe('synced')
    r.gw.pull = realPull
    await r.store.cursors.set('t1:u1', '0')
    await r.sync()
    expect((await r.store.entities.get('task', 'T1'))!.phase).toBe('reconciled')
  })
})

describe('what a gateway must itself refuse', () => {
  it('applies a command once however many times its key arrives', async () => {
    const gw = new ReferenceGateway({ now: () => NOW })
    const cmd = { id: 'k', tenantId: 't1', userId: 'u1', deviceId: 'd', dataClass: 'task' as const, entityId: 'T', op: 'create' as const, payload: { title: 'x' }, baseVersion: null, hlc: hlc(NOW), policyVersion: '1', permissionEpoch: 0, createdAt: NOW, expiresAt: NOW + 1000, seq: 1 }
    const first = await gw.push({ deviceId: 'd', commands: [cmd] })
    const again = await gw.push({ deviceId: 'd', commands: [cmd] })
    expect(first).toMatchObject({ results: [{ status: 'applied', serverVersion: 1 }] })
    expect(again).toMatchObject({ results: [{ status: 'duplicate', serverVersion: 1 }] })
    expect(gw.records.get('task\u0000T')!.version).toBe(1)
  })

  it('rejects a command for a never-queued class even if a device sends one', async () => {
    const gw = new ReferenceGateway({ now: () => NOW })
    const res = await gw.push({ deviceId: 'd', commands: [{ id: 'k', tenantId: 't1', userId: 'u1', deviceId: 'd', dataClass: 'grade_change', entityId: 'g', op: 'patch', payload: { score: 100 }, baseVersion: null, hlc: hlc(NOW), policyVersion: '1', permissionEpoch: 0, createdAt: NOW, expiresAt: NOW + 1000, seq: 1 }] })
    expect(res).toMatchObject({ kind: 'results', results: [{ status: 'rejected', reason: 'server_authoritative' }] })
    expect(gw.records.size).toBe(0)
  })

  it('rejects an old permission epoch: a replayed edit cannot use a role the person no longer has', async () => {
    let epoch = 0
    const r = rig({ gateway: { permissionEpoch: () => epoch } })
    await r.engine.write({ dataClass: 'shared_note', entityId: 'SN', op: 'create', payload: { t: 1 } })
    epoch = 3
    await r.sync()
    expect((await r.store.outbox.all())[0]!.rejectReason).toBe('permission_epoch_stale')
  })
})
