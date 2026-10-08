import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EVENT_TYPES,
  EVENT_TYPE_PATTERN,
  MemoryOutbox,
  MemoryReceiptLedger,
  RETENTION_CLASSES,
  drainOutbox,
  makeEvent,
  processOnce,
  validateEvent,
  type SemesterEvent,
} from './events.ts';
import { POLICY_ACTIONS, RESOURCE_CLASSIFICATIONS } from './policy.ts';

const migration = readFileSync(
  new URL('../../../supabase/migrations/20260928320000_audit_correlation_and_outbox.sql', import.meta.url),
  'utf8',
);

const good = (): SemesterEvent => makeEvent({
  eventId: '7f2a1c3e-5b6d-4e8f-9a0b-1c2d3e4f5a6b',
  eventType: 'grade.posted',
  occurredAt: '2026-09-28T12:00:00.000Z',
  producer: 'gradebook',
  environment: 'production',
  tenantId: 'school-a',
  actor: { id: 'faculty-1', type: 'user' },
  subject: { type: 'grade_line_item', id: 'li-4' },
  correlationId: 'req-0123456789abcdef',
  idempotencyKey: 'li-4:v3',
  payload: { lineItemId: 'li-4', version: 3 },
});

describe('the catalog', () => {
  it('names every type as domain.name, and every classification and retention class is a known one', () => {
    for (const [type, s] of Object.entries(EVENT_TYPES)) {
      expect(type).toMatch(EVENT_TYPE_PATTERN);
      expect(RESOURCE_CLASSIFICATIONS).toContain(s.classification);
      expect(RETENTION_CLASSES).toContain(s.retention);
      expect(s.version).toBeGreaterThan(0);
    }
  });

  it('carries the audit event every policy action promises', () => {
    for (const action of Object.values(POLICY_ACTIONS)) expect(EVENT_TYPES).toHaveProperty(action.auditEvent);
  });

  it('holds the same classification list and type shape as the outbox constraint', () => {
    const list = migration.match(/data_classification in \(([^)]+)\)/)?.[1] ?? '';
    expect([...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])).toEqual([...RESOURCE_CLASSIFICATIONS]);
    const pattern = migration.match(/event_type ~ '([^']+)'/)?.[1];
    expect(pattern).toBe(EVENT_TYPE_PATTERN.source);
  });
});

describe('validateEvent', () => {
  it('accepts the control and stamps it from the catalog', () => {
    const e = good();
    expect(validateEvent(e)).toEqual({ ok: true, event: e });
    expect(e.eventVersion).toBe(EVENT_TYPES['grade.posted'].version);
    expect(e.dataClassification).toBe('education_record');
    expect(e.retentionClass).toBe('student_record');
  });

  const refuse = (mutate: (e: Record<string, unknown>) => void, reason: RegExp) => {
    const e = good() as unknown as Record<string, unknown>;
    mutate(e);
    const verdict = validateEvent(e);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toMatch(reason);
  };

  it('refuses an unknown type, a wrong version, and a payload labelled below its type', () => {
    refuse((e) => { e.eventType = 'grade.deleted'; }, /unknown event type/);
    refuse((e) => { e.eventVersion = 2; }, /version 1, not 2/);
    refuse((e) => { e.eventVersion = '1'; }, /version 1/);
    refuse((e) => { e.dataClassification = 'public'; }, /at least education_record/);
  });

  it('refuses what cannot be traced or placed', () => {
    refuse((e) => { e.eventId = 'not-a-uuid'; }, /eventId/);
    refuse((e) => { e.correlationId = 'x'; }, /correlationId/);
    refuse((e) => { e.causationId = 'nope'; }, /causationId/);
    refuse((e) => { e.environment = 'local'; }, /environment/);
    refuse((e) => { e.occurredAt = 'noon'; }, /occurredAt/);
    refuse((e) => { e.tenantId = ''; }, /tenantId/);
    refuse((e) => { e.retentionClass = 'forever'; }, /retentionClass/);
    refuse((e) => { e.payload = []; }, /payload/);
    refuse((e) => { e.actor = { id: '' }; }, /actor/);
    refuse((e) => { e.subject = { type: 'x' }; }, /subject/);
    expect(validateEvent(null).ok).toBe(false);
    expect(validateEvent([good()]).ok).toBe(false);
  });

  it('lets a producer raise a classification, not lower it, and passes unknown payload fields through', () => {
    const e = makeEvent({ ...good(), eventType: 'course.published', dataClassification: 'student_private', payload: { courseId: 'c', future_field: true } });
    const verdict = validateEvent(e);
    expect(verdict.ok).toBe(true);
    if (verdict.ok) expect(verdict.event.payload).toEqual({ courseId: 'c', future_field: true });
  });
});

