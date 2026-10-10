/**
 * What may be kept on a device, written offline, and how a disagreement is
 * settled — one table, so a phone, a browser and the gateway apply one rule.
 *
 * It encodes `docs/architecture/offline-sync-contract.md`; where the two
 * differ the document wins and this file is the bug. Write modes reuse the
 * vocabulary of `app/src/lib/sync/classes.ts` (`held-send`, `never-queued`)
 * so there is one set of words for "will this ever wait for a connection".
 *
 * Conflict models, and no others:
 *   field-merge          independent fields merge; same-field is settled by the
 *                        server-clamped hybrid logical clock or by asking
 *   crdt                 convergent updates; student-authored shared text only
 *   server-authoritative the device may ask or read, never decide
 *   append-only          devices add, nothing is edited or removed
 */
export type ConflictModel = 'field-merge' | 'crdt' | 'server-authoritative' | 'append-only'

/**
 *   auto         queued and sent by the engine without a further tap
 *   held-send    queued only after the person confirms; never sent by itself
 *   draft        stays on this device; the consequential step happens online
 *   never-queued refused offline; nothing is held, nothing will fire later
 */
export type WriteMode = 'auto' | 'held-send' | 'draft' | 'never-queued'

/**
 *   yes          may be kept in the encrypted store
 *   tenant-opt-in denied unless the institution's policy allows an expiring read cache
 *   never        never enters the content database, logs, crash reports or previews
 */
export type CacheMode = 'yes' | 'tenant-opt-in' | 'never'

export interface DataClassPolicy {
  conflict: ConflictModel
  write: WriteMode
  cache: CacheMode
  /** Longest a cached row may be shown without a server check, in ms. */
  maxStaleMs: number
  /** For field-merge: what happens when both sides changed the same field. */
  sameField?: 'hlc' | 'ask'
  /** The server re-evaluates the caller's access on every sync, including replays of queued work. */
  recheckOnSync: boolean
}

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const personal = (sameField: 'hlc' | 'ask'): DataClassPolicy => ({
  conflict: 'field-merge', write: 'auto', cache: 'yes', maxStaleMs: 30 * DAY, sameField, recheckOnSync: false,
})
const shared: DataClassPolicy = { conflict: 'crdt', write: 'auto', cache: 'yes', maxStaleMs: 7 * DAY, recheckOnSync: true }
const official = (maxStaleMs: number): DataClassPolicy => ({
  conflict: 'server-authoritative', write: 'never-queued', cache: 'tenant-opt-in', maxStaleMs, recheckOnSync: true,
})
const online: DataClassPolicy = {
  conflict: 'server-authoritative', write: 'never-queued', cache: 'never', maxStaleMs: 0, recheckOnSync: true,
}

export const DATA_CLASSES = {
  // Student-owned, local-first. Encrypted, merged, synced automatically.
  task: personal('hlc'),
  calendar_annotation: personal('hlc'),
  personal_plan: personal('hlc'),
  personal_note: personal('ask'),
  study_artifact: personal('ask'),
  portfolio_draft: personal('ask'),
  // Collaborative, student-authored: CRDT, authorised per update.
  shared_document: shared,
  shared_note: shared,
  comment: shared,
  group_work: shared,
  // Drafts stay on the device; the step that matters happens online.
  assignment_draft: { conflict: 'field-merge', write: 'draft', cache: 'yes', maxStaleMs: 14 * DAY, sameField: 'ask', recheckOnSync: true },
  support_draft: { conflict: 'field-merge', write: 'draft', cache: 'yes', maxStaleMs: 7 * DAY, sameField: 'ask', recheckOnSync: true },
  ai_draft: { conflict: 'field-merge', write: 'draft', cache: 'yes', maxStaleMs: 7 * DAY, sameField: 'ask', recheckOnSync: true },
  // Held sends: the person taps once; a receipt exists only after the server accepts.
  submission: { conflict: 'server-authoritative', write: 'held-send', cache: 'yes', maxStaleMs: 14 * DAY, recheckOnSync: true },
  support_case: { conflict: 'server-authoritative', write: 'held-send', cache: 'yes', maxStaleMs: 7 * DAY, recheckOnSync: true },
  // Source-derived metadata: allowlisted fields, expiring, source wins.
  assignment_metadata: { conflict: 'server-authoritative', write: 'never-queued', cache: 'yes', maxStaleMs: 3 * DAY, recheckOnSync: true },
  course_content: { conflict: 'server-authoritative', write: 'never-queued', cache: 'yes', maxStaleMs: 14 * DAY, recheckOnSync: true },
  // Official records called out by the launch boundary stay online-only. These
  // names mean source-issued records, not a student's own grade estimate or
  // financial plan, which remain student-owned data in the web app.
  grade: online,
  academic_record: online,
  financial_aid: online,
  // Other official summaries remain denied by default and require an explicit
  // tenant opt-in until their own launch decision narrows them further.
  billing_summary: official(24 * HOUR),
  accommodation: official(12 * HOUR),
  registration: official(6 * HOUR),
  // Never in the content database at all.
  case_note: online,
  wellness: online,
  conduct: online,
  payment: online,
  ledger_entry: online,
  permission_grant: online,
  consent: online,
  guardian_projection: online,
  approval: online,
  grade_change: online,
  record_amendment: online,
  audit_event: { conflict: 'append-only', write: 'never-queued', cache: 'never', maxStaleMs: 0, recheckOnSync: true },
} as const satisfies Record<string, DataClassPolicy>

