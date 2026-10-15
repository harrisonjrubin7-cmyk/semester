/**
 * A deterministic in-memory rail for tests and the sandbox. It implements the
 * whole interface so everything above the seam (checkout, refund workflow,
 * reconciliation) can be built and proved without a real rail, and so the
 * contract suite has a reference that passes every clause.
 *
 * It is not a model of any provider. It models the *contract*: a command with
 * the same key answers the same, a refund can never exceed what was captured,
 * nothing that looks like a card number is accepted, and a failure never echoes
 * its input. Nothing real is charged: it holds numbers in a `Map`.
 *
 * Its webhook scheme reuses Stripe's header format under `X-Mock-Signature`, so
 * the signature code under test is the real one.
 */
import { hmacSha256Hex, sha256Hex, verifySignature } from '../stripe.ts';
import {
  fail, ok, looksLikeCardNumber, type CancelInput, type CaptureInput, type ChargeInput, type ChargeResult,
  type NormalizedPaymentEvent, type PaymentMethodSummary, type PaymentProviderAdapter, type PaymentRail,
  type RefundInput, type RefundResult, type Result, type SettlementReport, type VerifiedProviderEvent, type VerifyOutcome,
} from './types.ts';

export const MOCK_SIGNATURE_HEADER = 'X-Mock-Signature';

/** What a webhook sender (a test) calls to sign a body for the mock rail. */
export async function signMockBody(rawBody: string, secret: string, t: number): Promise<string> {
  return `t=${t},v1=${await hmacSha256Hex(secret, `${t}.${rawBody}`)}`;
}

const CURRENCY = /^[a-z]{3}$/;

export interface MockRailOptions { secret?: string; mode?: 'live' | 'test'; }

