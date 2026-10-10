import { backoffDelay, DEFAULT_BACKOFF, retryAt, type BackoffOptions } from './backoff.ts'
import { hlcNow, type Hlc } from './hlc.ts'
import { admittedDataClasses, assertQueueable, classifyPersistence, dataClasses, policyFor, type DataClass, type TenantOfflinePolicy } from './policy.ts'
import { purgeDisallowedOfflineData, type PolicyPurgeRow, type PolicyPurgeResult } from './storage-policy.ts'
import { PHASE_TO_STATE, TERMINAL_REASONS, type RejectReason, type SyncState } from './status.ts'
import type { Change, Command, CommandResult, EntityRow, LocalStore, OutboxRow, PullResponse, SyncTransport } from './types.ts'

export type AccessVerdict = 'ok' | 'reauth' | 'wipe'

export interface EngineDeps {
  store: LocalStore
  transport: SyncTransport
  identity: { tenantId: string; userId: string; deviceId: string }
  now: () => number
  newId: () => string
  random?: () => number
  /** Decides whether this device may still hold or send anything (see `device.ts`). */
  access?: () => AccessVerdict
  /** Destroy keys, database, WAL/SHM and cached files. Called at most once per engine. */
  onWipe?: (reason: 'revoked' | 'access_expired') => Promise<void>
  /** Rows the caller lost access to: drop cached files that belonged to them. */
  onRevokedRows?: (rows: { dataClass: DataClass; id: string }[]) => Promise<void>
  /** Policy-purged rows: erase matching attachments, previews and search indexes. */
  onPolicyPurge?: (rows: readonly PolicyPurgeRow[]) => Promise<void>
  tenantPolicy?: TenantOfflinePolicy
  policyVersion?: () => string
  permissionEpoch?: () => number
  backoff?: BackoffOptions
  batchSize?: number
  /** Commands older than this are dropped rather than sent late. */
  commandTtlMs?: number
}

export interface WriteInput {
  dataClass: DataClass
  entityId: string
  op: Command['op']
  payload: unknown
}

export interface SyncReport {
  acknowledged: number
  rejected: number
  conflicted: number
  pulled: number
  /** Why the run stopped early, if it did. */
  stopped?: 'reauth' | 'revoked' | 'wiped' | 'offline'
}

export interface SyncSummary {
  counts: Record<SyncState, number>
  pending: number
  oldestPendingAt: number | null
  nextAttemptAt: number | null
  lastSyncAt: number | null
}

const DAY = 86_400_000
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * The device side of the protocol: a durable command queue, a cursor, and the
 * rules that keep the screen from claiming more than the server has said.
 *
 * It never reaches the network except through `SyncTransport`, never reads a
 * clock except through `now`, and never decides who may hold what except
 * through `policy.ts`. `syncOnce` is single-flight: two overlapping calls share
 * one run, so a retry timer and a "sync now" tap cannot double-send.
 */
export class SyncEngine {
  private readonly d: EngineDeps
  private clock: Hlc | null = null
  private seq = 0
  private inflight: Promise<SyncReport> | null = null
  private wiped = false
  private lastSyncAt: number | null = null

  constructor(deps: EngineDeps) {
    this.d = deps
  }

  /** Crash recovery: a row left `sent` may or may not have arrived. It is ambiguous, not failed. */
  async recover(): Promise<void> {
    const { store } = this.d
    await this.enforceStoragePolicy()
    await store.transaction(async () => {
      for (const r of await store.outbox.all()) {
        this.seq = Math.max(this.seq, r.seq)
        if (r.phase === 'sent') await store.outbox.put({ ...r, phase: 'pending_reconciliation' })
      }
    })
  }

  /** Safe at startup and after any tenant-policy change. */
  async enforceStoragePolicy(): Promise<PolicyPurgeResult> {
    const result = await purgeDisallowedOfflineData(this.d.store, this.d.tenantPolicy, this.d.onPolicyPurge)
    await this.d.store.flush?.()
    return result
  }

  // ---- writing ----------------------------------------------------------

