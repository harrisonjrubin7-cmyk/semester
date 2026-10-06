/**
 * The payment provider's webhook, as a pure request handler.
 *
 * Stripe posts every billing event here, server to server. This verifies the
 * `Stripe-Signature` on the **raw** body before reading a byte of it, hashes
 * the body, and applies the event through the service-only functions in
 * `20260929080000_commercial_automation.sql`:
 *
 *   checkout.session.completed      complete_checkout → an active subscription
 *   customer.subscription.*         sync_provider_subscription (newer events only)
 *   invoice.paid / payment_succeeded atomic invoice snapshot + payment_succeeded
 *   invoice.payment_failed          atomic invoice snapshot + payment_failed → dunning
 *   invoice.finalization_failed     tax outage recorded; missing location requests an address update
 *   charge.refunded                 refund
 *   charge.dispute.created          chargeback
 *   anything else                   recorded as `other`
 *
 * Verification and reading are the Stripe adapter's (`payments/stripeadapter.ts`,
 * `payments/normalizestripe.ts`); what is left here is the HTTP shell and the
 * choice of which database function each normalized event calls. The reading was
 * moved, not changed: `app/src/lib/payments/normalize.test.ts` holds both this
 * handler and the normalizer to what the handler handed the database before the
 * move (`stripe.golden.json`).
 *
 * `apply_payment_event` is called **last**, and it is the idempotency key
 * (`provider_event_id`). Every step before it is idempotent on its own, so a
 * failure half-way answers 500, the provider retries, and the retry does the
 * remaining work instead of being dismissed as a duplicate. An invoice event
 * that arrives before the `checkout.session.completed` that creates its
 * subscription is answered the same way, 500 with nothing recorded: recording
 * it would answer every retry `duplicate`, and the first payment would never
 * reach the subscription.
 *
 * ## What it refuses to do
 *
 * - **Run unconfigured.** With no `STRIPE_WEBHOOK_SECRET` it answers 503 to
 *   everything: it cannot tell a real event from a forged one.
 * - **Answer a browser.** A webhook never comes from a page. There is no CORS
 *   header on any response, a preflight is refused, and a request carrying an
 *   `Origin` is refused before anything else is read.
 * - **Log the payload.** Not the body, not the event, not the customer. Its
 *   one log line on failure says only that applying failed.
 * - **Say why a signature failed.** Missing, stale and wrong are one 400.
 */
import type { PaymentKind, SubscriptionStatus } from './stripe.ts';
import { stripeMode } from './billingmode.ts';
import { createStripeAdapter, MAX_EVENT_BYTES } from './payments/stripeadapter.ts';
import type { NormalizedPaymentEvent, WebhookRefusal } from './payments/types.ts';

export interface WebhookDeps {
  /** `STRIPE_WEBHOOK_SECRET`; unset turns the endpoint off. */
  secret: string | undefined;
  /** Match the signing endpoint to the API environment before applying entitlements. */
  stripeKey: string | undefined;
  /** Seconds since the epoch. */
  now(): number;
  completeCheckout(checkoutId: string, subscriptionRef: string | null, customerRef: string | null): Promise<unknown>;
  syncSubscription(
    ref: string, status: SubscriptionStatus, periodStart: string | null, periodEnd: string | null,
    cancelAtPeriodEnd: boolean | null, eventAt: string,
  ): Promise<unknown>;
  applyInvoiceEvent(
    eventId: string, kind: PaymentKind, subscriptionRef: string, invoiceRef: string,
    invoiceStatus: 'draft' | 'open' | 'paid',
    subtotalCents: number | null, taxCents: number | null, currency: string | null,
    issuedAt: string | null, dueAt: string | null, snapshotAt: string, snapshotRank: number,
    amountCents: number | null, sha256: string,
  ): Promise<string>;
  applyEvent(eventId: string, kind: PaymentKind, invoiceId: string | null, amountCents: number | null, sha256: string): Promise<string>;
}

/** Stripe events are a few kilobytes; this is generous and bounded. */
export const MAX_WEBHOOK_BYTES = MAX_EVENT_BYTES;

const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } as const;

const reply = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });

/** The words each refusal is answered with. Missing, stale and wrong signatures are one sentence. */
const REFUSAL: Record<WebhookRefusal, string> = {
  missing: 'Invalid signature.', stale: 'Invalid signature.', mismatch: 'Invalid signature.',
  not_json: 'Not JSON.', not_an_event: 'Not an event.', wrong_environment: 'Wrong payment environment.',
};

/** The `payment_events.kind` each normalized event is recorded under. */
const RECORDED_KIND = {
  'payment.captured': 'payment_succeeded', 'payment.failed': 'payment_failed',
  'tax.location_required': 'address_required', other: 'other',
} as const satisfies Record<string, PaymentKind>;

/** Apply one normalized event. Returns a response only when the event ends the request early. */
async function apply(e: NormalizedPaymentEvent, deps: WebhookDeps): Promise<Response | null> {
  let kind: PaymentKind = 'other';
  let amount: number | null = null;

  switch (e.type) {
    case 'checkout.completed':
      await deps.completeCheckout(e.checkoutId, e.subscriptionRef, e.customerRef);
      break;
    case 'subscription.synced':
      await deps.syncSubscription(e.subscriptionRef, e.status, e.periodStart, e.periodEnd, e.cancelAtPeriodEnd, e.occurredAt);
      break;
    case 'payment.captured': case 'payment.failed': case 'tax.location_required': case 'other': {
      kind = RECORDED_KIND[e.type];
      amount = e.amountCents;
      if (e.invoice) {
        const i = e.invoice;
        const outcome = await deps.applyInvoiceEvent(
          e.eventId, kind, i.subscriptionRef, i.invoiceRef, i.status, i.subtotalCents, i.taxCents, i.currency,
          i.issuedAt, i.dueAt, e.occurredAt, i.rank, e.amountCents, e.payloadSha256,
        );
        if (outcome === 'not_ready') {
          // The subscription is not stored yet: its checkout event is still on
          // its way. Nothing is recorded, so the provider's retry is not a duplicate.
          console.error('billing-webhook: an invoice arrived before its subscription; asked for a retry');
          return reply(500, { error: 'Not ready for this event.' });
        }
        return reply(200, { received: true, outcome });
      }
      break;
    }
    case 'refund.succeeded':
      kind = 'refund';
      amount = e.amountCents;
      break;
    case 'dispute.opened':
      kind = 'chargeback';
      amount = e.amountCents;
      break;
  }

  const outcome = await deps.applyEvent(e.eventId, kind, null, amount, e.payloadSha256);
  return reply(200, { received: true, outcome });
}

export async function handleBillingWebhook(req: Request, deps: WebhookDeps): Promise<Response> {
  const mode = stripeMode(deps.stripeKey);
  if (!deps.secret || !mode) return reply(503, { error: 'Billing is not configured.' });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed.' }, { Allow: 'POST' });
  if (req.headers.get('Origin')) return reply(403, { error: 'Not a browser endpoint.' });

  const declared = Number(req.headers.get('Content-Length') ?? '0');
  if (declared > MAX_WEBHOOK_BYTES) return reply(413, { error: 'Too large.' });
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > MAX_WEBHOOK_BYTES) return reply(413, { error: 'Too large.' });

  const adapter = createStripeAdapter({ apiKey: deps.stripeKey, webhookSecret: deps.secret });
  if (!adapter) return reply(503, { error: 'Billing is not configured.' });

  const verified = await adapter.verifyWebhook({ rawBody: raw, headers: req.headers, nowSeconds: deps.now() });
  if (!verified.ok) return reply(400, { error: REFUSAL[verified.refusal] });

  try {
    // Every event the adapter reads is exactly one normalized event today; the
    // loop is the shape a rail that reports several would need.
    for (const e of adapter.normalize(verified.value)) {
      const early = await apply(e, deps);
      if (early) return early;
    }
    // Nothing to apply is not a success to report: the provider should hear that.
    return reply(400, { error: 'Not an event.' });
  } catch {
    // Deliberately nothing about the event: no id, no body, no customer.
    console.error('billing-webhook: applying an event failed');
    return reply(500, { error: 'Could not apply the event.' });
  }
}