export function createMockAdapter(opts: MockRailOptions = {}): PaymentProviderAdapter {
  const secret = opts.secret ?? 'mock_webhook_secret';
  const mode = opts.mode ?? 'test';
  const rail: PaymentRail = {
    id: `mock-${mode}`, provider: 'mock', mode, status: 'enabled',
    kinds: ['card'], currencies: ['usd'], countries: ['US'],
    capabilities: {
      hostedCollection: true, authorize: true, capture: true, refund: true, partialRefund: true,
      recurring: false, offSessionCharge: true, installments: false, tax: false,
      disputes: true, disputeEvidenceApi: true, settlementReport: true,
      webhookSigning: 'hmac_sha256_timestamped',
    },
    requiresKyc: false, requiresKyb: false, externalSettlement: false,
  };

  const charges = new Map<string, { amount: number; currency: string; result: ChargeResult }>();
  const payments = new Map<string, { captured: number; refunded: number; currency: string }>();
  const refunds = new Map<string, { amount: number; result: RefundResult }>();
  let seq = 0;

  const moneyOk = (amount: number, currency: string) =>
    Number.isInteger(amount) && amount > 0 && CURRENCY.test(currency);
  const textOk = (...fields: string[]) => fields.every((f) => !looksLikeCardNumber(f));

  return {
    rail,

    async createCollectionSession(i) {
      if (!/^https:\/\//.test(i.returnUrl) || !/^https:\/\//.test(i.cancelUrl)) return fail('invalid_request');
      if (!textOk(i.checkoutId, i.billingAccountRef ?? '')) return fail('invalid_request');
      return ok({ kind: 'hosted_page', url: `https://pay.mock.test/c/${i.checkoutId}`, clientSecret: null, providerSessionRef: `mock_cs_${i.checkoutId}` });
    },

    async getPaymentMethod(i): Promise<Result<PaymentMethodSummary>> {
      return ok({ token: i.token, kind: 'card', brand: 'mock', last4: '4242', expMonth: 12, expYear: 2099, status: 'active' });
    },
    async detachPaymentMethod() { return ok(undefined); },

    async charge(i: ChargeInput) {
      if (!moneyOk(i.amountCents, i.currency) || !textOk(i.token, i.invoiceRef)) return fail('invalid_request');
      const seen = charges.get(i.idempotencyKey);
      if (seen) {
        // The same key with a different amount is a bug in the caller, not a new charge.
        return seen.amount === i.amountCents && seen.currency === i.currency ? ok(seen.result) : fail('invalid_request');
      }
      const paymentRef = `mock_pay_${++seq}`;
      const result: ChargeResult = { paymentRef, status: 'captured' };
      charges.set(i.idempotencyKey, { amount: i.amountCents, currency: i.currency, result });
      payments.set(paymentRef, { captured: i.amountCents, refunded: 0, currency: i.currency });
      return ok(result);
    },

    async authorize(i) {
      if (!moneyOk(i.amountCents, i.currency) || !textOk(i.token, i.invoiceRef)) return fail('invalid_request');
      return ok({ paymentRef: `mock_auth_${++seq}`, status: 'authorized' });
    },
    async capture(i: CaptureInput) {
      if (!moneyOk(i.amountCents, i.currency) || !textOk(i.paymentRef)) return fail('invalid_request');
      return ok({ paymentRef: i.paymentRef, status: 'captured' });
    },
    async cancel(i: CancelInput) {
      return textOk(i.paymentRef) ? ok({ paymentRef: i.paymentRef, status: 'cancelled' }) : fail('invalid_request');
    },

    async refund(i: RefundInput) {
      if (!moneyOk(i.amountCents, i.currency) || !textOk(i.paymentRef)) return fail('invalid_request');
      const seen = refunds.get(i.idempotencyKey);
      if (seen) return seen.amount === i.amountCents ? ok(seen.result) : fail('invalid_request');
      const p = payments.get(i.paymentRef);
      if (!p || p.currency !== i.currency) return fail('invalid_request');
      // Never above what was captured less what was already refunded.
      if (i.amountCents > p.captured - p.refunded) return fail('invalid_request');
      p.refunded += i.amountCents;
      const result: RefundResult = { refundRef: `mock_re_${++seq}`, status: 'succeeded' };
      refunds.set(i.idempotencyKey, { amount: i.amountCents, result });
      return ok(result);
    },

    async submitDisputeEvidence() { return ok(undefined); },

    async getSettlement(): Promise<Result<SettlementReport>> {
      return ok({ batches: [], sourceSha256: await sha256Hex('') });
    },

    async verifyWebhook(i): Promise<VerifyOutcome> {
      const verdict = await verifySignature(i.rawBody, i.headers.get(MOCK_SIGNATURE_HEADER), secret, i.nowSeconds);
      if (verdict !== 'ok') return { ok: false, refusal: verdict };
      let parsed: unknown;
      try { parsed = JSON.parse(i.rawBody); } catch { return { ok: false, refusal: 'not_json' }; }
      const ev = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
      if (typeof ev.id !== 'string' || typeof ev.type !== 'string' || typeof ev.created !== 'number') return { ok: false, refusal: 'not_an_event' };
      if (ev.livemode !== (mode === 'live')) return { ok: false, refusal: 'wrong_environment' };
      const data = ev.data && typeof ev.data === 'object' ? (ev.data as Record<string, unknown>) : {};
      const object = data.object && typeof data.object === 'object' && !Array.isArray(data.object) ? (data.object as Record<string, unknown>) : {};
      return {
        ok: true,
        value: {
          provider: 'mock', eventId: ev.id, type: ev.type, occurredAt: new Date(ev.created * 1000).toISOString(),
          livemode: ev.livemode, object, payloadSha256: await sha256Hex(i.rawBody),
        },
      };
    },

    normalize(e: VerifiedProviderEvent): NormalizedPaymentEvent[] {
      const base = { provider: e.provider, eventId: e.eventId, occurredAt: e.occurredAt, payloadSha256: e.payloadSha256 };
      const amount = typeof e.object.amount === 'number' && Number.isInteger(e.object.amount) ? e.object.amount : null;
      switch (e.type) {
        case 'mock.payment.captured': return [{ ...base, type: 'payment.captured', amountCents: amount, invoice: null }];
        case 'mock.payment.failed': return [{ ...base, type: 'payment.failed', amountCents: amount, invoice: null }];
        case 'mock.refund.succeeded': return [{ ...base, type: 'refund.succeeded', amountCents: amount }];
        case 'mock.dispute.opened': return [{ ...base, type: 'dispute.opened', amountCents: amount }];
        default: return [{ ...base, type: 'other', providerType: e.type, amountCents: null, invoice: null }];
      }
    },
  };
}
