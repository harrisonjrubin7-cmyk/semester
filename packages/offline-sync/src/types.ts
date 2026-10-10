import type { Hlc } from './hlc.ts'
import type { DataClass } from './policy.ts'
import type { QueuePhase, RejectReason } from './status.ts'

/** What a device asks the server to do. `id` is the idempotency key and never changes across retries. */
export interface Command {
  id: string
  tenantId: string
  userId: string
  /** Device installation, not a hardware id. */
  deviceId: string
  dataClass: DataClass
  entityId: string
  op: 'create' | 'patch' | 'delete' | 'submit'
  payload: unknown
  /** Server version this edit was made against; null for a create. */
  baseVersion: number | null
  hlc: Hlc
  /** Policy version and permission epoch the device believed, so the server can see staleness. */
  policyVersion: string
  permissionEpoch: number
  createdAt: number
  /** Past this the command is dropped, not sent: a late apply can contradict the world it was made in. */
  expiresAt: number
  /** Per-device monotonic order. */
  seq: number
}

export interface OutboxRow extends Command {
  phase: Extract<QueuePhase, 'draft' | 'queued' | 'sent' | 'pending_reconciliation' | 'rejected' | 'conflict_requires_copy'>
  attempts: number
  nextAttemptAt: number
  /** held-send rows wait here until the person taps; the engine never sends them before. */
  confirmedAt?: number
  rejectReason?: RejectReason
  detail?: string
  conflict?: { serverVersion: number; serverValue: unknown; mine: unknown }
}

/** A cached or locally authored row, with the phase the screen must reflect. */
export interface EntityRow {
  dataClass: DataClass
  id: string
  value: unknown
  /** Last version the server confirmed; null for something never synced. */
  version: number | null
  phase: QueuePhase
  fetchedAt: number
  commandId?: string
  /** Last server-confirmed value, so discarding unsent work can put it back. */
  confirmed?: unknown
  /** Same-field conflicts settled by clock, kept so the person can see what happened. */
  evidence?: { field: string; lost: unknown; at: number }[]
}

export interface LocalStore {
  /** Writes inside commit together or not at all. */
  transaction<T>(fn: () => Promise<T>): Promise<T>
  outbox: {
    put(row: OutboxRow): Promise<void>
    get(id: string): Promise<OutboxRow | undefined>
    all(): Promise<OutboxRow[]>
    remove(id: string): Promise<void>
  }
  entities: {
    put(row: EntityRow): Promise<void>
    get(dataClass: string, id: string): Promise<EntityRow | undefined>
    all(): Promise<EntityRow[]>
    remove(dataClass: string, id: string): Promise<void>
  }
  cursors: {
    get(scope: string): Promise<string | undefined>
    set(scope: string, value: string): Promise<void>
    remove(scope: string): Promise<void>
  }
}

// ---- wire protocol -------------------------------------------------------

export type CommandResult =
  | { id: string; status: 'applied'; serverVersion: number; receipt?: string; value?: unknown }
  /** Seen under this key before: the original answer, repeated. */
  | { id: string; status: 'duplicate'; serverVersion: number; receipt?: string; value?: unknown }
  | { id: string; status: 'rejected'; reason: RejectReason; detail?: string }
  | { id: string; status: 'conflict'; serverVersion: number; serverValue: unknown }
  | { id: string; status: 'retry'; retryAfterMs?: number }
  /** Asked about a key the server never saw. Safe to send again. */
  | { id: string; status: 'unknown' }

export type PushResponse =
  | { kind: 'results'; results: CommandResult[] }
  | { kind: 'session_expired' }
  | { kind: 'device_revoked' }

export interface Change {
  dataClass: DataClass
  id: string
  version: number
  value?: unknown
  deleted?: boolean
  /** Field-merge classes: which fields this server change touched. */
  changedFields?: string[]
  /** Server-clamped clock of that change, for same-field ordering. */
  hlc?: Hlc
}

export interface PullResponse {
  kind: 'changes' | 'session_expired' | 'device_revoked'
  changes?: Change[]
  /** Rows the caller may no longer see: remove them and any cached files. */
  revoked?: { dataClass: DataClass; id: string }[]
  nextCursor?: string
  hasMore?: boolean
  /** The cursor is older than the server keeps; start over from a snapshot. */
  cursorExpired?: boolean
  /**
   * `changes` is the whole present state, not a delta (a new install, or a cursor the server no longer
   * honours). Anything the device holds that is confirmed and absent from it was deleted meanwhile.
   */
  snapshot?: boolean
}

export interface SyncTransport {
  push(req: { deviceId: string; commands: Command[] }): Promise<PushResponse>
  /** Ask what became of keys whose answer was lost. Never applies anything. */
  status(req: { deviceId: string; ids: string[] }): Promise<PushResponse>
  pull(req: { deviceId: string; scope: string; cursor?: string; limit: number }): Promise<PullResponse>
}
