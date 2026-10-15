import { describe, expect, it } from 'vitest'
import { createOfflineSdk, type SdkConfig } from './sdk.ts'
import { memoryStore, type StoreSnapshot } from './memory-store.ts'
import { ReferenceGateway } from './testing/reference-gateway.ts'
import { STATE_COPY, SYNC_STATES } from './status.ts'
import type { LeaseState, WipePorts } from './device.ts'

const NOW = 1_800_000_000_000
const DAY = 86_400_000

function make(o: Partial<SdkConfig> = {}) {
  const t = { now: NOW }
  const log: string[] = []
  const gw = new ReferenceGateway({ now: () => t.now })
  const lease: LeaseState = { grant: { deviceId: 'd', tenantId: 't1', userId: 'u1', issuedAt: NOW, hardExpiresAt: NOW + 90 * DAY, policyVersion: '1', permissionEpoch: 0, accessTokenTtlMs: 900_000 }, verifiedAt: NOW, highWaterWall: NOW, lastActiveAt: NOW }
  const wipe: WipePorts = {
    deleteWrappingKey: async () => { log.push('key') }, clearCredentials: async () => { log.push('cred') }, deleteDatabase: async () => { log.push('db') },
    deleteAttachmentFiles: async () => { log.push('files') }, writeTombstone: async (x) => { log.push(`tomb:${x.reason}`) },
  }
  let n = 0
  const sdk = createOfflineSdk({ store: memoryStore(), transport: gw, identity: { tenantId: 't1', userId: 'u1', deviceId: 'd' }, lease, wipe, now: () => t.now, newId: () => `c${++n}`, ...o })
  return { sdk, t, log, gw }
}