export type DataClass = keyof typeof DATA_CLASSES

export const dataClasses = Object.keys(DATA_CLASSES) as DataClass[]

const byConflict = (m: ConflictModel) => dataClasses.filter((c) => DATA_CLASSES[c].conflict === m)

/**
 * CRDTs are for authored, collaboratively edited text and its annotations. A
 * CRDT merges anything, which is why it must never hold a grade, a balance, a
 * seat or a permission: it would converge on a wrong answer.
 */
export const CRDT_CLASSES: readonly DataClass[] = byConflict('crdt')
export const SERVER_AUTHORITATIVE_CLASSES: readonly DataClass[] = byConflict('server-authoritative')
/** Classes a device may never queue, hold or replay. */
export const NEVER_QUEUED: readonly DataClass[] = dataClasses.filter((c) => DATA_CLASSES[c].write === 'never-queued')
/** Classes that may never enter the encrypted content database. */
export const NEVER_CACHED: readonly DataClass[] = dataClasses.filter((c) => DATA_CLASSES[c].cache === 'never')

/**
 * One fail-closed decision for every durable device write. Callers should not
 * infer persistence from freshness: a row is admitted first, then aged.
 */
export type PersistenceDecision =
  | { allowed: true; policy: DataClassPolicy }
  | { allowed: false; why: Extract<PolicyViolation, 'unknown_class' | 'not_cacheable' | 'tenant_has_not_opted_in'> }

export function classifyPersistence(dataClass: string, tenant: TenantOfflinePolicy = NO_OPT_IN): PersistenceDecision {
  let p: DataClassPolicy
  try {
    p = policyFor(dataClass)
  } catch {
    return { allowed: false, why: 'unknown_class' }
  }
  if (p.cache === 'never') return { allowed: false, why: 'not_cacheable' }
  if (p.cache === 'tenant-opt-in' && !tenant.optIn.includes(dataClass as DataClass)) {
    return { allowed: false, why: 'tenant_has_not_opted_in' }
  }
  return { allowed: true, policy: p }
}

export type PolicyViolation = 'unknown_class' | 'offline_write_prohibited' | 'not_a_crdt_class' | 'not_cacheable' | 'tenant_has_not_opted_in'

export class OfflinePolicyError extends Error {
  readonly dataClass: string
  readonly why: PolicyViolation
  constructor(dataClass: string, why: PolicyViolation) {
    super(`${dataClass}: ${why}`)
    this.name = 'OfflinePolicyError'
    this.dataClass = dataClass
    this.why = why
  }
}

export function policyFor(dataClass: string): DataClassPolicy {
  const own = Object.prototype.hasOwnProperty.call(DATA_CLASSES, dataClass)
  const p = own ? (DATA_CLASSES as Record<string, DataClassPolicy>)[dataClass] : undefined
  // An unknown class is refused, not defaulted: a default is a guess about authority.
  if (!p || typeof p !== 'object' || !('cache' in p) || !('write' in p)) throw new OfflinePolicyError(dataClass, 'unknown_class')
  return p
}

/** Stable admission set persisted beside a feed cursor to detect policy expansion. */
export function admittedDataClasses(tenant: TenantOfflinePolicy = NO_OPT_IN): DataClass[] {
  return dataClasses.filter((dataClass) => classifyPersistence(dataClass, tenant).allowed).sort()
}

/** Throws unless the engine may queue this class (automatically or after a confirming tap). */
export function assertQueueable(dataClass: string): DataClassPolicy {
  const p = policyFor(dataClass)
  if (p.write === 'never-queued' || p.write === 'draft') throw new OfflinePolicyError(dataClass, 'offline_write_prohibited')
  return p
}

export function assertCrdt(dataClass: string): void {
  if (policyFor(dataClass).conflict !== 'crdt') throw new OfflinePolicyError(dataClass, 'not_a_crdt_class')
}

/** The tenant's decision about classes that are denied by default. */
export interface TenantOfflinePolicy {
  /** Classes the institution allows as an expiring read cache. */
  optIn: readonly DataClass[]
  /** A tighter ceiling than the class default, per class. */
  maxStaleMs?: Partial<Record<DataClass, number>>
}

export const NO_OPT_IN: TenantOfflinePolicy = { optIn: [] }

export function assertCacheable(dataClass: string, tenant: TenantOfflinePolicy = NO_OPT_IN): DataClassPolicy {
  const decision = classifyPersistence(dataClass, tenant)
  if (!decision.allowed) throw new OfflinePolicyError(dataClass, decision.why)
  return decision.policy
}

export type Freshness = 'current' | 'stale' | 'expired'

/** Whether a cached row may still be shown, and under which label. Expired rows are not shown. */
export function freshness(dataClass: string, fetchedAt: number, now: number, tenant: TenantOfflinePolicy = NO_OPT_IN): Freshness {
  const decision = classifyPersistence(dataClass, tenant)
  if (!decision.allowed) return 'expired'
  const p = decision.policy
  const limit = Math.min(p.maxStaleMs, tenant.maxStaleMs?.[dataClass as DataClass] ?? Infinity)
  if (p.cache === 'never' || limit <= 0) return 'expired'
  const age = now - fetchedAt
  if (age > limit) return 'expired'
  return age > limit / 2 ? 'stale' : 'current'
}
