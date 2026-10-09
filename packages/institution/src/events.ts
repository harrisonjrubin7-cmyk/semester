/**
 * The event envelope, the catalog of what may be in one, and the two
 * contracts that make an event safe to act on: an outbox that is written in
 * the same transaction as the record it describes, and a consumer that can be
 * handed the same event twice.
 *
 * Why events at all: a grade posts, and the gradebook, the student's action
 * centre, the notification queue, the SIS passback and the audit log all need
 * to hear about it. Chained synchronous calls do that until one of them fails
 * halfway, and then a grade is posted that nobody was told about. The
 * integration worker already learned this (`server/integration/retry.ts`,
 * `worker.ts`: retry with backoff, a dead-letter after repeated failure, a
 * replay an operator asks for). This module is that lesson as a shape every
 * module can use rather than one the integration pipeline keeps to itself.
 *
 * ## The transactional outbox
 *
 * Write the business record and the outbox row in one database transaction.
 * A publisher reads unpublished rows and sends them; a row it cannot send
 * stays, with its attempt count and last error, until it is sent or
 * dead-lettered. `drainOutbox` is that publisher's loop, against any store
 * that implements `OutboxStore` — `MemoryOutbox` here, for tests;
 * `private.domain_outbox_events` in Postgres for production
 * (`20260928320000_audit_correlation_and_outbox.sql`).
 *
 * ## Consumers are idempotent or they are wrong
 *
 * At-least-once delivery means every consumer will eventually see an event
 * twice. `processOnce` records the outcome per (consumer, event) in a receipt
 * ledger before the handler's side effects can be repeated, so the second
 * delivery is a no-op that says so. A consumer that writes to somebody
 * else's system without this is the "never do this" diagram in the
 * specification.
 *
 * See `docs/architecture/0008-event-envelope-and-outbox.md`.
 */

import {
  CORRELATION_ID_PATTERN,
  POLICY_ENVIRONMENTS,
  RESOURCE_CLASSIFICATIONS,
  type ActorType,
  type PolicyEnvironment,
  type ResourceClassification,
} from './policy.ts';

/**
 * Retention classes, and what each means for the row that carries one. The
 * durations are policy (`RETENTION.md`), not code; the class is what a row
 * declares so the sweep can apply the policy without reading the payload.
 */
export const RETENTION_CLASSES = ['operational', 'student_record', 'audit', 'commercial'] as const;
export type RetentionClass = (typeof RETENTION_CLASSES)[number];

interface EventSpec {
  version: number;
  classification: ResourceClassification;
  retention: RetentionClass;
}

const spec = (version: number, classification: ResourceClassification, retention: RetentionClass): EventSpec =>
  ({ version, classification, retention });

/**
 * Every event type, with the version a producer must stamp and the
 * classification and retention class its payload is held to. A consumer that
 * receives a type not in this list refuses it; a producer that wants a new
 * one adds it here, in the same change as the first consumer.
 */
