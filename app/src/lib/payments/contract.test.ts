/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { hmacSha256Hex } from '../../../../supabase/functions/_shared/stripe';
import { createMockAdapter, MOCK_SIGNATURE_HEADER, signMockBody } from '../../../../supabase/functions/_shared/payments/mock';
import { createStripeAdapter } from '../../../../supabase/functions/_shared/payments/stripeadapter';
import { fail, ok, type PaymentProviderAdapter, type VerifiedProviderEvent, type WebhookRequest } from '../../../../supabase/functions/_shared/payments/types';
import { runContract, type AdapterHarness, type ClauseId } from './contract';

const NOW = 1790000000;

// ---------------------------------------------------------------- harnesses --

function stripeHarness(make?: (a: PaymentProviderAdapter) => PaymentProviderAdapter): AdapterHarness {
  const SECRET = 'whsec_contract';
  const signed = async (body: string, t = NOW, secret = SECRET): Promise<WebhookRequest> => ({
    rawBody: body,
    headers: new Headers({ 'Stripe-Signature': `t=${t},v1=${await hmacSha256Hex(secret, `${t}.${body}`)}` }),
    nowSeconds: NOW,
  });
  const event = (type: string, object: Record<string, unknown>, livemode = false) =>
    JSON.stringify({ id: 'evt_c1', type, livemode, created: NOW - 5, data: { object } });
  const invoice = { id: 'in_1', subscription: 'sub_1', amount_paid: 799, currency: 'usd', created: NOW - 60 };
  return {
    name: 'stripe',
    make: () => {
      const a = createStripeAdapter({ apiKey: 'sk_test_contract', webhookSecret: SECRET });
      if (!a) throw new Error('test key must be a stripe key');
      return make ? make(a) : a;
    },
    webhook: {
      valid: () => signed(event('invoice.paid', invoice)),
      forged: () => signed(event('invoice.paid', invoice), NOW, 'whsec_wrong'),
      stale: () => signed(event('invoice.paid', invoice), NOW - 301),
      wrongEnvironment: () => signed(event('invoice.paid', invoice, true)),
      unknown: () => signed(event('sigma.scheduled_query_run.created', {})),
    },
  };
}

function mockHarness(make?: (a: PaymentProviderAdapter) => PaymentProviderAdapter): AdapterHarness {
  const SECRET = 'mock_contract_secret';
  const signed = async (body: string, t = NOW, secret = SECRET): Promise<WebhookRequest> => ({
    rawBody: body,
    headers: new Headers({ [MOCK_SIGNATURE_HEADER]: await signMockBody(body, secret, t) }),
    nowSeconds: NOW,
  });
  const event = (type: string, livemode = false) =>
    JSON.stringify({ id: 'mevt_1', type, livemode, created: NOW - 5, data: { object: { amount: 799 } } });
  return {
    name: 'mock',
    make: () => { const a = createMockAdapter({ secret: SECRET }); return make ? make(a) : a; },
    webhook: {
      valid: () => signed(event('mock.payment.captured')),
      forged: () => signed(event('mock.payment.captured'), NOW, 'wrong'),
      stale: () => signed(event('mock.payment.captured'), NOW - 301),
      wrongEnvironment: () => signed(event('mock.payment.captured', true)),
      unknown: () => signed(event('mock.something.new')),
    },
  };
}

// ------------------------------------------------------- the real adapters --

describe('the adapter contract', () => {
  it('is met by the reference mock rail, every clause', async () => {
    expect(await runContract(mockHarness())).toEqual([]);
  });

  it('is met by the Stripe adapter, which wires verify and normalize and says so', async () => {
    expect(await runContract(stripeHarness())).toEqual([]);
  });

  it('describes the Stripe rail by what Semester has wired, not by what Stripe can do', () => {
    const a = createStripeAdapter({ apiKey: 'sk_live_x', webhookSecret: 'whsec_x' });
    expect(a?.rail).toMatchObject({ id: 'stripe-live', provider: 'stripe', mode: 'live' });
    expect(a?.rail.capabilities).toMatchObject({
      recurring: true, tax: true, offSessionCharge: false, refund: false, settlementReport: false,
      webhookSigning: 'hmac_sha256_timestamped',
    });
  });

  it('builds no Stripe rail from a key that is not a Stripe secret or restricted key', () => {
    for (const key of [undefined, '', 'pk_live_x', 'sk_x', 'whsec_x']) {
      expect(createStripeAdapter({ apiKey: key, webhookSecret: 'whsec_x' })).toBeNull();
    }
  });
});

// --------------------------------------------- controls: a broken rail is red --
//
// A clause that has never failed is not known to be a clause. Each break below
// is the smallest change that violates exactly one clause, and the suite must
// name it. The first two rows are the control: a broken probe would fail all of
// them, or none.

