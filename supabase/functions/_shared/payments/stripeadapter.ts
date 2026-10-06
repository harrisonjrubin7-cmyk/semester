/**
 * Stripe, behind the payment-rail seam.
 *
 * This is the first adapter and it is deliberately small: it is what
 * `billing-webhook` already does (verify, then read) moved behind the interface,
 * with every verification rule kept exactly as `stripe.ts` and `billingmode.ts`
 * have them. Collection, charge, refund and settlement are **not wired yet** and
 * answer `unsupported` honestly; each arrives with its own action in
 * `docs/finance/NATIVE_FINANCIAL_PLATFORM.md` §14, and until then checkout,
 * cancel and the portal keep calling Stripe directly, held as they are.
 *
 * `rail.capabilities` says what Semester has *wired*, not what Stripe can do.
 * It is what the console shows and what the contract suite holds the adapter
 * to: a capability that is `false` must answer `unsupported`, and one that is
 * `true` must work.
 *
 * Deno-free, like `stripe.ts`: the secret and key arrive as arguments.
 */
import { sha256Hex, verifySignature } from '../stripe.ts';
import { stripeMode } from '../billingmode.ts';
import { normalizeStripeEvent } from './normalizestripe.ts';
import {
  fail, type PaymentProviderAdapter, type PaymentRail, type RailCapabilities, type VerifyOutcome,
} from './types.ts';

/** Stripe events are a few kilobytes; the same bound `billing-webhook` applies. */
export const MAX_EVENT_BYTES = 256 * 1024;

export interface StripeAdapterConfig {
  /** `STRIPE_SECRET_KEY`: read only for its live/test prefix, here. */
  apiKey: string | undefined;
  /** `STRIPE_WEBHOOK_SECRET`. */
  webhookSecret: string | undefined;
}

const WIRED: RailCapabilities = {
  hostedCollection: false, // Checkout is still opened by billing-checkout directly.
  authorize: false, capture: false, refund: false, partialRefund: false,
  recurring: true, // Stripe Billing owns the subscription clock today (mode A).
  offSessionCharge: false, installments: false,
  tax: true, // Stripe Tax computes tax inside Stripe's invoice.
  disputes: false, disputeEvidenceApi: false, settlementReport: false,
  webhookSigning: 'hmac_sha256_timestamped',
};

/** Null when the key is not a Stripe secret or restricted key: there is no rail to describe. */
export function createStripeAdapter(cfg: StripeAdapterConfig): PaymentProviderAdapter | null {
  const mode = stripeMode(cfg.apiKey);
  if (!mode) return null;
  const rail: PaymentRail = {
    id: `stripe-${mode}`, provider: 'stripe', mode, status: 'enabled',
    kinds: ['card'], currencies: ['usd'], countries: ['US'],
    capabilities: WIRED,
    requiresKyc: false, requiresKyb: false, externalSettlement: true,
  };

  return {
    rail,
    createCollectionSession: async () => fail('unsupported'),
    getPaymentMethod: async () => fail('unsupported'),
    detachPaymentMethod: async () => fail('unsupported'),
    charge: async () => fail('unsupported'),
    authorize: async () => fail('unsupported'),
    capture: async () => fail('unsupported'),
    cancel: async () => fail('unsupported'),
    refund: async () => fail('unsupported'),
    submitDisputeEvidence: async () => fail('unsupported'),
    getSettlement: async () => fail('unsupported'),

    async verifyWebhook(i): Promise<VerifyOutcome> {
      // Verified before it is parsed, on the exact bytes received. Missing,
      // stale and wrong stay distinct here; the caller answers all three alike.
      if (!cfg.webhookSecret) return { ok: false, refusal: 'missing' };
      if (new TextEncoder().encode(i.rawBody).length > MAX_EVENT_BYTES) return { ok: false, refusal: 'not_an_event' };
      const verdict = await verifySignature(i.rawBody, i.headers.get('Stripe-Signature'), cfg.webhookSecret, i.nowSeconds);
      if (verdict !== 'ok') return { ok: false, refusal: verdict };

      let parsed: unknown;
      try { parsed = JSON.parse(i.rawBody); } catch { return { ok: false, refusal: 'not_json' }; }
      const ev = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
      const id = typeof ev.id === 'string' && ev.id.length > 0 && ev.id.length <= 200 ? ev.id : null;
      const type = typeof ev.type === 'string' && ev.type.length > 0 && ev.type.length <= 200 ? ev.type : null;
      const created = typeof ev.created === 'number' && Number.isFinite(ev.created) && ev.created > 0 ? ev.created : null;
      if (!id || !type || created === null) return { ok: false, refusal: 'not_an_event' };
      if (ev.livemode !== (mode === 'live')) return { ok: false, refusal: 'wrong_environment' };

      const data = ev.data && typeof ev.data === 'object' ? (ev.data as Record<string, unknown>) : {};
      const object = data.object && typeof data.object === 'object' && !Array.isArray(data.object)
        ? (data.object as Record<string, unknown>) : {};
      return {
        ok: true,
        value: {
          provider: 'stripe', eventId: id, type, occurredAt: new Date(created * 1000).toISOString(),
          livemode: ev.livemode, object, payloadSha256: await sha256Hex(i.rawBody),
        },
      };
    },

    normalize: normalizeStripeEvent,
  };
}