describe('drainOutbox', () => {
  const at = (n: number) => () => new Date(Date.UTC(2026, 8, 28, 12, n));

  it('publishes what it can, keeps what it cannot with the error and the count, and parks a repeat offender', async () => {
    const outbox = new MemoryOutbox();
    const ok = good();
    const bad = { ...good(), eventId: '8f2a1c3e-5b6d-4e8f-9a0b-1c2d3e4f5a6b', eventType: 'grade.posted' as const };
    outbox.append(ok);
    outbox.append(bad);
    const sent: string[] = [];
    const publish = async (e: SemesterEvent) => {
      if (e.eventId === bad.eventId) throw new Error('bus refused: ' + JSON.stringify(e.payload));
      sent.push(e.eventId);
    };

    expect(await drainOutbox(outbox, publish, { maxAttempts: 3, now: at(0) })).toEqual({ published: 1, failed: 1, deadLettered: 0 });
    expect(sent).toEqual([ok.eventId]);
    expect(outbox.rows[0].publishedAt).toBe('2026-09-28T12:00:00.000Z');
    expect(outbox.rows[1]).toMatchObject({ publishedAt: null, publishAttempts: 1, deadLetteredAt: null });
    expect(outbox.rows[1].lastError).toMatch(/bus refused/);

    // The published row is not offered again; the failed one is.
    expect(await drainOutbox(outbox, publish, { maxAttempts: 3, now: at(1) })).toEqual({ published: 0, failed: 1, deadLettered: 0 });
    expect(sent).toEqual([ok.eventId]);
    expect(await drainOutbox(outbox, publish, { maxAttempts: 3, now: at(2) })).toEqual({ published: 0, failed: 0, deadLettered: 1 });
    expect(outbox.rows[1]).toMatchObject({ publishAttempts: 3, deadLetteredAt: '2026-09-28T12:02:00.000Z' });

    // Parked means parked: a fourth pass does not touch it, even if the bus recovered.
    expect(await drainOutbox(outbox, async (e) => { sent.push(e.eventId); }, { now: at(3) })).toEqual({ published: 0, failed: 0, deadLettered: 0 });
    expect(sent).toEqual([ok.eventId]);
  });

  it('bounds the error it keeps and does not keep the payload by accident', async () => {
    const outbox = new MemoryOutbox();
    outbox.append(good());
    await drainOutbox(outbox, () => { throw new Error('x'.repeat(2000)); });
    expect(outbox.rows[0].lastError?.length).toBe(500);
  });
});

describe('processOnce', () => {
  it('runs a handler once per consumer, and reports the second delivery as a duplicate', async () => {
    const ledger = new MemoryReceiptLedger();
    const e = good();
    let runs = 0;
    const handler = () => { runs += 1; };
    expect(await processOnce(ledger, 'notifications', e, handler, 'school-a')).toEqual({ outcome: 'processed' });
    expect(await processOnce(ledger, 'notifications', e, handler, 'school-a')).toEqual({ outcome: 'duplicate', earlier: 'processed' });
    expect(runs).toBe(1);
    // A different consumer is a different receipt.
    expect(await processOnce(ledger, 'analytics', e, handler, 'school-a')).toEqual({ outcome: 'processed' });
    expect(runs).toBe(2);
  });

  it('refuses another tenant\'s event and an event that does not validate, without running the handler', async () => {
    const ledger = new MemoryReceiptLedger();
    let runs = 0;
    const handler = () => { runs += 1; };
    expect(await processOnce(ledger, 'c', good(), handler, 'school-b')).toEqual({ outcome: 'refused', reason: 'event is for another tenant' });
    expect((await processOnce(ledger, 'c', { ...good(), eventVersion: 9 }, handler)).outcome).toBe('refused');
    expect(runs).toBe(0);
    expect(ledger.receipts.size).toBe(0);
  });

  it('records a failure and offers the event again, so the handler must be idempotent in its own right', async () => {
    const ledger = new MemoryReceiptLedger();
    const e = good();
    let attempt = 0;
    const handler = () => { attempt += 1; if (attempt === 1) throw new Error('downstream 503'); };
    expect(await processOnce(ledger, 'passback', e, handler)).toEqual({ outcome: 'failed', error: 'downstream 503' });
    expect(ledger.seen('passback', e.eventId)).toBe('failed');
    expect(await processOnce(ledger, 'passback', e, handler)).toEqual({ outcome: 'processed' });
    expect(attempt).toBe(2);
  });
});