const EXPECTED: Record<string, ClauseId[]> = {
  // Accepting any signature also accepts the stale and wrong-environment events and hashes nothing it read.
  'webhook-forged-refused': ['webhook-forged-refused', 'webhook-stale-refused', 'webhook-wrong-environment-refused', 'webhook-valid-hashes-raw-body'],
  'normalize-unknown-is-other': ['normalize-unknown-is-other', 'events-carry-provenance'],
  // Charging again on every call leaves every clause that begins with a charge unable to hold.
  'charge-idempotent': ['charge-idempotent', 'no-card-input', 'errors-never-echo-input', 'refund-bounded', 'refund-idempotent'],
  'refund-bounded': ['refund-bounded', 'refund-idempotent'],
  'refund-idempotent': ['refund-idempotent'],
  'no-card-input': ['no-card-input'],
  'errors-never-echo-input': ['charge-idempotent', 'errors-never-echo-input', 'refund-bounded', 'refund-idempotent'],
  'unsupported-is-honest': ['unsupported-is-honest'],
  'events-carry-provenance': ['events-carry-provenance'],
  'normalize-is-pure': ['normalize-is-pure'],
};

describe('the adapter contract, against rails built to break it', () => {
  const breaks: Array<[ClauseId, string, (a: PaymentProviderAdapter) => PaymentProviderAdapter]> = [
    ['webhook-forged-refused', 'accepts any signature', (a) => ({
      ...a,
      verifyWebhook: async (i) => {
        const ev: VerifiedProviderEvent = {
          provider: a.rail.provider, eventId: 'e', type: 'x', occurredAt: new Date(NOW * 1000).toISOString(),
          livemode: a.rail.mode === 'live', object: {}, payloadSha256: 'a'.repeat(64),
        };
        void i;
        return { ok: true, value: ev };
      },
    })],
    ['normalize-unknown-is-other', 'throws on an event it does not know', (a) => ({
      ...a,
      normalize: (e) => { if (e.type.includes('something') || e.type.includes('sigma')) throw new Error('boom'); return a.normalize(e); },
    })],
    ['charge-idempotent', 'charges again on the same key', (a) => {
      let n = 0;
      return { ...a, charge: async () => ok({ paymentRef: `p${++n}`, status: 'captured' as const }) };
    }],
    ['refund-bounded', 'refunds above what was captured', (a) => ({
      ...a,
      refund: async () => ok({ refundRef: `r${Math.random()}`, status: 'succeeded' as const }),
    })],
    ['refund-idempotent', 'refunds again on the same key', (a) => {
      let n = 0;
      const real = a.refund;
      return { ...a, refund: async (i) => { const r = await real({ ...i, idempotencyKey: `${i.idempotencyKey}:${++n}` as typeof i.idempotencyKey }); return r; } };
    }],
    ['no-card-input', 'accepts card-looking text', (a) => {
      const real = a.charge;
      return { ...a, charge: async (i) => real({ ...i, invoiceRef: 'plain-ref' }) };
    }],
    ['errors-never-echo-input', 'puts the input in its error', (a) => ({
      ...a,
      charge: async (i) => ({ ok: false as const, error: { code: 'invalid_request' as const, message: `bad ref ${i.invoiceRef}`, retryable: false } }),
    })],
    ['unsupported-is-honest', 'claims a capability it has not wired', (a) => ({
      ...a,
      rail: { ...a.rail, capabilities: { ...a.rail.capabilities, settlementReport: true } },
      getSettlement: async () => fail('unsupported'),
    })],
    ['events-carry-provenance', 'reports events under another provider’s name', (a) => ({
      ...a,
      normalize: (e) => a.normalize(e).map((ev) => ({ ...ev, provider: 'someone_else' })),
    })],
    ['normalize-is-pure', 'differs between two reads of one event', (a) => {
      let n = 0;
      return { ...a, normalize: (e) => a.normalize(e).map((ev) => ({ ...ev, eventId: `${ev.eventId}-${++n}` })) };
    }],
  ];

  for (const [clause, why, brk] of breaks) {
    it(`names \`${clause}\` for a mock rail that ${why}`, async () => {
      const failed = await runContract(mockHarness(brk));
      expect(failed).toContain(clause);
    });
  }

  it('is not fooled in the other direction: an honest rail fails none of the clauses a broken one fails', async () => {
    expect(await runContract(mockHarness())).toEqual([]);
  });

  it('holds the Stripe adapter to the same wiring clauses (a lying capability is caught)', async () => {
    const lying = stripeHarness((a) => ({ ...a, rail: { ...a.rail, capabilities: { ...a.rail.capabilities, refund: true } } }));
    expect(await runContract(lying)).toContain('unsupported-is-honest');
  });

  it('names, for each broken rail, the clauses that break and no others', async () => {
    // The control: a probe that was itself broken would fail everything, or
    // nothing. Each broken rail fails exactly this set, so a clause that
    // started passing a violation, or failing an honest rail, shows here.
    const seen: Record<string, ClauseId[]> = {};
    for (const [clause, , brk] of breaks) seen[clause] = await runContract(mockHarness(brk));
    expect(seen).toEqual(EXPECTED);
  });
});