  /**
   * Record a change. Auto classes are queued and applied locally at once;
   * held-send classes stay a draft until `confirm`; draft and never-queued
   * classes never reach the queue (the latter throw).
   */
  async write(input: WriteInput): Promise<EntityRow> {
    const { store, now } = this.d
    const p = policyFor(input.dataClass)
    if (p.write !== 'draft') assertQueueable(input.dataClass)
    const t = now()
    const prev = await store.entities.get(input.dataClass, input.entityId)
    if (prev?.phase === 'conflict_requires_copy') throw new Error('Resolve the conflict on this item before editing it.')

    const value = this.applyLocally(prev?.value, input)
    if (p.write === 'draft') {
      const row: EntityRow = { ...(prev ?? { dataClass: input.dataClass, id: input.entityId, version: null, fetchedAt: t }), value, phase: 'draft' }
      await store.entities.put(row)
      return row
    }

    return store.transaction(async () => {
      const queued = (await store.outbox.all()).find(
        (r) => r.dataClass === input.dataClass && r.entityId === input.entityId && (r.phase === 'queued' || r.phase === 'draft') && r.attempts === 0,
      )
      // Coalesce successive patches that have not left the device: one command, the latest intent.
      if (queued && queued.op === 'patch' && input.op === 'patch' && isObj(queued.payload) && isObj(input.payload)) {
        this.clock = hlcNow(this.clock, t, this.d.identity.deviceId)
        await store.outbox.put({ ...queued, payload: { ...queued.payload, ...input.payload }, hlc: this.clock })
        const e: EntityRow = { ...prev!, value, phase: queued.phase === 'draft' ? 'draft' : 'queued' }
        await store.entities.put(e)
        return e
      }
      this.clock = hlcNow(this.clock, t, this.d.identity.deviceId)
      const held = p.write === 'held-send'
      const cmd: OutboxRow = {
        id: this.d.newId(),
        tenantId: this.d.identity.tenantId,
        userId: this.d.identity.userId,
        deviceId: this.d.identity.deviceId,
        dataClass: input.dataClass,
        entityId: input.entityId,
        op: input.op,
        payload: input.payload,
        baseVersion: prev?.version ?? null,
        hlc: this.clock,
        policyVersion: this.d.policyVersion?.() ?? '0',
        permissionEpoch: this.d.permissionEpoch?.() ?? 0,
        createdAt: t,
        expiresAt: t + (this.d.commandTtlMs ?? 3 * DAY),
        seq: ++this.seq,
        phase: held ? 'draft' : 'queued',
        attempts: 0,
        nextAttemptAt: t,
      }
      await store.outbox.put(cmd)
      const e: EntityRow = {
        dataClass: input.dataClass,
        id: input.entityId,
        value,
        version: prev?.version ?? null,
        confirmed: prev?.confirmed,
        evidence: prev?.evidence,
        fetchedAt: prev?.fetchedAt ?? t,
        phase: held ? 'draft' : 'queued',
        commandId: cmd.id,
      }
      await store.entities.put(e)
      return e
    })
  }

  /** The person's confirming tap on a held send. Until now the engine will not send it. */
  async confirm(commandId: string): Promise<void> {
    const { store, now } = this.d
    await store.transaction(async () => {
      const r = await store.outbox.get(commandId)
      if (!r || r.phase !== 'draft') throw new Error('Nothing to confirm.')
      if (policyFor(r.dataClass).write !== 'held-send') throw new Error('This does not wait for a tap.')
      await store.outbox.put({ ...r, phase: 'queued', confirmedAt: now(), nextAttemptAt: now() })
      await this.setEntityPhase(r.dataClass, r.entityId, 'queued', r.id)
    })
  }

  // ---- the run ----------------------------------------------------------

  syncOnce(): Promise<SyncReport> {
    if (this.inflight) return this.inflight
    this.inflight = this.run().finally(() => { this.inflight = null })
    return this.inflight
  }

  private async run(): Promise<SyncReport> {
    const report: SyncReport = { acknowledged: 0, rejected: 0, conflicted: 0, pulled: 0 }
    if (this.wiped) return { ...report, stopped: 'wiped' }
    const verdict = this.d.access?.() ?? 'ok'
    if (verdict === 'wipe') return this.wipe('access_expired', report)
    // Cleanup is a storage invariant, not an authenticated-data operation, but
    // a mandatory cryptographic wipe has precedence over fallible secondary
    // cleanup hooks.
    await this.enforceStoragePolicy()
    if (verdict === 'reauth') return { ...report, stopped: 'reauth' }

    await this.expireOld()
    const stop = (await this.reconcile(report)) ?? (await this.push(report)) ?? (await this.pull(report))
    if (stop) return stop.stopped === 'revoked' ? this.wipe('revoked', { ...report, ...stop }) : { ...report, ...stop }
    this.lastSyncAt = this.d.now()
    return report
  }

