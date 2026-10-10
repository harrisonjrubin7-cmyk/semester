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
})