describe('the SDK read model', () => {
  it('purges prohibited data at readiness even when the session requires reauthentication', async () => {
    const store = memoryStore({ initial: { entities: [{ dataClass: 'grade', id: 'g', value: { score: 90 }, confirmed: { score: 90 }, version: 1, phase: 'reconciled', fetchedAt: NOW }] as never, outbox: [], cursors: {} } })
    const staleLease: LeaseState = { grant: { deviceId: 'd', tenantId: 't1', userId: 'u1', issuedAt: NOW, hardExpiresAt: NOW + 90 * DAY, policyVersion: '1', permissionEpoch: 0, accessTokenTtlMs: 900_000 }, verifiedAt: NOW - 8 * DAY, highWaterWall: NOW, lastActiveAt: NOW }
    const { sdk } = make({ store, lease: staleLease })
    await sdk.ready()
    expect(await store.entities.all()).toEqual([])
    expect((await sdk.sync()).stopped).toBe('reauth')
  })

  it('notifies subscribers when explicit enforcement changes visible state', async () => {
    const store = memoryStore({ initial: { entities: [{ dataClass: 'grade', id: 'g', value: {}, version: 1, phase: 'reconciled', fetchedAt: NOW }] as never, outbox: [], cursors: {} } })
    const { sdk } = make({ store })
    let notifications = 0
    sdk.onChange(() => { notifications++ })
    await sdk.enforceStoragePolicy()
    expect(notifications).toBe(1)
  })

  it('notifies after primary deletion even when dependent cleanup fails', async () => {
    const store = memoryStore({ initial: { entities: [{ dataClass: 'grade', id: 'g', value: {}, version: 1, phase: 'reconciled', fetchedAt: NOW }] as never, outbox: [], cursors: {} } })
    const { sdk } = make({ store, onPolicyPurge: async () => { throw new Error('secondary cleanup failed') } })
    let notifications = 0
    sdk.onChange(() => { notifications++ })
    await expect(sdk.enforceStoragePolicy()).rejects.toThrow(/secondary cleanup failed/)
    expect(await store.entities.all()).toEqual([])
    expect(notifications).toBe(1)
  })

  it('does not durably rewrite a clean store for point or list reads', async () => {
    let commits = 0
    const store = memoryStore({ initial: { entities: [{ dataClass: 'task', id: 't', value: {}, version: 1, phase: 'reconciled', fetchedAt: NOW }] as never, outbox: [], cursors: {} }, onCommit: async () => { commits++ } })
    const { sdk } = make({ store })
    await sdk.ready()
    const afterReadiness = commits
    await sdk.read('task', 't')
    await sdk.list('task')
    await store.flush()
    expect(commits).toBe(afterReadiness)
  })

  it('waits for durable policy cleanup before readiness resolves', async () => {
    let persisted!: () => void
    let release!: () => void
    const started = new Promise<void>((resolve) => { persisted = resolve })
    const blocked = new Promise<void>((resolve) => { release = resolve })
    const store = memoryStore({
      initial: { entities: [{ dataClass: 'grade', id: 'g', value: {}, version: 1, phase: 'reconciled', fetchedAt: NOW }] as never, outbox: [], cursors: {} },
      onCommit: async () => { persisted(); await blocked },
    })
    const { sdk } = make({ store })
    let ready = false
    const waiting = sdk.ready().then(() => { ready = true })
    await started
    await Promise.resolve()
    expect(ready).toBe(false)
    release()
    await waiting
    expect(ready).toBe(true)
  })

  it('retries a failed readiness commit and is clean after restart', async () => {
    let disk: StoreSnapshot = {
      entities: [{ dataClass: 'grade', id: 'g', value: { score: 91 }, version: 1, phase: 'reconciled', fetchedAt: NOW }] as never,
      outbox: [],
      cursors: {},
    }
    let attempts = 0
    const store = memoryStore({ initial: disk, onCommit: async (snapshot) => {
      if (attempts++ === 0) throw new Error('temporary disk failure')
      disk = structuredClone(snapshot)
    } })
    const { sdk } = make({ store })
    await expect(sdk.ready()).rejects.toThrow('temporary disk failure')
    expect(disk.entities).toHaveLength(1)
    await expect(sdk.ready()).resolves.toBeUndefined()
    expect(memoryStore({ initial: disk }).snapshot().entities).toEqual([])
    expect(JSON.stringify(disk)).not.toContain('score')
  })

  it('executes a mandatory wipe even when the policy cleanup hook throws', async () => {
    const store = memoryStore({ initial: { entities: [{ dataClass: 'grade', id: 'g', value: {}, version: 1, phase: 'reconciled', fetchedAt: NOW }] as never, outbox: [], cursors: {} } })
    const expired: LeaseState = { grant: { deviceId: 'd', tenantId: 't1', userId: 'u1', issuedAt: NOW - 100 * DAY, hardExpiresAt: NOW - 1, policyVersion: '1', permissionEpoch: 0, accessTokenTtlMs: 900_000 }, verifiedAt: NOW - 100 * DAY, highWaterWall: NOW, lastActiveAt: NOW }
    const { sdk, log } = make({ store, lease: expired, onPolicyPurge: async () => { throw new Error('secondary cleanup failed') } })
    await expect(sdk.sync()).resolves.toMatchObject({ stopped: 'wiped' })
    expect(log).toEqual(expect.arrayContaining(['key', 'cred', 'db', 'files', 'tomb:access_expired']))
  })

  it('cannot return a value without its state and the words for it', async () => {
    const { sdk } = make()
    const v = await sdk.write({ dataClass: 'task', entityId: 'T', op: 'create', payload: { title: 'x' } })
    expect(v.state).toBe('pending')
    expect(v.label).toBe(STATE_COPY.pending.label)
    const r = await sdk.read('task', 'T')
    expect(r.ok && r.view.state).toBe('pending')
    await sdk.sync()
    const s = await sdk.read('task', 'T')
    expect(s.ok && s.view.state).toBe('synced')
  })

  it('walks one item through every state a person can see', async () => {
    const { sdk, gw } = make()
    const seen = new Set<string>()
    const note = (v: { state: string }) => seen.add(v.state)
    const local = await sdk.write({ dataClass: 'assignment_draft', entityId: 'D', op: 'create', payload: { b: 1 } }); note(local)
    note(await sdk.write({ dataClass: 'task', entityId: 'T', op: 'create', payload: { a: 1 } }))
    await sdk.sync(); const synced = await sdk.read('task', 'T'); if (synced.ok) note(synced.view)
    // rejected
    const rej = await sdk.write({ dataClass: 'shared_note', entityId: 'S', op: 'create', payload: { a: 1 } })
    ;(gw as unknown as { o: { can: () => boolean } }).o.can = () => false
    await sdk.sync(); const r2 = await sdk.read('shared_note', 'S'); if (r2.ok) note(r2.view); void rej
    // conflicted
    ;(gw as unknown as { o: { can: undefined } }).o.can = undefined
    await sdk.write({ dataClass: 'personal_note', entityId: 'N', op: 'create', payload: { body: 'a' } }); await sdk.sync()
    gw.external('personal_note', 'N', { body: 'elsewhere' }, { wall: NOW, counter: 5, node: 'z' })
    await sdk.write({ dataClass: 'personal_note', entityId: 'N', op: 'patch', payload: { body: 'mine' } }); await sdk.sync()
    const c = await sdk.read('personal_note', 'N'); if (c.ok) note(c.view)
    expect([...seen].sort()).toEqual([...SYNC_STATES].sort())
  })

  it('shows unsent work even when the cached copy would have expired, and hides an expired confirmed copy', async () => {
    const { sdk, t } = make({ tenantPolicy: { optIn: ['course_content'] } })
    await sdk.write({ dataClass: 'task', entityId: 'T', op: 'create', payload: { a: 1 } }); await sdk.sync()
    await sdk.write({ dataClass: 'personal_note', entityId: 'N', op: 'create', payload: { a: 1 } })
    t.now += 31 * DAY
    sdk.verified()
    expect(await sdk.read('task', 'T')).toMatchObject({ ok: false, why: { verdict: 'expired' } })
    expect((await sdk.read('personal_note', 'N')).ok).toBe(true)
  })

  it('shows nothing while locked, and nothing while the device needs to check in', async () => {
    const { sdk, t } = make()
    await sdk.write({ dataClass: 'task', entityId: 'T', op: 'create', payload: { a: 1 } })
    t.now += 10 * 60_000
    expect(await sdk.read('task', 'T')).toMatchObject({ ok: false, why: { verdict: 'locked' } })
    expect(await sdk.list('task')).toEqual([])
    await expect(sdk.write({ dataClass: 'task', entityId: 'U', op: 'create', payload: {} })).rejects.toThrow(/locked/)
    sdk.touch()
    expect((await sdk.read('task', 'T')).ok).toBe(true)
  })

  it('never reads back a class the content database must not hold', async () => {
    const { sdk } = make()
    await expect(sdk.write({ dataClass: 'payment', entityId: 'P', op: 'create', payload: { amount: 1 } })).rejects.toThrow(/offline_write_prohibited/)
  })
})

describe('leaving', () => {
  it('signs out by wiping: key first, then everything else', async () => {
    const { sdk, log } = make()
    const r = await sdk.signOut('logout')
    expect(r.ok).toBe(true)
    expect(log[0]).toBe('key'); expect(log).toContain('tomb:logout')
  })

  it('wipes on its own when the server revokes the device, and then shows nothing', async () => {
    const { sdk, gw, log } = make()
    await sdk.write({ dataClass: 'task', entityId: 'T', op: 'create', payload: { a: 1 } })
    gw.revokedDevices.add('d')
    expect((await sdk.sync()).stopped).toBe('wiped')
    expect(log[0]).toBe('key'); expect(log).toContain('tomb:revoked')
    expect(await sdk.read('task', 'T')).toMatchObject({ ok: false, why: { verdict: 'wipe' } })
  })

  it('tells subscribers when something changed', async () => {
    const { sdk } = make()
    let n = 0
    const off = sdk.onChange(() => { n++ })
    await sdk.write({ dataClass: 'task', entityId: 'T', op: 'create', payload: {} })
    await sdk.sync(); off()
    await sdk.write({ dataClass: 'task', entityId: 'U', op: 'create', payload: {} })
    expect(n).toBe(2)
  })
})
