/**
 * The contract every payment-rail adapter must pass.
 *
 * `runContract(harness)` returns the ids of the clauses an adapter fails; an
 * adapter that honours the design in
 * `docs/finance/PAYMENT_PROVIDER_ADAPTER_ARCHITECTURE.md` §9 returns `[]`. It
 * returns ids rather than asserting so the suite can be run against a rail that
 * is deliberately broken: a clause that has never failed is not known to be a
 * clause (see CLAUDE.md), and `contract.test.ts` shows each one red.
 *
 * The suite is driven by `rail.capabilities`. A capability that is `false` must
 * answer `unsupported`; one that is `true` must work. So an adapter cannot
 * claim what it has not wired, and a new rail is held to what it says it does.
 */
import {
  idemKey, PROVIDER_ID, type NormalizedPaymentEvent, type PaymentProviderAdapter, type PaymentToken, type VerifiedProviderEvent,
  type WebhookRequest,
} from '../../../../supabase/functions/_shared/payments/types';

export interface WebhookFixtures {
  /** A correctly signed, in-date event of a type the rail knows. */
  valid(): Promise<WebhookRequest>;
  /** The same event signed with the wrong secret. */
  forged(): Promise<WebhookRequest>;
  /** A correctly signed event from outside the tolerance window. */
  stale(): Promise<WebhookRequest>;
  /** A correctly signed event from the other environment (live vs test). */
  wrongEnvironment(): Promise<WebhookRequest>;
  /** A correctly signed event of a type nobody has heard of. */
  unknown(): Promise<WebhookRequest>;
}

export interface AdapterHarness {
  name: string;
  make(): PaymentProviderAdapter;
  webhook: WebhookFixtures;
}

export type ClauseId =
  | 'rail-descriptor-valid'
  | 'webhook-forged-refused'
  | 'webhook-stale-refused'
  | 'webhook-wrong-environment-refused'
  | 'webhook-valid-hashes-raw-body'
  | 'normalize-unknown-is-other'
  | 'normalize-is-pure'
  | 'events-carry-provenance'
  | 'unsupported-is-honest'
  | 'charge-idempotent'
  | 'refund-bounded'
  | 'refund-idempotent'
  | 'no-card-input'
  | 'errors-never-echo-input';

const TOKEN = 'tok_contract' as PaymentToken;
const HEX64 = /^[0-9a-f]{64}$/;

