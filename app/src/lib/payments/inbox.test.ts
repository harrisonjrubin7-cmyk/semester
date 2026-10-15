/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MAX_ATTEMPTS, MOVES, backoffSeconds, canMove, drain, project, rebuild, record, replay,
  type ApplyOutcome, type InboxStatus,
} from '../../../../supabase/functions/_shared/payments/inbox';
import { memoryInbox } from '../../../../supabase/functions/_shared/payments/inboxmemory';
import type { NormalizedPaymentEvent } from '../../../../supabase/functions/_shared/payments/types';

const ROOT = join(__dirname, '../../../..');
const MIGRATION = readFileSync(join(ROOT, 'supabase/migrations/20261006090000_payment_rails_and_event_inbox.sql'), 'utf8');
const SRC = readFileSync(join(ROOT, 'supabase/functions/_shared/payments/inbox.ts'), 'utf8');

const T0 = '2026-10-06T12:00:00.000Z';
const later = (s: number) => new Date(Date.parse(T0) + s * 1000).toISOString();

const invoice = (id: string, at = T0): NormalizedPaymentEvent => ({
  provider: 'stripe', eventId: id, occurredAt: at, payloadSha256: 'a'.repeat(64), type: 'payment.captured', amountCents: 1200,
  invoice: { subscriptionRef: 'sub_abc', invoiceRef: 'in_abc', status: 'paid', amountCents: 1200, subtotalCents: 1200, taxCents: 0, currency: 'usd', issuedAt: at, dueAt: null, rank: 2 },
});

