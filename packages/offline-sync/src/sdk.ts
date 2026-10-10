import { SyncEngine, type AccessVerdict, type EngineDeps, type SyncReport, type SyncSummary, type WriteInput } from './engine.ts'
import {
  DEFAULT_LEASE_POLICY, evaluateAccess, observe, wipeDevice,
  type AccessDecision, type LeasePolicy, type LeaseState, type WipePorts, type WipeReason, type WipeResult,
} from './device.ts'
import { freshness, NO_OPT_IN, policyFor, type DataClass, type Freshness, type TenantOfflinePolicy } from './policy.ts'
import { STATE_COPY, type SyncState } from './status.ts'
import type { EntityRow, LocalStore, SyncTransport } from './types.ts'
import type { PolicyPurgeResult } from './storage-policy.ts'

// ---- what a platform must provide ------------------------------------------
// One interface per native capability, so iOS, Android and web differ only in
// the adapter and the whole protocol above them is shared and tested once.

export interface SecureKeystore {
  /** Hardware-backed where the platform has it; `hardwareBacked` reports what it actually got. */
  createWrappingKey(alias: string, o: { requireUserPresence: boolean }): Promise<{ hardwareBacked: boolean }>
  wrap(alias: string, plaintext: Uint8Array): Promise<Uint8Array>
  unwrap(alias: string, wrapped: Uint8Array): Promise<Uint8Array>
  deleteKey(alias: string): Promise<void>
}

export interface BiometricGate {
  available(): Promise<'face' | 'fingerprint' | 'passcode' | 'none'>
  /** Resolves true only for a present, verified person. Never cached across a lock. */
  authenticate(reason: string): Promise<boolean>
}

export interface PasskeyProvider {
  create(o: { challenge: string; rpId: string; userId: string }): Promise<{ credentialId: string; attestation: string }>
  assert(o: { challenge: string; rpId: string; credentialId?: string }): Promise<{ credentialId: string; assertion: string }>
}

export interface EncryptedDatabase {
  /** Apply `openSequence(key)` and return the store. Throws on a wrong key. */
  open(rawKeyHex: string): Promise<LocalStore>
  /** Delete the file and its -wal and -shm. */
  destroy(): Promise<void>
}

export interface Connectivity {
  state(): 'online' | 'offline' | 'constrained'
  subscribe(listener: (s: 'online' | 'offline' | 'constrained') => void): () => void
}

export interface BackgroundScheduler {
  /** iOS BGTaskScheduler, Android WorkManager, web periodic sync where present. A hint, never a promise. */
  schedule(task: 'sync', o: { minIntervalMs: number; requiresNetwork: boolean }): Promise<void>
  cancel(task: 'sync'): Promise<void>
}

// ---- what the app calls -----------------------------------------------------

/** A row as a screen may see it. There is no way to get the value without also getting its state. */
export interface View<T = unknown> {
  value: T
  state: SyncState
  label: string
  detail: string
  needsAction: boolean
  freshness: Freshness
  /** Command to act on for rejected, conflicted or held-send rows. */
  commandId?: string
  /** Same-field conflicts that were settled for the person, and what they replaced. */
  evidence: { field: string; lost: unknown; at: number }[]
}

export type Unavailable = { ok: false; why: Extract<AccessDecision, { verdict: 'locked' | 'reauth' | 'wipe' }> | { verdict: 'expired' } | { verdict: 'tenant_has_not_opted_in' } }
export type Available<T> = { ok: true; view: View<T> }

export interface SemesterOfflineSdk {
  read<T = unknown>(dataClass: DataClass, id: string): Promise<Available<T> | Unavailable | { ok: false; why: { verdict: 'missing' } }>
  list(dataClass: DataClass): Promise<View[]>
  write(input: WriteInput): Promise<View>
  /** The confirming tap for a held send. */
  confirm(commandId: string): Promise<void>
  resolveConflict(commandId: string, choice: 'mine' | 'theirs' | { merged: unknown }): Promise<void>
  retry(commandId: string): Promise<void>
  discard(commandId: string): Promise<void>
  sync(): Promise<SyncReport>
  summary(): Promise<SyncSummary>
  /** Purge rows forbidden by the current central storage policy. */
  enforceStoragePolicy(): Promise<PolicyPurgeResult>
  access(): AccessDecision
  /** Foreground or biometric success: the person is here. */
  touch(): void
  /** Server said all is well (any successful authenticated round trip). */
  verified(grant?: Partial<LeaseState['grant']>): void
  signOut(reason?: Extract<WipeReason, 'logout' | 'tenant_switch'>): Promise<WipeResult>
  /** Subscribe to any change in what the screen should show. */
  onChange(listener: () => void): () => void
}