  private async wipe(reason: 'revoked' | 'access_expired', report: SyncReport): Promise<SyncReport> {
    this.wiped = true
    await this.d.onWipe?.(reason)
    return { ...report, stopped: 'wiped' }
  }

  private async expireOld(): Promise<void> {
    const { store, now } = this.d
    for (const r of await store.outbox.all()) {
      if ((r.phase === 'queued' || r.phase === 'draft') && r.expiresAt <= now()) {
        await this.reject(r, 'expired', 'Too old to send safely. It is still saved here.')
      }
    }
  }

  /** Ask about keys whose answer was lost, before sending anything new for them. */
  private async reconcile(report: SyncReport): Promise<Partial<SyncReport> | null> {
    const { store, transport, identity, now } = this.d
    const rows = (await store.outbox.all()).filter((r) => r.phase === 'pending_reconciliation' && r.nextAttemptAt <= now())
    if (!rows.length) return null
    let res
    try {
      res = await transport.status({ deviceId: identity.deviceId, ids: rows.map((r) => r.id) })
    } catch {
      return { stopped: 'offline' }
    }
    return this.consume(rows, res, report)
  }

  private async push(report: SyncReport): Promise<Partial<SyncReport> | null> {
    const { store, transport, identity, now } = this.d
    const all = await store.outbox.all()
    const t = now()
    const blocked = new Set<string>()
    const batch: OutboxRow[] = []
    for (const r of all) {
      const k = `${r.dataClass}\u0000${r.entityId}`
      // One command per entity at a time, in order; anything stuck ahead of it holds the rest.
      if (blocked.has(k)) continue
      blocked.add(k)
      const ready = r.phase === 'queued' && r.nextAttemptAt <= t && (policyFor(r.dataClass).write !== 'held-send' || r.confirmedAt !== undefined)
      if (ready && batch.length < (this.d.batchSize ?? 50)) batch.push(r)
    }
    if (!batch.length) return null

    // Mark sent first and durably: a crash after this line reads as ambiguous, never as unsent.
    await store.transaction(async () => {
      for (const r of batch) await store.outbox.put({ ...r, phase: 'sent', attempts: r.attempts + 1 })
    })
    const sent = batch.map((r) => ({ ...r, phase: 'sent' as const, attempts: r.attempts + 1 }))
    let res
    try {
      res = await transport.push({ deviceId: identity.deviceId, commands: sent.map(toCommand) })
    } catch {
      await this.ambiguous(sent)
      return { stopped: 'offline' }
    }
    return this.consume(sent, res, report)
  }

  private async ambiguous(rows: OutboxRow[]): Promise<void> {
    const { store, now, random } = this.d
    const o = this.d.backoff ?? DEFAULT_BACKOFF
    await store.transaction(async () => {
      for (const r of rows) {
        if (r.attempts >= o.maxAttempts) { await this.reject(r, 'dead_letter', 'Could not reach Semester after many tries.'); continue }
        await store.outbox.put({ ...r, phase: 'pending_reconciliation', nextAttemptAt: now() + backoffDelay(r.attempts, o, random) })
      }
    })
  }

  private async consume(rows: OutboxRow[], res: Awaited<ReturnType<SyncTransport['push']>>, report: SyncReport): Promise<Partial<SyncReport> | null> {
    const { store } = this.d
    if (res.kind === 'session_expired') {
      await store.transaction(async () => { for (const r of rows) await store.outbox.put({ ...r, phase: 'queued', attempts: Math.max(0, r.attempts - 1) }) })
      return { stopped: 'reauth' }
    }
    if (res.kind === 'device_revoked') return { stopped: 'revoked' }
    const byId = new Map(res.results.map((x) => [x.id, x]))
    await store.transaction(async () => {
      for (const r of rows) {
        const x = byId.get(r.id)
        // No answer for a key we sent: still ambiguous. Ask again next run.
        if (!x) { await store.outbox.put({ ...r, phase: 'pending_reconciliation', nextAttemptAt: this.d.now() }); continue }
        await this.applyResult(r, x, report)
      }
    })
    return null
  }

