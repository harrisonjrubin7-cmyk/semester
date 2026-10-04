import { clampToServer, hlcCompare, type Hlc } from '../hlc.ts'
import { DATA_CLASSES, policyFor, type DataClass } from '../policy.ts'
import type { Change, Command, CommandResult, PullResponse, PushResponse, SyncTransport } from '../types.ts'

/**
 * The server half of the protocol, in memory, small enough to read in one
 * sitting. It is the executable form of what the gateway must do and the
 * counterpart the offline tests run against; the real one lives behind
 * `app/server/institution` and Postgres, with the same decisions in the same
 * order.
 */
interface Rec { version: number; value: Record<string, unknown> | null; fieldClock: Record<string, Hlc>; history: { version: number; fields: string[] }[] }

export interface GatewayOptions {
  now: () => number
  /** Per-user, per-entity authorisation, evaluated on every command and every pull. */
  can?: (userId: string, dataClass: DataClass, entityId: string) => boolean
  permissionEpoch?: () => number
  /** Drop the response of the next N push calls *after* applying them: the lost-answer case. */
  loseResponses?: number
}

export class ReferenceGateway implements SyncTransport {
  readonly records = new Map<string, Rec>()
  readonly seenKeys = new Map<string, CommandResult>()
  readonly feed: { seq: number; change: Change }[] = []
  readonly revokedDevices = new Set<string>()
  readonly receipts: { entityId: string; commandId: string; at: number }[] = []
  private seq = 0
  private pendingRevocations: { dataClass: DataClass; id: string }[] = []
  private oldestCursor = 0
  private lost: number
  expireSessions = false
  private o: GatewayOptions
  constructor(o: GatewayOptions) {
    this.o = o
    this.lost = o.loseResponses ?? 0
  }

  private key = (c: DataClass, id: string) => `${c}\u0000${id}`

  /** A change made by someone else, as the server would feed it to this user. */
  external(dataClass: DataClass, id: string, patch: Record<string, unknown>, hlc: Hlc): void {
    const r = this.records.get(this.key(dataClass, id)) ?? { version: 0, value: {}, fieldClock: {}, history: [] }
    this.write(dataClass, id, r, patch, hlc)
  }

  /** The person lost access to this record; the next pull says so, once. */
  revoke(dataClass: DataClass, id: string): void {
    this.pendingRevocations.push({ dataClass, id })
  }

  /** Compact the feed so older cursors are gone. */
  compactFeed(): void {
    this.oldestCursor = this.seq
    this.feed.length = 0
  }

  private write(dataClass: DataClass, id: string, r: Rec, patch: Record<string, unknown>, hlc: Hlc): Rec {
    // A class that asks on a clash has already settled it by the time a command reaches here:
    // a command at the current base is a decision, not a race, so the clock does not get a vote.
    const decided = (DATA_CLASSES as Record<string, { sameField?: string }>)[dataClass]?.sameField === 'ask'
    const server = this.o.now()
    const clamped = clampToServer(hlc, server)
    const applied: Record<string, unknown> = {}
    for (const [f, v] of Object.entries(patch)) {
      const prev = r.fieldClock[f]
      if (decided || !prev || hlcCompare(clamped, prev) > 0) { applied[f] = v; r.fieldClock[f] = clamped }
    }
    r.value = { ...(r.value ?? {}), ...applied }
    r.version++
    r.history.push({ version: r.version, fields: Object.keys(patch) })
    this.records.set(this.key(dataClass, id), r)
    this.feed.push({ seq: ++this.seq, change: { dataClass, id, version: r.version, value: r.value, changedFields: Object.keys(patch), hlc: clamped } })
    return r
  }

  private run(c: Command): CommandResult {
    const done = this.seenKeys.get(c.id)
    // Same key, same answer — including for a command whose first answer never reached the phone.
    if (done) return done.status === 'applied' ? { ...done, status: 'duplicate' } : done
    const result = this.decide(c)
    // Only what was *applied* is remembered. A refusal or a conflict depends on state that moves; replaying
    // it for a re-sent key would answer a new question with an old answer. The key's job is no double-apply.
    if (result.status === 'applied') this.seenKeys.set(c.id, result)
    return result
  }