export const EVENT_TYPES = {
  // Identity
  'identity.user_registered': spec(1, 'internal', 'audit'),
  'identity.session_authenticated': spec(1, 'internal', 'operational'),
  'identity.role_granted': spec(1, 'internal', 'audit'),
  'identity.role_revoked': spec(1, 'internal', 'audit'),
  // Student and action
  'action.created': spec(1, 'student_private', 'student_record'),
  'action.updated': spec(1, 'student_private', 'student_record'),
  'action.completed': spec(1, 'student_private', 'student_record'),
  'plan.updated': spec(1, 'student_private', 'student_record'),
  // Tasks and calendar. Payloads carry ids, versions and the names of the
  // fields that changed, never what they were changed to.
  'task.created': spec(1, 'student_private', 'student_record'),
  'task.updated': spec(1, 'student_private', 'student_record'),
  'task.completed': spec(1, 'student_private', 'student_record'),
  'task.deleted': spec(1, 'student_private', 'student_record'),
  'calendar_event.created': spec(1, 'student_private', 'student_record'),
  'calendar_event.updated': spec(1, 'student_private', 'student_record'),
  'calendar_event.deleted': spec(1, 'student_private', 'student_record'),
  'productivity.shared_read': spec(1, 'student_private', 'audit'),
  'agenda.shared': spec(1, 'student_private', 'audit'),
  'share.revoked': spec(1, 'student_private', 'audit'),
  // LMS
  'course.published': spec(1, 'internal', 'operational'),
  'assignment.created': spec(1, 'internal', 'operational'),
  'submission.draft_saved': spec(1, 'education_record', 'student_record'),
  'submission.finalized': spec(1, 'education_record', 'student_record'),
  'assessment.started': spec(1, 'education_record', 'student_record'),
  'assessment.autosaved': spec(1, 'education_record', 'operational'),
  'assessment.recovered': spec(1, 'education_record', 'audit'),
  'grade.posted': spec(1, 'education_record', 'student_record'),
  'grade.passback_requested': spec(1, 'education_record', 'audit'),
  'grade.passback_reconciled': spec(1, 'education_record', 'audit'),
  // Integration
  'connector.sync_started': spec(1, 'internal', 'operational'),
  'connector.sync_completed': spec(1, 'internal', 'operational'),
  'connector.sync_failed': spec(1, 'internal', 'operational'),
  'source.updated': spec(1, 'internal', 'operational'),
  'source.stale': spec(1, 'internal', 'operational'),
  'reconciliation.discrepancy_detected': spec(1, 'internal', 'audit'),
  // AI
  'ai.requested': spec(1, 'student_private', 'operational'),
  'ai.policy_blocked': spec(1, 'student_private', 'audit'),
  'ai.retrieval_completed': spec(1, 'education_record', 'audit'),
  'ai.response_completed': spec(1, 'student_private', 'operational'),
  'ai.feedback_submitted': spec(1, 'student_private', 'operational'),
  'ai.incident_detected': spec(1, 'internal', 'audit'),
  'ai.kill_switch_changed': spec(1, 'internal', 'audit'),
  // Registration. Payloads carry ids and versions, not the checklist or the reason.
  'registration.readiness_viewed': spec(1, 'education_record', 'audit'),
  'registration.readiness_requested': spec(1, 'education_record', 'audit'),
  'registration.readiness_evaluated': spec(1, 'education_record', 'student_record'),
  'registration.readiness_reconciliation_requested': spec(1, 'education_record', 'audit'),
  'registration.override_requested': spec(1, 'education_record', 'audit'),
  'registration.override_granted': spec(1, 'education_record', 'audit'),
  // Support and security
  'support.ticket_created': spec(1, 'student_private', 'operational'),
  'support.access_granted': spec(1, 'student_private', 'audit'),
  'support.access_revoked': spec(1, 'student_private', 'audit'),
  'support.context_read': spec(1, 'student_private', 'audit'),
  'security.alert_opened': spec(1, 'internal', 'audit'),
  'incident.declared': spec(1, 'internal', 'audit'),
  'incident.resolved': spec(1, 'internal', 'audit'),
  // Commercial
  'subscription.activated': spec(1, 'internal', 'commercial'),
  'entitlement.changed': spec(1, 'internal', 'commercial'),
  'invoice.paid': spec(1, 'internal', 'commercial'),
  'payment.failed': spec(1, 'internal', 'commercial'),
  'renewal.started': spec(1, 'internal', 'commercial'),
  // Credential
  'evidence.added': spec(1, 'student_private', 'student_record'),
  'verification.requested': spec(1, 'student_private', 'audit'),
  'verification.approved': spec(1, 'student_private', 'audit'),
  'credential.issued': spec(1, 'student_private', 'audit'),
  'credential.revoked': spec(1, 'student_private', 'audit'),
} as const satisfies Record<string, EventSpec>;

export type EventType = keyof typeof EVENT_TYPES;

export const isEventType = (value: unknown): value is EventType =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(EVENT_TYPES, value);

/** `<domain>.<name>`, lowercase, the same shape the database constraint checks. */
export const EVENT_TYPE_PATTERN = /^[a-z_]+\.[a-z_]+$/;