  private async applyResult(r: OutboxRow, x: CommandResult, report: SyncReport): Promise<void> {
    const { store, now, random } = this.d
    switch (x.status) {
      case 'applied':
      case 'duplicate': {
        report.acknowledged++
        await store.outbox.remove(r.id)
        const e = await store.entities.get(r.dataClass, r.entityId)
        const next = (await store.outbox.all()).find((o) => o.dataClass === r.dataClass && o.entityId === r.entityId)
        if (next) await store.outbox.put({ ...next, baseVersion: x.serverVersion })
        // Prefer the server's merged value: it may contain another device's edit this one never saw.
        const confirmed = r.op === 'delete' ? undefined : 'value' in x && x.value !== undefined ? x.value : this.applyLocally(e?.confirmed, r)
        if (r.op === 'delete' && !next) { await store.entities.remove(r.dataClass, r.entityId); return }
        await store.entities.put({
          ...(e ?? { dataClass: r.dataClass, id: r.entityId, value: confirmed, fetchedAt: now() }),
          value: next ? this.applyLocally(confirmed, next) : confirmed,
          version: x.serverVersion,
          confirmed,
          phase: next ? 'queued' : 'acknowledged',
          commandId: next?.id,
        })
        return
      }
      case 'rejected':
        await this.reject(r, x.reason, x.detail)
        report.rejected++
        return
      case 'conflict':
        report.conflicted++
        await store.outbox.put({ ...r, phase: 'conflict_requires_copy', conflict: { serverVersion: x.serverVersion, serverValue: x.serverValue, mine: r.payload } })
        await this.setEntityPhase(r.dataClass, r.entityId, 'conflict_requires_copy', r.id)
        return
      case 'retry': {
        const o = this.d.backoff ?? DEFAULT_BACKOFF
        if (r.attempts >= o.maxAttempts) { await this.reject(r, 'dead_letter', 'Could not be accepted after many tries.'); report.rejected++; return }
        await store.outbox.put({ ...r, phase: 'queued', nextAttemptAt: retryAt(now(), r.attempts, x.retryAfterMs, o, random) })
        return
      }
      case 'unknown':
        // The server never saw this key; sending it again is safe, and is the same command.
        await store.outbox.put({ ...r, phase: 'queued', nextAttemptAt: now() })
        return
    }
  }

  private async reject(r: OutboxRow, reason: RejectReason, detail?: string): Promise<void> {
    const { store } = this.d
    await store.outbox.put({ ...r, phase: 'rejected', rejectReason: reason, detail, nextAttemptAt: TERMINAL_REASONS.includes(reason) ? Infinity : r.nextAttemptAt })
    await this.setEntityPhase(r.dataClass, r.entityId, 'rejected', r.id)
  }

  private async pull(report: SyncReport): Promise<Partial<SyncReport> | null> {
    const { store, transport, identity } = this.d
    const scope = `${identity.tenantId}:${identity.userId}`
    const admissionKey = `__offline_policy_admission__:${scope}`
    const admitted = admittedDataClasses(this.d.tenantPolicy)
    const priorRaw = await store.cursors.get(admissionKey)
    let prior: string[] = []
    try {
      const parsed = priorRaw ? JSON.parse(priorRaw) as unknown : []
      prior = Array.isArray(parsed) && parsed.every((value) => typeof value === 'string' && dataClasses.includes(value as DataClass)) ? parsed : []
    } catch { prior = [] }
    const expanded = admitted.some((dataClass) => !prior.includes(dataClass))
    const encoded = JSON.stringify(admitted)
    if (priorRaw !== encoded || expanded) {
      await store.transaction(async () => {
        if (expanded && await store.cursors.get(scope)) await store.cursors.set(scope, '')
        await store.cursors.set(admissionKey, encoded)
      })
    }
    // While a snapshot is arriving: every record it names, so what is *not* named can be dropped at the end.
    let named: Set<string> | null = null
    for (let page = 0; page < 1000; page++) {
      let res: PullResponse
      try {
        res = await transport.pull({ deviceId: identity.deviceId, scope, cursor: (await store.cursors.get(scope)) || undefined, limit: 200 })
      } catch {
        return { stopped: 'offline' }
      }
      if (res.kind === 'session_expired') return { stopped: 'reauth' }
      if (res.kind === 'device_revoked') return { stopped: 'revoked' }
      if (res.cursorExpired) { await store.cursors.set(scope, ''); continue }
      // Changes and the cursor move together: a crash between them would skip or repeat a change.
      if (res.snapshot && !named) named = new Set()
      await store.transaction(async () => {
        for (const c of res.changes ?? []) { named?.add(`${c.dataClass}\u0000${c.id}`); await this.applyChange(c); report.pulled++ }
        if (res.revoked?.length) await this.dropRevoked(res.revoked)
        if (res.nextCursor !== undefined) await store.cursors.set(scope, res.nextCursor)
        if (named && !res.hasMore) await this.pruneUnnamed(named)
      })
      if (!res.hasMore) return null
    }
    return null
  }