async function sha256(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verified(a: PaymentProviderAdapter, req: WebhookRequest): Promise<VerifiedProviderEvent | null> {
  const out = await a.verifyWebhook(req);
  return out.ok ? out.value : null;
}

export async function runContract(h: AdapterHarness): Promise<ClauseId[]> {
  const failed: ClauseId[] = [];
  const a = h.make();
  const check = async (id: ClauseId, run: () => Promise<boolean>) => {
    let pass = false;
    // A rail that throws across the seam has broken the contract by throwing.
    try { pass = await run(); } catch { pass = false; }
    if (!pass) failed.push(id);
  };
  const caps = a.rail.capabilities;

  await check('rail-descriptor-valid', async () =>
    PROVIDER_ID.test(a.rail.provider) &&
    a.rail.currencies.every((c) => /^[a-z]{3}$/.test(c)) &&
    (a.rail.mode === 'live' || a.rail.mode === 'test'));

  // --- inbound ---------------------------------------------------------
  await check('webhook-forged-refused', async () => (await verified(a, await h.webhook.forged())) === null);
  await check('webhook-stale-refused', async () => (await verified(a, await h.webhook.stale())) === null);
  await check('webhook-wrong-environment-refused', async () => (await verified(a, await h.webhook.wrongEnvironment())) === null);

  await check('webhook-valid-hashes-raw-body', async () => {
    const req = await h.webhook.valid();
    const ev = await verified(a, req);
    return ev !== null && ev.payloadSha256 === (await sha256(req.rawBody));
  });

  await check('normalize-unknown-is-other', async () => {
    const ev = await verified(a, await h.webhook.unknown());
    if (!ev) return false;
    const out = a.normalize(ev);
    return out.length === 1 && out[0].type === 'other';
  });

  await check('normalize-is-pure', async () => {
    const ev = await verified(a, await h.webhook.valid());
    if (!ev) return false;
    const before = JSON.stringify(ev);
    const one = JSON.stringify(a.normalize(ev));
    const two = JSON.stringify(a.normalize(ev));
    return one === two && JSON.stringify(ev) === before;
  });

  await check('events-carry-provenance', async () => {
    const evs: NormalizedPaymentEvent[] = [];
    for (const f of [h.webhook.valid, h.webhook.unknown]) {
      const ev = await verified(a, await f());
      if (ev) evs.push(...a.normalize(ev));
    }
    return evs.length > 0 && evs.every((e) =>
      e.provider === a.rail.provider && e.eventId.length > 0 && HEX64.test(e.payloadSha256) &&
      !Number.isNaN(Date.parse(e.occurredAt)) && new Date(e.occurredAt).toISOString() === e.occurredAt);
  });

  // --- capability honesty ---------------------------------------------
  await check('unsupported-is-honest', async () => {
    const probes: Array<[boolean, () => Promise<{ ok: boolean; error?: { code: string } }>]> = [
      [caps.hostedCollection, () => a.createCollectionSession({
        idempotencyKey: idemKey('collect', 'chk1'), checkoutId: 'chk1', billingAccountRef: null,
        returnUrl: 'https://app.example/return', cancelUrl: 'https://app.example/cancel',
      })],
      [caps.offSessionCharge, () => a.charge({ idempotencyKey: idemKey('charge', 'inv-honest'), amountCents: 100, currency: 'usd', token: TOKEN, invoiceRef: 'inv-honest' })],
      [caps.authorize, () => a.authorize({ idempotencyKey: idemKey('charge', 'inv-auth'), amountCents: 100, currency: 'usd', token: TOKEN, invoiceRef: 'inv-auth' })],
      [caps.refund, () => a.refund({ idempotencyKey: idemKey('refund', 'rf-honest'), amountCents: 100, currency: 'usd', paymentRef: 'pay-honest', reason: 'billing_error' })],
      [caps.settlementReport, () => a.getSettlement({ from: '2026-10-01', to: '2026-10-31' })],
      [caps.disputeEvidenceApi, () => a.submitDisputeEvidence({ idempotencyKey: idemKey('evidence', 'dp1'), disputeRef: 'dp1', itemHashes: [] })],
    ];
    for (const [claimed, call] of probes) {
      const r = await call();
      const unsupported = !r.ok && r.error?.code === 'unsupported';
      // Claimed and unsupported is a lie; unclaimed and not unsupported is a lie too.
      if (claimed === unsupported) return false;
    }
    return true;
  });

  // --- money commands, for a rail that claims them -------------------------
  if (caps.offSessionCharge) {
    await check('charge-idempotent', async () => {
      const key = idemKey('charge', 'inv-idem');
      const input = { idempotencyKey: key, amountCents: 799, currency: 'usd', token: TOKEN, invoiceRef: 'inv-idem' };
      const one = await a.charge(input);
      const two = await a.charge(input);
      return one.ok && two.ok && one.value.paymentRef === two.value.paymentRef;
    });

    await check('no-card-input', async () => {
      const r = await a.charge({
        idempotencyKey: idemKey('charge', 'inv-card'), amountCents: 100, currency: 'usd', token: TOKEN,
        invoiceRef: '4242 4242 4242 4242',
      });
      return !r.ok && r.error.code === 'invalid_request';
    });

    await check('errors-never-echo-input', async () => {
      const marker = 'ZZ-MARKER-7f3a';
      const r = await a.charge({
        idempotencyKey: idemKey('charge', 'inv-echo'), amountCents: -5, currency: 'usd', token: TOKEN, invoiceRef: marker,
      });
      return !r.ok && !JSON.stringify(r).includes(marker);
    });
  }

  if (caps.refund && caps.offSessionCharge) {
    await check('refund-bounded', async () => {
      const paid = await a.charge({ idempotencyKey: idemKey('charge', 'inv-rb'), amountCents: 1000, currency: 'usd', token: TOKEN, invoiceRef: 'inv-rb' });
      if (!paid.ok) return false;
      const ref = paid.value.paymentRef;
      const over = await a.refund({ idempotencyKey: idemKey('refund', 'rb-over'), amountCents: 1001, currency: 'usd', paymentRef: ref, reason: 'billing_error' });
      const part = await a.refund({ idempotencyKey: idemKey('refund', 'rb-part'), amountCents: 600, currency: 'usd', paymentRef: ref, reason: 'billing_error' });
      const rest = await a.refund({ idempotencyKey: idemKey('refund', 'rb-rest'), amountCents: 401, currency: 'usd', paymentRef: ref, reason: 'billing_error' });
      const exact = await a.refund({ idempotencyKey: idemKey('refund', 'rb-exact'), amountCents: 400, currency: 'usd', paymentRef: ref, reason: 'billing_error' });
      return !over.ok && part.ok && !rest.ok && exact.ok;
    });

    await check('refund-idempotent', async () => {
      const paid = await a.charge({ idempotencyKey: idemKey('charge', 'inv-ri'), amountCents: 500, currency: 'usd', token: TOKEN, invoiceRef: 'inv-ri' });
      if (!paid.ok) return false;
      const input = { idempotencyKey: idemKey('refund', 'ri-1'), amountCents: 500, currency: 'usd', paymentRef: paid.value.paymentRef, reason: 'goodwill' as const };
      const one = await a.refund(input);
      const two = await a.refund(input);
      // A second submit with the same key must not refund again (which would exceed the capture).
      return one.ok && two.ok && one.value.refundRef === two.value.refundRef;
    });
  }

  return failed;
}