export interface SemesterEvent<T = Record<string, unknown>> {
  eventId: string;
  eventType: EventType;
  eventVersion: number;
  occurredAt: string;
  producer: string;
  environment: PolicyEnvironment;
  tenantId?: string;
  customerAccountId?: string;
  actor?: { id: string; type: ActorType };
  subject?: { type: string; id: string };
  correlationId: string;
  causationId?: string;
  idempotencyKey?: string;
  dataClassification: ResourceClassification;
  retentionClass: RetentionClass;
  payload: T;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isString = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;

export type EventVerdict =
  | { ok: true; event: SemesterEvent }
  | { ok: false; reason: string };

/**
 * Whether a value is an event a consumer may act on.
 *
 * A consumer's first line, before it reads the payload. The version must be
 * the catalog's current one — a consumer does not guess what an older or a
 * newer producer meant. Unknown *optional* fields in the payload are the
 * producer's business and pass through; unknown *event types* do not.
 */
export function validateEvent(value: unknown): EventVerdict {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, reason: 'not an object' };
  const e = value as Record<string, unknown>;
  if (!isString(e.eventId) || !UUID.test(e.eventId)) return { ok: false, reason: 'eventId is not a UUID' };
  if (!isEventType(e.eventType)) return { ok: false, reason: `unknown event type ${JSON.stringify(e.eventType)}` };
  const expected = EVENT_TYPES[e.eventType].version;
  if (e.eventVersion !== expected) return { ok: false, reason: `${e.eventType} is version ${expected}, not ${String(e.eventVersion)}` };
  if (!isString(e.occurredAt, 40) || !Number.isFinite(Date.parse(e.occurredAt))) return { ok: false, reason: 'occurredAt is not a time' };
  if (!isString(e.producer)) return { ok: false, reason: 'producer missing' };
  if (!(POLICY_ENVIRONMENTS as readonly unknown[]).includes(e.environment)) return { ok: false, reason: 'environment unknown' };
  if (!isString(e.correlationId, 128) || !CORRELATION_ID_PATTERN.test(e.correlationId)) return { ok: false, reason: 'correlationId malformed' };
  if (e.causationId !== undefined && (!isString(e.causationId) || !UUID.test(e.causationId))) return { ok: false, reason: 'causationId is not a UUID' };
  if (e.idempotencyKey !== undefined && !isString(e.idempotencyKey, 300)) return { ok: false, reason: 'idempotencyKey malformed' };
  if (e.tenantId !== undefined && !isString(e.tenantId)) return { ok: false, reason: 'tenantId malformed' };
  if (!(RESOURCE_CLASSIFICATIONS as readonly unknown[]).includes(e.dataClassification)) return { ok: false, reason: 'dataClassification unknown' };
  if (!(RETENTION_CLASSES as readonly unknown[]).includes(e.retentionClass)) return { ok: false, reason: 'retentionClass unknown' };
  if (!e.payload || typeof e.payload !== 'object' || Array.isArray(e.payload)) return { ok: false, reason: 'payload is not an object' };
  if (e.actor !== undefined) {
    const a = e.actor as Record<string, unknown>;
    if (!a || !isString(a.id) || !isString(a.type, 20)) return { ok: false, reason: 'actor malformed' };
  }
  if (e.subject !== undefined) {
    const s = e.subject as Record<string, unknown>;
    if (!s || !isString(s.type) || !isString(s.id)) return { ok: false, reason: 'subject malformed' };
  }
  /*
   * A payload must be held to at least its type's classification. A producer
   * that stamps `grade.posted` as `public` has mislabelled a grade, and the
   * consumer that trusts the label would hand it to an analytics projection.
   */
  const floor = RESOURCE_CLASSIFICATIONS.indexOf(EVENT_TYPES[e.eventType].classification);
  if (RESOURCE_CLASSIFICATIONS.indexOf(e.dataClassification as ResourceClassification) < floor) {
    return { ok: false, reason: `${e.eventType} is at least ${EVENT_TYPES[e.eventType].classification}` };
  }
  return { ok: true, event: e as unknown as SemesterEvent };
}

/**
 * A new event, stamped from the catalog. The producer supplies what only it
 * knows; the version, classification floor and retention come from the
 * catalog so they cannot be stamped wrong.
 */
export function makeEvent<T extends Record<string, unknown>>(
  input: Omit<SemesterEvent<T>, 'eventId' | 'eventVersion' | 'dataClassification' | 'retentionClass' | 'occurredAt'> & {
    eventId: string;
    occurredAt?: string;
    dataClassification?: ResourceClassification;
  },
): SemesterEvent<T> {
  const s = EVENT_TYPES[input.eventType];
  return {
    ...input,
    eventVersion: s.version,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    dataClassification: input.dataClassification ?? s.classification,
    retentionClass: s.retention,
  };
}

// ── The outbox ────────────────────────────────────────────────────────────

export interface OutboxRow {
  id: string;
  event: SemesterEvent;
  publishedAt: string | null;
  publishAttempts: number;
  lastError: string | null;
  deadLetteredAt: string | null;
}

/**
 * What a publisher needs from storage. `pending` returns rows neither
 * published nor dead-lettered, oldest first; the three writes are each one
 * row. Production binds this to Postgres; nothing here knows which.
 */
export interface OutboxStore {
  append(event: SemesterEvent): Promise<void> | void;
  pending(limit: number): Promise<OutboxRow[]> | OutboxRow[];
  markPublished(id: string, at: string): Promise<void> | void;
  markFailed(id: string, error: string, attempts: number): Promise<void> | void;
  markDeadLettered(id: string, at: string, error: string): Promise<void> | void;
}

export interface DrainOptions {
  /** After this many failed attempts a row is dead-lettered rather than retried. */
  maxAttempts?: number;
  batch?: number;
  now?: () => Date;
}

export interface DrainReport {
  published: number;
  failed: number;
  deadLettered: number;
}

/**
 * One pass of the publisher. Each pending row is offered to `publish`; a
 * throw is a failure that is recorded on the row and retried on a later pass
 * until `maxAttempts`, when the row is parked for an operator. The error
 * text kept is the message only, bounded, and never the payload.
 */