describe('the inbox policy and the table trigger say the same thing', () => {
  it('has the same status moves as the SQL guard', () => {
    const sql = MIGRATION.slice(MIGRATION.indexOf('create or replace function private.provider_event_inbox_guard'));
    const found: Record<string, string[]> = {};
    for (const m of sql.matchAll(/old\.status = '(\w+)'\s+and new\.status (?:in \(([^)]*)\)|= '(\w+)')/g)) {
      found[m[1]] = (m[2] ?? `'${m[3]}'`).split(',').map((s) => s.trim().replace(/'/g, ''));
    }
    const mine = Object.fromEntries(Object.entries(MOVES).filter(([, to]) => to.length).map(([from, to]) => [from, [...to]]));
    expect(found).toEqual(mine);
  });

  it('treats applied as final and lets nothing leave dead_letter but a replay', () => {
    for (const to of ['received', 'parked', 'failed', 'dead_letter', 'applied'] as InboxStatus[]) expect(canMove('applied', to)).toBe(false);
    expect(canMove('dead_letter', 'received')).toBe(true);
    expect(canMove('dead_letter', 'applied')).toBe(false);
    expect(canMove('received', 'dead_letter')).toBe(false);
    expect(canMove('failed', 'parked')).toBe(false);
  });

  it('keeps the table’s error-code shape, and stores no message', () => {
    expect(MIGRATION).toMatch(/last_error_code ~ '\^\[a-z\]\[a-z_\]\{0,39\}\$'/);
    expect(SRC).not.toMatch(/\.message|String\(err|console\./);
    expect(SRC).not.toMatch(/\bDeno\b|process\.env/);
  });
});

describe('what is written down', () => {
  it('keeps the identity columns out of the projection and rebuilds the event exactly', () => {
    const e = invoice('evt_1');
    const p = project(e)!;
    expect(Object.keys(p).sort()).toEqual(['amountCents', 'invoice']);
    expect(rebuild({ id: 'x', provider: e.provider, eventId: e.eventId, eventType: e.type, occurredAt: e.occurredAt, payloadSha256: e.payloadSha256, projection: p, status: 'received', attempts: 0, nextAttemptAt: null, lastErrorCode: null, appliedAt: null })).toEqual(e);
  });

  it('records once, and a second delivery is a duplicate', async () => {
    const s = memoryInbox();
    expect(await record(s, invoice('evt_1'))).toBe('recorded');
    expect(await record(s, invoice('evt_1'))).toBe('duplicate');
    expect(s.rows.size).toBe(1);
  });

  it('declines, rather than stores, an event the table would refuse', async () => {
    const s = memoryInbox();
    const base = invoice('evt_2') as Extract<NormalizedPaymentEvent, { type: 'payment.captured' }>;
    const cardLike: NormalizedPaymentEvent = { ...base, invoice: { ...base.invoice!, invoiceRef: 'in_4242424242424242' } };
    expect(project(cardLike)).toBeNull();
    expect(await record(s, cardLike)).toBe('unrecordable');
    expect(s.rows.size).toBe(0);
    // control: the same event without the digit run is recordable, so the refusal above is the digits.
    expect(await record(s, invoice('evt_2'))).toBe('recorded');
  });
});

describe('the life of an event', () => {
  const ready = (): ApplyOutcome => 'applied';
  const early = (): ApplyOutcome => 'not_ready';

  it('applies a recorded event and finishes it', async () => {
    const s = memoryInbox();
    await record(s, invoice('evt_1'));
    expect(await drain(s, async () => ready(), T0)).toMatchObject({ tried: 1, applied: 1 });
    const row = [...s.rows.values()][0];
    expect(row).toMatchObject({ status: 'applied', attempts: 1, appliedAt: T0, nextAttemptAt: null });
    expect(await drain(s, async () => ready(), later(9999))).toMatchObject({ tried: 0 });
  });

  it('parks an invoice that is early, waits out the backoff, then applies it once its subscription is there', async () => {
    const s = memoryInbox();
    await record(s, invoice('evt_1'));
    expect(await drain(s, async () => early(), T0)).toMatchObject({ parked: 1 });
    const row = () => [...s.rows.values()][0];
    expect(row()).toMatchObject({ status: 'parked', attempts: 1, lastErrorCode: 'not_ready', nextAttemptAt: later(backoffSeconds(1)) });
    expect(await drain(s, async () => ready(), later(backoffSeconds(1) - 1))).toMatchObject({ tried: 0 });
    expect(await drain(s, async () => ready(), later(backoffSeconds(1)))).toMatchObject({ applied: 1 });
    expect(row()).toMatchObject({ status: 'applied', attempts: 2, lastErrorCode: null });
  });

  it('marks a throw failed with a code, never a message, and one bad row does not stop the next', async () => {
    const s = memoryInbox();
    await record(s, invoice('evt_1', T0));
    await record(s, invoice('evt_2', later(1)));
    const r = await drain(s, async (e) => { if (e.eventId === 'evt_1') throw new Error('secret detail 4242'); return 'applied'; }, T0);
    expect(r).toMatchObject({ tried: 2, failed: 1, applied: 1 });
    const failed = [...s.rows.values()].find((x) => x.status === 'failed')!;
    expect(failed.lastErrorCode).toBe('apply_error');
    expect(JSON.stringify(failed)).not.toContain('secret');
  });

  it('keeps a failed event failed when its next miss is an early one, because the table has no failed-to-parked step', async () => {
    const s = memoryInbox();
    await record(s, invoice('evt_1'));
    await drain(s, async () => { throw new Error('x'); }, T0);
    await drain(s, async () => early(), later(backoffSeconds(1)));
    expect([...s.rows.values()][0]).toMatchObject({ status: 'failed', attempts: 2, lastErrorCode: 'not_ready' });
  });

  it(`dead-letters after ${MAX_ATTEMPTS} tries, and a replay puts it back to be tried again`, async () => {
    const s = memoryInbox();
    await record(s, invoice('evt_1'));
    let t = 0;
    for (let i = 0; i < MAX_ATTEMPTS; i++) { await drain(s, async () => early(), later(t)); t += 7 * 3600; }
    const row = [...s.rows.values()][0];
    expect(row).toMatchObject({ status: 'dead_letter', attempts: MAX_ATTEMPTS, nextAttemptAt: null });
    expect(await drain(s, async () => ready(), later(t + 1e6))).toMatchObject({ tried: 0 });

    expect(await replay(s, row.id)).toBe('requeued');
    expect(await replay(s, row.id)).toBe('not_dead_letter');
    expect(await replay(s, 'nope')).toBe('unknown');
    await drain(s, async () => early(), later(t));
    expect([...s.rows.values()][0].status).toBe('parked');
    expect(await drain(s, async () => ready(), later(t + 7 * 3600))).toMatchObject({ applied: 1 });
    expect([...s.rows.values()][0]).toMatchObject({ status: 'applied', attempts: MAX_ATTEMPTS + 2 });
  });

  it('never dead-letters an event on its first miss, however many tries a replay carried over', async () => {
    const s = memoryInbox();
    await record(s, invoice('evt_1'));
    const id = [...s.rows.keys()][0];
    s.rows.set(id, { ...s.rows.get(id)!, status: 'received', attempts: MAX_ATTEMPTS + 5 });
    await drain(s, async () => early(), T0);
    expect(s.rows.get(id)!.status).toBe('parked');
  });

  it('backs off by doubling, to a ceiling', () => {
    expect([1, 2, 3, 4].map(backoffSeconds)).toEqual([60, 120, 240, 480]);
    expect(backoffSeconds(40)).toBe(6 * 3600);
  });
});

describe('the in-memory store is a faithful stand-in (controls)', () => {
  it('refuses the moves the trigger refuses', async () => {
    const s = memoryInbox();
    await record(s, invoice('evt_1'));
    const id = [...s.rows.keys()][0];
    await expect(s.update(id, { status: 'dead_letter' })).rejects.toThrow();
    await s.update(id, { status: 'applied', appliedAt: T0 });
    await expect(s.update(id, { status: 'received', appliedAt: null })).rejects.toThrow();
    await expect(s.update(id, { attempts: -1 })).rejects.toThrow();
  });

  it('refuses a parked row with no retry time and an applied row with no time', async () => {
    const s = memoryInbox();
    await record(s, invoice('evt_1'));
    const id = [...s.rows.keys()][0];
    await expect(s.update(id, { status: 'parked', nextAttemptAt: null })).rejects.toThrow();
    await expect(s.update(id, { status: 'applied' })).rejects.toThrow();
  });
});
