/// <reference types="node" />
import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_WEBHOOK_BYTES, handleBillingWebhook, type WebhookDeps } from '../../../../supabase/functions/_shared/billingwebhook';
import { assertMachineAsync, asyncCommand, int, oneOf, record, runMachineAsync } from './property';

/**
 * The billing webhook, through every order of deliveries, retries and failures.
 *
 * `billing/webhook.test.ts` checks the handler on the cases somebody wrote
 * down. The rules a payment system actually depends on are about sequences: an
 * event is applied once however many times it is delivered, a failure half-way
 * is retried and not dismissed as a duplicate, an invoice that arrives before
 * its subscription is asked for again, and a request that should be refused
 * touches nothing. The fake below is the database in miniature: an
 * idempotency key that is atomic, a subscription table, and failures that can
 * be injected into any step before it writes. A machine then sends sequences
 * of good deliveries, failing deliveries, retries and refused requests at the
 * real handler and checks the books after every step.
 *
 * Nothing here is a statement about Stripe, or about the SQL that sits behind
 * `applyEvent`; it is a statement about what the handler does with whatever
 * the database answers.
 */

const SECRET = 'whsec_model_test';
const NOW = 1_790_000_000;
const CHECKOUT = '3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d';

const sign = (body: string, t = NOW, secret = SECRET) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
const body = (id: string, type: string, object: Record<string, unknown>) => JSON.stringify({ id, type, livemode: false, created: NOW - 5, data: { object } });

/** The events in play. Index 0 creates the subscription every invoice bills. */
const EVENTS = [
  { id: 'evt_c', type: 'checkout.session.completed', needsSubscription: false, body: body('evt_c', 'checkout.session.completed', { mode: 'subscription', client_reference_id: CHECKOUT, subscription: 'sub_A', customer: 'cus_A' }) },
  { id: 'evt_i1', type: 'invoice.paid', needsSubscription: true, body: body('evt_i1', 'invoice.paid', { id: 'in_1', subscription: 'sub_A', amount_paid: 799, amount_due: 799, currency: 'usd', created: NOW - 60 }) },
  { id: 'evt_i2', type: 'invoice.paid', needsSubscription: true, body: body('evt_i2', 'invoice.paid', { id: 'in_2', subscription: 'sub_A', amount_paid: 799, amount_due: 799, currency: 'usd', created: NOW - 30 }) },
  { id: 'evt_r', type: 'charge.refunded', needsSubscription: false, body: body('evt_r', 'charge.refunded', { amount_refunded: 799 }) },
  { id: 'evt_s', type: 'customer.subscription.updated', needsSubscription: false, body: body('evt_s', 'customer.subscription.updated', { id: 'sub_A', status: 'active', cancel_at_period_end: false }) },
  { id: 'evt_f', type: 'invoice.payment_failed', needsSubscription: true, body: body('evt_f', 'invoice.payment_failed', { id: 'in_3', subscription: 'sub_A', amount_due: 799, currency: 'usd', created: NOW - 10 }) },
] as const;

type FailAt = 'none' | 'complete' | 'sync' | 'upsert' | 'apply';
const REFUSALS = ['bad signature', 'stale', 'unsigned', 'from a browser', 'too large', 'not json', 'not an event', 'a GET', 'no secret'] as const;
type Refusal = (typeof REFUSALS)[number];
/** The exact answer each refusal must get: a wrong reason for a refusal is a missing check. */
const EXPECTED: Record<Refusal, number> = {
  'bad signature': 400, stale: 400, unsigned: 400, 'from a browser': 403, 'too large': 413, 'not json': 400, 'not an event': 400, 'a GET': 405, 'no secret': 503,
};

/** The database, in miniature. */
function backend() {
  const db = { subs: new Set<string>(), applied: new Map<string, number>(), recorded: new Map<string, number>() };
  const calls: string[] = [];
  let failAt: FailAt = 'none';
  const maybeFail = (step: Exclude<FailAt, 'none'>) => { if (failAt === step) throw new Error(`injected failure in ${step}`); };
  const deps: WebhookDeps = {
    stripeKey: 'sk_test_abc',
    secret: SECRET,
    now: () => NOW,
    completeCheckout: async (_c, sub) => { calls.push('complete'); maybeFail('complete'); if (sub) db.subs.add(sub); return 'ok'; },
    syncSubscription: async () => { calls.push('sync'); maybeFail('sync'); return 'ok'; },
    applyInvoiceEvent: async (eventId, _kind, sub) => {
      calls.push('invoice');
      maybeFail('upsert');
      if (!db.subs.has(sub)) return 'not_ready';
      calls.push('apply');
      maybeFail('apply');
      // The production RPC serializes the invoice snapshot and this key in
      // one transaction; this fake models the same all-or-nothing boundary.
      if (db.applied.has(eventId)) return 'duplicate';
      db.applied.set(eventId, 1);
      db.recorded.set(eventId, (db.recorded.get(eventId) ?? 0) + 1);
      return 'recorded';
    },
    applyEvent: async (eventId) => {
      calls.push('apply');
      maybeFail('apply');
      // The idempotency key, atomic: the first caller records, every later one is told it is a duplicate.
      if (db.applied.has(eventId)) return 'duplicate';
      db.applied.set(eventId, 1);
      db.recorded.set(eventId, (db.recorded.get(eventId) ?? 0) + 1);
      return 'recorded';
    },
  };
  return { db, deps, calls, fail: (f: FailAt) => { failAt = f; } };
}

