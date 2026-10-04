/**
 * The one vocabulary every mobile/offline workflow shows, and how it is
 * derived from the queue's own phases.
 *
 *   local      on this device only; never offered to the server
 *   pending    handed to the sync engine (or held for a confirming tap); the
 *              server has not answered
 *   synced     the server accepted it and said so
 *   rejected   the server refused it; the reason is kept and shown
 *   conflicted the server holds a different state that needs a decision
 *
 * The state is a *projection*. The queue keeps the contract's finer phases
 * (`docs/architecture/offline-sync-contract.md`) and the screen shows five.
 * `synced` is reachable only from an acknowledgement, so the interface cannot
 * claim a success nobody confirmed.
 */
export type SyncState = 'local' | 'pending' | 'synced' | 'rejected' | 'conflicted'

/** draft→queued→sent→acknowledged→reconciled, plus the two ways it can go wrong. */
export type QueuePhase =
  | 'draft'
  | 'queued'
  | 'sent'
  | 'pending_reconciliation'
  | 'acknowledged'
  | 'reconciled'
  | 'rejected'
  | 'conflict_requires_copy'

export const PHASE_TO_STATE: Record<QueuePhase, SyncState> = {
  draft: 'local',
  queued: 'pending',
  sent: 'pending',
  // Ambiguous result: we do not know. Never shown as synced, never as failed.
  pending_reconciliation: 'pending',
  acknowledged: 'synced',
  reconciled: 'synced',
  rejected: 'rejected',
  conflict_requires_copy: 'conflicted',
}

/** Existing app words (`lib/syncstatus.ts` `SyncStatus`) each new state replaces or extends. */
export const LEGACY_STATUS: Record<SyncState, readonly string[]> = {
  local: ['off', 'signed-out'],
  pending: ['queued', 'syncing', 'offline'],
  synced: ['synced'],
  rejected: ['error', 'read-only'],
  conflicted: ['conflict', 'review'],
}

export type RejectReason =
  | 'policy_denied'
  | 'validation_failed'
  | 'device_revoked'
  | 'session_expired'
  | 'membership_removed'
  | 'permission_epoch_stale'
  | 'server_authoritative'
  | 'quota_exceeded'
  | 'dead_letter'
  | 'expired'
  | 'malware_detected'

/** Reasons where sending the same command again can never succeed. */
export const TERMINAL_REASONS: readonly RejectReason[] = [
  'policy_denied', 'device_revoked', 'membership_removed', 'server_authoritative', 'dead_letter', 'expired', 'malware_detected',
]

export type SyncEvent =
  | { type: 'edit' }
  | { type: 'confirm' }
  | { type: 'ack' }
  | { type: 'reject' }
  | { type: 'conflict' }
  | { type: 'resolve' }
  | { type: 'retry' }
  | { type: 'discard' }

const TABLE: Record<SyncState, Partial<Record<SyncEvent['type'], SyncState | 'gone'>>> = {
  local: { confirm: 'pending', edit: 'local', discard: 'gone' },
  pending: { ack: 'synced', reject: 'rejected', conflict: 'conflicted', edit: 'pending', discard: 'gone' },
  synced: { edit: 'pending' },
  rejected: { retry: 'pending', edit: 'local', discard: 'gone' },
  conflicted: { resolve: 'pending', discard: 'gone' },
}

/** The next state, `'gone'` when the record is dropped, or null when the move is not allowed. */
export function transition(state: SyncState, event: SyncEvent): SyncState | 'gone' | null {
  return TABLE[state][event.type] ?? null
}

/** Words and whether the person must act. Copy lives here so no screen invents its own. */
export const STATE_COPY: Record<SyncState, { label: string; detail: string; needsAction: boolean }> = {
  local: { label: 'On this device', detail: 'Saved here. Not sent.', needsAction: false },
  pending: { label: 'Waiting to sync', detail: 'Saved here. Semester has not confirmed it yet.', needsAction: false },
  synced: { label: 'Synced', detail: 'Confirmed by Semester.', needsAction: false },
  rejected: { label: 'Not accepted', detail: 'Semester refused this. It is still saved here.', needsAction: true },
  conflicted: { label: 'Needs your choice', detail: 'This changed somewhere else too. Both versions are kept.', needsAction: true },
}

export const SYNC_STATES: readonly SyncState[] = ['local', 'pending', 'synced', 'rejected', 'conflicted']