export async function drainOutbox(
  store: OutboxStore,
  publish: (event: SemesterEvent) => Promise<void> | void,
  options: DrainOptions = {},
): Promise<DrainReport> {
  const maxAttempts = options.maxAttempts ?? 5;
  const now = options.now ?? (() => new Date());
  const report: DrainReport = { published: 0, failed: 0, deadLettered: 0 };
  for (const row of await store.pending(options.batch ?? 100)) {
    try {
      await publish(row.event);
      await store.markPublished(row.id, now().toISOString());
      report.published += 1;
    } catch (e) {
      const attempts = row.publishAttempts + 1;
      const message = (e instanceof Error ? e.message : String(e)).slice(0, 500);
      if (attempts >= maxAttempts) {
        await store.markDeadLettered(row.id, now().toISOString(), message);
        report.deadLettered += 1;
      } else {
        await store.markFailed(row.id, message, attempts);
        report.failed += 1;
      }
    }
  }
  return report;
}

/** The reference store: the contract, in memory, for tests and for reading. */
export class MemoryOutbox implements OutboxStore {
  readonly rows: OutboxRow[] = [];

  append(event: SemesterEvent): void {
    this.rows.push({ id: event.eventId, event, publishedAt: null, publishAttempts: 0, lastError: null, deadLetteredAt: null });
  }

  pending(limit: number): OutboxRow[] {
    return this.rows.filter((r) => r.publishedAt === null && r.deadLetteredAt === null).slice(0, limit);
  }

  private row(id: string): OutboxRow {
    const row = this.rows.find((r) => r.id === id);
    if (!row) throw new Error(`no outbox row ${id}`);
    return row;
  }

  markPublished(id: string, at: string): void {
    this.row(id).publishedAt = at;
  }

  markFailed(id: string, error: string, attempts: number): void {
    const row = this.row(id);
    row.lastError = error;
    row.publishAttempts = attempts;
  }

  markDeadLettered(id: string, at: string, error: string): void {
    const row = this.row(id);
    row.deadLetteredAt = at;
    row.lastError = error;
    row.publishAttempts += 1;
  }
}

// ── The consumer ──────────────────────────────────────────────────────────

export type ReceiptOutcome = 'processed' | 'skipped' | 'failed';

/** Where a consumer records that it has seen an event, keyed by (consumer, event). */
export interface ReceiptLedger {
  seen(consumer: string, eventId: string): Promise<ReceiptOutcome | null> | ReceiptOutcome | null;
  record(consumer: string, eventId: string, outcome: ReceiptOutcome, error?: string): Promise<void> | void;
}

export type ProcessReport =
  | { outcome: 'processed' }
  | { outcome: 'duplicate'; earlier: ReceiptOutcome }
  | { outcome: 'refused'; reason: string }
  | { outcome: 'failed'; error: string };

/**
 * Handle an event exactly once per consumer.
 *
 * The rules a consumer is held to, in order: refuse what does not validate;
 * refuse a tenant that is not its own; skip what it has processed before;
 * run the handler; record the outcome. A handler that throws is recorded as
 * failed and *will be offered the event again* — so a handler's external
 * writes must be idempotent in their own right, keyed on the event's
 * idempotency key, or must not be made from a consumer at all.
 */
export async function processOnce(
  ledger: ReceiptLedger,
  consumer: string,
  value: unknown,
  handler: (event: SemesterEvent) => Promise<void> | void,
  expectedTenant?: string,
): Promise<ProcessReport> {
  const verdict = validateEvent(value);
  if (!verdict.ok) return { outcome: 'refused', reason: verdict.reason };
  const event = verdict.event;
  if (expectedTenant !== undefined && event.tenantId !== expectedTenant) {
    return { outcome: 'refused', reason: 'event is for another tenant' };
  }
  const earlier = await ledger.seen(consumer, event.eventId);
  if (earlier === 'processed' || earlier === 'skipped') return { outcome: 'duplicate', earlier };
  try {
    await handler(event);
  } catch (e) {
    const error = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    await ledger.record(consumer, event.eventId, 'failed', error);
    return { outcome: 'failed', error };
  }
  await ledger.record(consumer, event.eventId, 'processed');
  return { outcome: 'processed' };
}

export class MemoryReceiptLedger implements ReceiptLedger {
  readonly receipts = new Map<string, { outcome: ReceiptOutcome; error?: string }>();

  seen(consumer: string, eventId: string): ReceiptOutcome | null {
    return this.receipts.get(`${consumer}\u0000${eventId}`)?.outcome ?? null;
  }

  record(consumer: string, eventId: string, outcome: ReceiptOutcome, error?: string): void {
    this.receipts.set(`${consumer}\u0000${eventId}`, error === undefined ? { outcome } : { outcome, error });
  }
}