function request(refusal: Refusal | null, e: (typeof EVENTS)[number]): { req: Request; secret: string | undefined } {
  const url = 'https://project.supabase.co/functions/v1/billing-webhook';
  const good = { 'Content-Type': 'application/json', 'Stripe-Signature': sign(e.body) };
  switch (refusal) {
    case 'bad signature': return { req: new Request(url, { method: 'POST', headers: { ...good, 'Stripe-Signature': sign(e.body, NOW, 'whsec_wrong') }, body: e.body }), secret: SECRET };
    case 'stale': return { req: new Request(url, { method: 'POST', headers: { ...good, 'Stripe-Signature': sign(e.body, NOW - 301) }, body: e.body }), secret: SECRET };
    case 'unsigned': return { req: new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: e.body }), secret: SECRET };
    case 'from a browser': return { req: new Request(url, { method: 'POST', headers: { ...good, Origin: 'https://semester.example' }, body: e.body }), secret: SECRET };
    case 'too large': return { req: new Request(url, { method: 'POST', headers: { ...good, 'Content-Length': String(MAX_WEBHOOK_BYTES + 1) }, body: e.body }), secret: SECRET };
    case 'not json': { const b = 'this is not json'; return { req: new Request(url, { method: 'POST', headers: { ...good, 'Stripe-Signature': sign(b) }, body: b }), secret: SECRET }; }
    case 'not an event': { const b = JSON.stringify({ hello: 'world' }); return { req: new Request(url, { method: 'POST', headers: { ...good, 'Stripe-Signature': sign(b) }, body: b }), secret: SECRET }; }
    case 'a GET': return { req: new Request(url, { method: 'GET', headers: good }), secret: SECRET };
    case 'no secret': return { req: new Request(url, { method: 'POST', headers: good, body: e.body }), secret: undefined };
    default: return { req: new Request(url, { method: 'POST', headers: good, body: e.body }), secret: SECRET };
  }
}

interface Model {
  /** Every log line's arguments, flattened, for the one rule about what is never written. */
  logged: string[];
  /** How many times each event has been answered `recorded`. */
  recorded: Map<string, number>;
  deliveries: number;
}

const FORBIDDEN_IN_LOGS = ['evt_', 'sub_', 'cus_', 'in_', 'whsec', 'client_reference_id', CHECKOUT];

afterEach(() => vi.restoreAllMocks());

const eventIndex = int(0, EVENTS.length - 1);
const failure = oneOf<FailAt>(['none', 'none', 'none', 'complete', 'sync', 'upsert', 'apply']);

function machine() {
  return {
    init: () => ({ model: { logged: [], recorded: new Map(), deliveries: 0 } as Model, sut: backend() }),
    commands: [
      asyncCommand<Model, ReturnType<typeof backend>, { e: number; fail: FailAt }>({
        name: 'deliver',
        args: record({ e: eventIndex, fail: failure }),
        step: async (m, b, a) => {
          const ev = EVENTS[a.e]!;
          const before = { calls: b.calls.length, recorded: new Map(b.db.recorded), applied: new Map(b.db.applied) };
          b.fail(a.fail);
          const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { m.logged.push(args.map(String).join(' ')); });
          const res = await handleBillingWebhook(request(null, ev).req, b.deps);
          spy.mockRestore();
          b.fail('none');
          m.deliveries++;
          const mine = b.calls.slice(before.calls);
          const applies = mine.filter((c) => c === 'apply').length;
          if (applies > 1) throw new Error(`${ev.id}: applyEvent was called ${applies} times in one delivery`);
          if (res.status === 200) {
            if (applies !== 1 || mine[mine.length - 1] !== 'apply') throw new Error(`${ev.id}: answered 200 without recording the event last (${mine.join(',')})`);
            if (ev.needsSubscription && !b.db.subs.has('sub_A')) throw new Error(`${ev.id}: answered 200 for an invoice whose subscription is not stored`);
          } else if (res.status === 500) {
            // A failed delivery must leave the event unrecorded, so the provider's retry does the work.
            for (const [id, n] of b.db.applied) if ((before.applied.get(id) ?? 0) !== n) throw new Error(`${ev.id}: answered 500 but ${id} was recorded`);
          } else {
            throw new Error(`${ev.id}: a signed, well-formed event was answered ${res.status}`);
          }
          for (const [id, n] of b.db.recorded) m.recorded.set(id, n);
        },
      }),
      asyncCommand<Model, ReturnType<typeof backend>, { e: number }>({
        name: 'retry until accepted',
        args: record({ e: eventIndex }),
        step: async (m, b, a) => {
          const ev = EVENTS[a.e]!;
          for (let i = 0; i < 3; i++) {
            const res = await handleBillingWebhook(request(null, ev).req, b.deps);
            if (res.status === 200) break;
          }
          for (const [id, n] of b.db.recorded) m.recorded.set(id, n);
        },
      }),
      asyncCommand<Model, ReturnType<typeof backend>, { e: number; why: Refusal }>({
        name: 'refused request',
        args: record({ e: eventIndex, why: oneOf(REFUSALS) }),
        step: async (_m, b, a) => {
          const before = b.calls.length;
          const snapshot = JSON.stringify([...b.db.applied]) + JSON.stringify([...b.db.subs]);
          const { req, secret } = request(a.why, EVENTS[a.e]!);
          const res = await handleBillingWebhook(req, { ...b.deps, secret });
          if (res.status !== EXPECTED[a.why]) throw new Error(`"${a.why}" was answered ${res.status}, expected ${EXPECTED[a.why]}`);
          if (b.calls.length !== before) throw new Error(`"${a.why}" reached the database: ${b.calls.slice(before).join(',')}`);
          if (JSON.stringify([...b.db.applied]) + JSON.stringify([...b.db.subs]) !== snapshot) throw new Error(`"${a.why}" changed the books`);
          if (res.headers.get('Access-Control-Allow-Origin') !== null) throw new Error(`"${a.why}" carried a CORS header`);
        },
      }),
    ],
    invariant: (m: Model, b: ReturnType<typeof backend>) => {
      for (const [id, n] of m.recorded) if (n > 1) throw new Error(`${id} was applied ${n} times`);
      for (const [id, n] of b.db.applied) if (n > 1) throw new Error(`${id} is recorded ${n} times`);
      for (const line of m.logged) for (const bad of FORBIDDEN_IN_LOGS) if (line.includes(bad)) throw new Error(`a log line carried "${bad}": ${line}`);
    },
  };
}

