import { describe, expect, it, vi } from 'vitest'
import { memoryStore } from './memory-store.ts'
import { purgeDisallowedOfflineData } from './storage-policy.ts'

const entity = (dataClass: string, id: string) => ({
  dataClass, id, value: { secret: `${dataClass}-${id}` }, version: 1,
  phase: 'reconciled', fetchedAt: 1,
})

const command = (dataClass: string, id: string) => ({
  id: `command-${id}`, tenantId: 't', userId: 'u', deviceId: 'd', dataClass,
  entityId: id, op: 'patch', payload: { secret: dataClass }, baseVersion: 1,
  hlc: { wall: 1, counter: 0, node: 'd' }, policyVersion: '1', permissionEpoch: 0,
  createdAt: 1, expiresAt: 2, seq: 1, phase: 'queued', attempts: 0, nextAttemptAt: 1,
})

describe('central offline persistence enforcement', () => {
  it('purges inherited Object property names as unknown classes', async () => {
    const store = memoryStore({ initial: { entities: ['toString', 'constructor', '__proto__'].map((dataClass) => entity(dataClass, dataClass)) as never, outbox: [], cursors: {} } })
    const result = await purgeDisallowedOfflineData(store)
    expect(result.entities).toBe(3)
    expect(await store.entities.all()).toEqual([])
    expect(result.rows.every((row) => row.why === 'unknown_class')).toBe(true)
  })

  it('purges previously persisted grades, transcripts, aid and guardian data and calls the cleanup hook without payloads', async () => {
    const protectedClasses = ['grade', 'academic_record', 'financial_aid', 'guardian_projection']
    const store = memoryStore({
      initial: {
        entities: [...protectedClasses.map((c) => entity(c, c)), entity('task', 'kept')] as never,
        outbox: [...protectedClasses.map((c, i) => ({ ...command(c, c), seq: i + 1 })), command('task', 'kept')] as never,
        cursors: {},
      },
    })
    const hook = vi.fn(async (_rows: readonly unknown[]) => {})
    const result = await purgeDisallowedOfflineData(store, { optIn: protectedClasses as never }, hook)

    expect((await store.entities.all()).map((row) => row.dataClass)).toEqual(['task'])
    expect((await store.outbox.all()).map((row) => row.dataClass)).toEqual(['task'])
    expect(result).toMatchObject({ entities: 4, outbox: 4 })
    expect(hook).toHaveBeenCalledOnce()
    expect(JSON.stringify(hook.mock.calls[0]?.[0])).not.toContain('secret')
  })

  it('purges a default-denied cache after tenant opt-in is withdrawn', async () => {
    const store = memoryStore({ initial: { entities: [entity('billing_summary', 'b')] as never, outbox: [], cursors: {} } })
    expect((await purgeDisallowedOfflineData(store, { optIn: ['billing_summary'] })).entities).toBe(0)
    expect((await store.entities.all())).toHaveLength(1)
    expect((await purgeDisallowedOfflineData(store)).entities).toBe(1)
    expect((await store.entities.all())).toEqual([])
  })

  it('durably retries content-free dependent cleanup after a crash', async () => {
    let disk = { entities: [entity('grade', 'g')], outbox: [], cursors: {} } as never
    const first = memoryStore({ initial: disk, onCommit: async (snapshot) => { disk = structuredClone(snapshot) as never } })
    const attempted: unknown[] = []
    await expect(purgeDisallowedOfflineData(first, undefined, async (rows) => {
      attempted.push(structuredClone(rows))
      throw new Error('secondary store unavailable')
    })).rejects.toThrow(/secondary store unavailable/)
    await first.flush()
    expect((disk as { entities: unknown[] }).entities).toEqual([])
    expect(JSON.stringify(disk)).not.toContain('secret')

    const replayed: unknown[] = []
    const restarted = memoryStore({ initial: disk })
    await purgeDisallowedOfflineData(restarted, undefined, async (rows) => { replayed.push(structuredClone(rows)) })
    expect(replayed).toEqual(attempted)
    expect(JSON.stringify(restarted.snapshot())).not.toContain('grade-g')
    expect(Object.keys(restarted.snapshot().cursors).filter((key) => key.includes('purge'))).toEqual([])
  })

  it('replays the whole idempotent journal after partial dependent cleanup', async () => {
    const store = memoryStore({ initial: { entities: [entity('grade', 'g'), entity('academic_record', 'a')] as never, outbox: [], cursors: {} } })
    const seen: string[][] = []
    await expect(purgeDisallowedOfflineData(store, undefined, async (rows) => {
      seen.push(rows.map((row) => row.id))
      throw new Error('interrupted after first secondary delete')
    })).rejects.toThrow(/interrupted/)
    await purgeDisallowedOfflineData(store, undefined, async (rows) => { seen.push(rows.map((row) => row.id)) })
    expect(seen).toEqual([['g', 'a'], ['g', 'a']])
  })

  it('restores the confirmed entity after removing a prohibited command', async () => {
    const queued = { ...entity('billing_summary', 'b'), value: { balance: 0 }, confirmed: { balance: 100 }, phase: 'queued', commandId: 'command-b' }
    const store = memoryStore({ initial: { entities: [queued] as never, outbox: [command('billing_summary', 'b')] as never, cursors: {} } })
    await purgeDisallowedOfflineData(store, { optIn: ['billing_summary'] })
    expect(await store.outbox.all()).toEqual([])
    expect(await store.entities.get('billing_summary', 'b')).toMatchObject({ value: { balance: 100 }, phase: 'reconciled', commandId: undefined })
  })

  it('removes an unconfirmed entity whose only command is prohibited', async () => {
    const queued = { ...entity('billing_summary', 'b'), value: { balance: 0 }, confirmed: undefined, phase: 'queued', commandId: 'command-b' }
    const store = memoryStore({ initial: { entities: [queued] as never, outbox: [command('billing_summary', 'b')] as never, cursors: {} } })
    await purgeDisallowedOfflineData(store, { optIn: ['billing_summary'] })
    expect(await store.entities.all()).toEqual([])
  })

  it('preserves student-authored estimates, plans, drafts and their pending work', async () => {
    const authored = [entity('personal_plan', 'financial-plan'), entity('task', 'grade-estimate'), { ...entity('assignment_draft', 'essay'), phase: 'draft' }]
    const store = memoryStore({ initial: { entities: authored as never, outbox: [command('personal_plan', 'financial-plan'), command('task', 'grade-estimate')] as never, cursors: {} } })
    const result = await purgeDisallowedOfflineData(store)
    expect(result.rows).toEqual([])
    expect((await store.entities.all()).map((row) => row.id)).toEqual(['financial-plan', 'grade-estimate', 'essay'])
    expect((await store.outbox.all()).map((row) => row.entityId)).toEqual(['financial-plan', 'grade-estimate'])
  })
})