  private async applyChange(c: Change): Promise<void> {
    const { store, now } = this.d
    // The server feed is not an authority to broaden device storage. Unknown,
    // online-only and non-opted-in classes are consumed but never persisted.
    const decision = classifyPersistence(c.dataClass, this.d.tenantPolicy)
    if (!decision.allowed) return
    const e = await store.entities.get(c.dataClass, c.id)
    const mine = (await store.outbox.all()).filter((r) => r.dataClass === c.dataClass && r.entityId === c.id)
    if (e && e.version !== null && e.version >= c.version) {
      if (e.phase === 'acknowledged') await store.entities.put({ ...e, phase: 'reconciled' })
      return
    }
    if (!mine.length) {
      if (c.deleted) await store.entities.remove(c.dataClass, c.id)
      else await store.entities.put({ dataClass: c.dataClass, id: c.id, value: c.value, confirmed: c.value, version: c.version, phase: 'reconciled', fetchedAt: now(), evidence: e?.evidence })
      return
    }
    const live = mine.filter((r) => r.phase !== 'rejected')
    const policy = policyFor(c.dataClass)
    const mineFields = new Set(live.flatMap((r) => (r.op === 'patch' && isObj(r.payload) ? Object.keys(r.payload) : ['*'])))
    const theirs = c.changedFields
    const overlap = !theirs || c.deleted || mineFields.has('*') || theirs.some((f) => mineFields.has(f))
    const rebase = async () => {
      for (const r of live) await store.outbox.put({ ...r, baseVersion: c.version })
      const base = isObj(c.value) ? c.value : {}
      const mineValue = live.reduce<unknown>((v, r) => this.applyLocally(v, r), base)
      await store.entities.put({ ...(e ?? { dataClass: c.dataClass, id: c.id, fetchedAt: now() }), value: mineValue, confirmed: c.value, version: c.version, phase: e?.phase ?? 'queued', commandId: e?.commandId })
    }
    if (!overlap || (policy.conflict === 'field-merge' && policy.sameField === 'hlc')) {
      // Disjoint fields merge; same-field on a clock-ordered class is settled by the server's clamped clock.
      await rebase()
      return
    }
    // Same field, a class that must ask (or a server-authoritative one): keep both, stop, let the person choose.
    const first = live[0]!
    await store.outbox.put({ ...first, phase: 'conflict_requires_copy', conflict: { serverVersion: c.version, serverValue: c.value, mine: first.payload } })
    await store.entities.put({ ...e!, phase: 'conflict_requires_copy', commandId: first.id })
  }

  /**
   * A snapshot is the present state, so a confirmed record it does not name is gone: deleted somewhere while this
   * device was away, past the point the server still keeps tombstones. Left alone it would come back to life. A
   * record with unsent work is never dropped here — that edit is the person's, and the server will decide it.
   */
  private async pruneUnnamed(named: Set<string>): Promise<void> {
    const { store } = this.d
    const pending = new Set((await store.outbox.all()).map((r) => `${r.dataClass}\u0000${r.entityId}`))
    for (const e of await store.entities.all()) {
      const k = `${e.dataClass}\u0000${e.id}`
      if (named.has(k) || pending.has(k)) continue
      if (e.phase === 'reconciled' || e.phase === 'acknowledged') await store.entities.remove(e.dataClass, e.id)
    }
  }

  private async dropRevoked(rows: { dataClass: DataClass; id: string }[]): Promise<void> {
    const { store } = this.d
    for (const { dataClass, id } of rows) {
      await store.entities.remove(dataClass, id)
      // Unsent work stays as a personal copy but can never be merged: its reason is terminal.
      for (const r of (await store.outbox.all()).filter((o) => o.dataClass === dataClass && o.entityId === id)) {
        await store.outbox.put({ ...r, phase: 'rejected', rejectReason: 'membership_removed', nextAttemptAt: Infinity })
      }
    }
    await this.d.onRevokedRows?.(rows)
  }

  // ---- deciding ---------------------------------------------------------