export interface SdkConfig {
  store: LocalStore
  transport: SyncTransport
  identity: EngineDeps['identity']
  lease: LeaseState
  wipe: WipePorts
  now: () => number
  newId: () => string
  tenantPolicy?: TenantOfflinePolicy
  leasePolicy?: LeasePolicy
  policyVersion?: () => string
  permissionEpoch?: () => number
  onRevokedRows?: EngineDeps['onRevokedRows']
  onPolicyPurge?: EngineDeps['onPolicyPurge']
}

export function createOfflineSdk(c: SdkConfig): SemesterOfflineSdk {
  let lease = c.lease
  const listeners = new Set<() => void>()
  const changed = () => listeners.forEach((l) => l())
  const tenant = c.tenantPolicy ?? NO_OPT_IN
  const lp = c.leasePolicy ?? DEFAULT_LEASE_POLICY

  const decide = (): AccessDecision => {
    lease = observe(lease, c.now())
    return evaluateAccess(lease, c.now(), lp)
  }

  const engine = new SyncEngine({
    store: c.store,
    transport: c.transport,
    identity: c.identity,
    now: c.now,
    newId: c.newId,
    tenantPolicy: tenant,
    policyVersion: c.policyVersion,
    permissionEpoch: c.permissionEpoch,
    onRevokedRows: c.onRevokedRows,
    onPolicyPurge: c.onPolicyPurge,
    // Sync asks the same question reads do. `locked` still lets a background sync run: the data is not shown.
    access: (): AccessVerdict => {
      const d = decide()
      return d.verdict === 'wipe' ? 'wipe' : d.verdict === 'reauth' ? 'reauth' : 'ok'
    },
    onWipe: async (reason) => {
      lease = { ...lease, revoked: reason === 'revoked' ? 'security' : lease.revoked }
      await wipeDevice(c.wipe, reason, c.now())
      changed()
    },
  })

  const toView = (e: EntityRow): View => {
    const state = engine.stateOf(e)
    const copy = STATE_COPY[state]
    return {
      value: e.value, state, label: copy.label, detail: copy.detail, needsAction: copy.needsAction,
      freshness: policyFor(e.dataClass).cache === 'never' ? 'expired' : freshness(e.dataClass, e.fetchedAt, c.now(), tenant),
      commandId: e.commandId, evidence: e.evidence ?? [],
    }
  }

  return {
    async read(dataClass, id) {
      const d = decide()
      if (d.verdict !== 'ok') return { ok: false, why: d }
      await engine.enforceStoragePolicy()
      const e = await c.store.entities.get(dataClass, id)
      if (!e) return { ok: false, why: { verdict: 'missing' } }
      const v = toView(e)
      // Unsent local work is always shown; a confirmed copy past its limit is not.
      if (v.state === 'synced' && v.freshness === 'expired') return { ok: false, why: { verdict: 'expired' } }
      return { ok: true, view: v as View<never> }
    },
    async list(dataClass) {
      if (decide().verdict !== 'ok') return []
      await engine.enforceStoragePolicy()
      return (await c.store.entities.all()).filter((e) => e.dataClass === dataClass).map(toView).filter((v) => !(v.state === 'synced' && v.freshness === 'expired'))
    },
    async write(input) {
      const d = decide()
      if (d.verdict !== 'ok') throw new Error(`locked: ${d.verdict}`)
      const e = await engine.write(input)
      changed()
      return toView(e)
    },
    async confirm(id) { await engine.confirm(id); changed() },
    async resolveConflict(id, choice) { await engine.resolveConflict(id, choice); changed() },
    async retry(id) { await engine.retry(id); changed() },
    async discard(id) { await engine.discard(id); changed() },
    async sync() {
      const r = await engine.syncOnce()
      if (!r.stopped) lease = { ...lease, verifiedAt: c.now() }
      changed()
      return r
    },
    summary: () => engine.summary(),
    enforceStoragePolicy: () => engine.enforceStoragePolicy(),
    access: decide,
    touch() { lease = { ...observe(lease, c.now()), lastActiveAt: c.now() } },
    verified(grant) { lease = { ...lease, grant: { ...lease.grant, ...grant }, verifiedAt: c.now(), lastActiveAt: c.now() } },
    async signOut(reason = 'logout') {
      const r = await wipeDevice(c.wipe, reason, c.now())
      changed()
      return r
    },
    onChange(l) { listeners.add(l); return () => { listeners.delete(l) } },
  }
}