describe('the billing webhook, through every order of events', () => {
  it('applies each event at most once, leaves a failed one for its retry, refuses the refusable without a trace, and logs nothing about the payload', async () => {
    await assertMachineAsync('billing webhook', machine(), { runs: 250, maxCommands: 16 });
  });

  it('eventually applies every deliverable event exactly once when the provider keeps retrying', async () => {
    const out = await runMachineAsync({
      ...machine(),
      commands: [
        // Deliveries in any order, each retried until accepted, with the subscription's own event among them.
        machine().commands[1]!,
      ],
      invariant: (m, b) => {
        for (const [id, n] of b.db.applied) if (n !== 1) throw new Error(`${id} recorded ${n} times`);
        for (const [id] of m.recorded) if (!b.db.applied.has(id)) throw new Error(`${id} answered recorded and is not in the books`);
      },
    }, { runs: 150, maxCommands: 14 });
    expect(out.ok, JSON.stringify(out.ok ? '' : out)).toBe(true);
  });

  it('asks for a retry when an invoice comes before its subscription, and applies it once the subscription is there', async () => {
    const b = backend();
    const invoice = EVENTS[1];
    const first = await handleBillingWebhook(request(null, invoice).req, b.deps);
    expect(first.status).toBe(500);
    expect(b.db.applied.size).toBe(0);
    expect((await handleBillingWebhook(request(null, EVENTS[0]).req, b.deps)).status).toBe(200);
    const again = await handleBillingWebhook(request(null, invoice).req, b.deps);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ received: true, outcome: 'recorded' });
    const third = await handleBillingWebhook(request(null, invoice).req, b.deps);
    expect(await third.json()).toEqual({ received: true, outcome: 'duplicate' });
    expect(b.db.recorded.get('evt_i1')).toBe(1);
  });

  it('reaches every answer it is asked about, so the machine is not idle', async () => {
    const seen = { ok: 0, retry: 0, duplicate: 0, refused: 0, failedAtApply: 0 };
    const m = machine();
    const probe = {
      ...m,
      invariant: (mo: Model, b: ReturnType<typeof backend>) => {
        m.invariant(mo, b);
        if (mo.deliveries > 0) seen.ok++;
        if ([...b.db.recorded.values()].length > 0) seen.duplicate += b.calls.filter((c) => c === 'apply').length > b.db.applied.size ? 1 : 0;
        if (b.calls.filter((c) => c === 'invoice').length > b.db.applied.size) seen.retry++;
        if (mo.logged.length > 0) seen.failedAtApply++;
        seen.refused++;
      },
    };
    await runMachineAsync(probe, { runs: 120, maxCommands: 14 });
    expect(seen.ok, 'no delivery was ever made').toBeGreaterThan(0);
    expect(seen.duplicate, 'no event was ever delivered twice').toBeGreaterThan(0);
    expect(seen.retry, 'no invoice was ever asked to retry').toBeGreaterThan(0);
    expect(seen.failedAtApply, 'no failure was ever logged, so the log rule was never exercised').toBeGreaterThan(0);
  });
});