  async resolveConflict(commandId: string, choice: 'mine' | 'theirs' | { merged: unknown }): Promise<void> {
    const { store, now } = this.d
    await store.transaction(async () => {
      const r = await store.outbox.get(commandId)
      if (!r || r.phase !== 'conflict_requires_copy' || !r.conflict) throw new Error('Nothing to resolve.')
      const e = await store.entities.get(r.dataClass, r.entityId)
      if (choice === 'theirs') {
        await store.outbox.remove(r.id)
        await store.entities.put({ ...(e as EntityRow), value: r.conflict.serverValue, confirmed: r.conflict.serverValue, version: r.conflict.serverVersion, phase: 'reconciled', commandId: undefined })
        return
      }
      const payload = choice === 'mine' ? r.payload : choice.merged
      // New base, maybe new content: a different command, so a different key. One key never means two things.
      const id = this.d.newId()
      await store.outbox.remove(r.id)
      await store.outbox.put({ ...r, id, payload, baseVersion: r.conflict.serverVersion, phase: 'queued', attempts: 0, nextAttemptAt: now(), conflict: undefined, confirmedAt: r.confirmedAt ?? now() })
      await store.entities.put({
        ...(e as EntityRow),
        value: choice === 'mine' ? e!.value : choice.merged,
        version: r.conflict.serverVersion,
        phase: 'queued',
        commandId: id,
        // The version that lost is kept so the person can see what their choice replaced.
        evidence: [...(e?.evidence ?? []), { field: '*', lost: choice === 'mine' ? r.conflict.serverValue : r.payload, at: now() }],
      })
    })
  }

  /** Try a rejected command again. Terminal rejections cannot be retried: they would be refused again. */
  async retry(commandId: string): Promise<void> {
    const { store, now } = this.d
    await store.transaction(async () => {
      const r = await store.outbox.get(commandId)
      if (!r || r.phase !== 'rejected') throw new Error('Nothing to retry.')
      if (r.rejectReason && TERMINAL_REASONS.includes(r.rejectReason)) throw new Error('This cannot be sent again.')
      await store.outbox.put({ ...r, phase: 'queued', attempts: 0, nextAttemptAt: now(), rejectReason: undefined, detail: undefined })
      await this.setEntityPhase(r.dataClass, r.entityId, 'queued', r.id)
    })
  }

  /** Throw away unsent work and put back what the server last confirmed. */
  async discard(commandId: string): Promise<void> {
    const { store } = this.d
    await store.transaction(async () => {
      const r = await store.outbox.get(commandId)
      if (!r) return
      if (r.phase === 'sent' || r.phase === 'pending_reconciliation') throw new Error('It may already have arrived; wait for the answer.')
      await store.outbox.remove(r.id)
      const e = await store.entities.get(r.dataClass, r.entityId)
      if (!e) return
      if (e.confirmed === undefined) await store.entities.remove(r.dataClass, r.entityId)
      else await store.entities.put({ ...e, value: e.confirmed, phase: 'reconciled', commandId: undefined })
    })
  }

  // ---- reading ----------------------------------------------------------

  /** The state to show for a row. The only place a phase becomes a word. */
  stateOf(e: Pick<EntityRow, 'phase'>): SyncState {
    return PHASE_TO_STATE[e.phase]
  }

  async summary(): Promise<SyncSummary> {
    const counts: Record<SyncState, number> = { local: 0, pending: 0, synced: 0, rejected: 0, conflicted: 0 }
    for (const e of await this.d.store.entities.all()) counts[PHASE_TO_STATE[e.phase]]++
    const rows = (await this.d.store.outbox.all()).filter((r) => PHASE_TO_STATE[r.phase] === 'pending')
    const times = rows.map((r) => r.nextAttemptAt).filter(Number.isFinite)
    return {
      counts,
      pending: counts.pending,
      oldestPendingAt: rows.length ? Math.min(...rows.map((r) => r.createdAt)) : null,
      nextAttemptAt: times.length ? Math.min(...times) : null,
      lastSyncAt: this.lastSyncAt,
    }
  }

  // ---- internals --------------------------------------------------------

  private applyLocally(prev: unknown, c: Pick<Command, 'op' | 'payload'>): unknown {
    if (c.op === 'delete') return null
    if (c.op === 'patch' && isObj(prev) && isObj(c.payload)) return { ...prev, ...c.payload }
    return c.payload
  }

  private async setEntityPhase(dataClass: DataClass, id: string, phase: EntityRow['phase'], commandId: string): Promise<void> {
    const e = await this.d.store.entities.get(dataClass, id)
    if (e) await this.d.store.entities.put({ ...e, phase, commandId })
  }
}

function toCommand(r: OutboxRow): Command {
  const { phase: _p, attempts: _a, nextAttemptAt: _n, confirmedAt: _c, rejectReason: _r, detail: _d, conflict: _x, ...cmd } = r
  return cmd
}