  private decide(c: Command): CommandResult {
    const p = (DATA_CLASSES as Record<string, ReturnType<typeof policyFor>>)[c.dataClass]
    if (!p) return { id: c.id, status: 'rejected', reason: 'policy_denied' }
    if (p.write === 'never-queued' || p.write === 'draft') return { id: c.id, status: 'rejected', reason: 'server_authoritative', detail: 'This is decided online only.' }
    if (c.expiresAt <= this.o.now()) return { id: c.id, status: 'rejected', reason: 'expired' }
    if (c.permissionEpoch < (this.o.permissionEpoch?.() ?? 0)) return { id: c.id, status: 'rejected', reason: 'permission_epoch_stale' }
    if (this.o.can && !this.o.can(c.userId, c.dataClass, c.entityId)) return { id: c.id, status: 'rejected', reason: 'membership_removed' }

    const k = this.key(c.dataClass, c.entityId)
    const r = this.records.get(k)
    if (c.op === 'submit') {
      this.receipts.push({ entityId: c.entityId, commandId: c.id, at: this.o.now() })
      const rec = r ?? { version: 0, value: {}, fieldClock: {}, history: [] }
      const after = this.write(c.dataClass, c.entityId, rec, { submitted: true, receipt: c.id }, c.hlc)
      return { id: c.id, status: 'applied', serverVersion: after.version, receipt: c.id, value: after.value }
    }
    if (c.op === 'create') {
      if (r) return { id: c.id, status: 'conflict', serverVersion: r.version, serverValue: r.value }
      const fresh: Rec = { version: 0, value: {}, fieldClock: {}, history: [] }
      const made = this.write(c.dataClass, c.entityId, fresh, c.payload as Record<string, unknown>, c.hlc)
      return { id: c.id, status: 'applied', serverVersion: made.version, value: made.value }
    }
    if (!r) return { id: c.id, status: 'rejected', reason: 'validation_failed', detail: 'No such item.' }
    if (c.op === 'delete') {
      this.records.delete(k)
      this.feed.push({ seq: ++this.seq, change: { dataClass: c.dataClass, id: c.entityId, version: r.version + 1, deleted: true } })
      return { id: c.id, status: 'applied', serverVersion: r.version + 1 }
    }
    const patch = c.payload as Record<string, unknown>
    if (c.baseVersion !== null && c.baseVersion < r.version && p.sameField === 'ask') {
      const mine = Object.keys(patch)
      const clash = r.history.some((h) => h.version > c.baseVersion! && h.fields.some((f) => mine.includes(f)))
      if (clash) return { id: c.id, status: 'conflict', serverVersion: r.version, serverValue: r.value }
    }
    const after = this.write(c.dataClass, c.entityId, r, patch, c.hlc)
    // The merged value, not just a number: another device's edit may be in it.
    return { id: c.id, status: 'applied', serverVersion: after.version, value: after.value }
  }

  async push(req: { deviceId: string; commands: Command[] }): Promise<PushResponse> {
    if (this.revokedDevices.has(req.deviceId)) return { kind: 'device_revoked' }
    if (this.expireSessions) return { kind: 'session_expired' }
    const results = [...req.commands].sort((a, b) => a.seq - b.seq).map((c) => this.run(c))
    if (this.lost > 0) { this.lost--; throw new Error('network: response lost') }
    return { kind: 'results', results }
  }

  async status(req: { deviceId: string; ids: string[] }): Promise<PushResponse> {
    if (this.revokedDevices.has(req.deviceId)) return { kind: 'device_revoked' }
    return { kind: 'results', results: req.ids.map((id) => { const d = this.seenKeys.get(id); return d ? (d.status === 'applied' ? { ...d, status: 'duplicate' as const } : d) : { id, status: 'unknown' as const } }) }
  }

  async pull(req: { deviceId: string; scope: string; cursor?: string; limit: number }): Promise<PullResponse> {
    if (this.revokedDevices.has(req.deviceId)) return { kind: 'device_revoked' }
    if (this.expireSessions) return { kind: 'session_expired' }
    const userId = req.scope.split(':')[1] ?? ''
    const can = (f: { change: Change }) => !this.o.can || this.o.can(userId, f.change.dataClass, f.change.id)
    if (!req.cursor) {
      // No cursor: a new install, or one the server no longer honours. Send the present state, then the feed from here.
      const snap: Change[] = [...this.records].map(([k, r]) => { const [dataClass, id] = k.split('\u0000'); return { dataClass: dataClass as DataClass, id: id!, version: r.version, value: r.value } })
      const visible = snap.filter((c) => !this.o.can || this.o.can(userId, c.dataClass, c.id))
      return { kind: 'changes', changes: visible, nextCursor: String(this.seq), hasMore: false }
    }
    const after = Number(req.cursor)
    if (after < this.oldestCursor) return { kind: 'changes', cursorExpired: true }
    const page = this.feed.filter((f) => f.seq > after && can(f))
    const visible = page.slice(0, req.limit)
    const more = page.length > visible.length
    const next = visible.length && more ? visible[visible.length - 1]!.seq : this.seq
    const revoked = this.pendingRevocations.splice(0)
    return { kind: 'changes', changes: visible.map((f) => f.change), revoked: revoked.length ? revoked : undefined, nextCursor: String(Math.max(next, after)), hasMore: more }
  }
}
