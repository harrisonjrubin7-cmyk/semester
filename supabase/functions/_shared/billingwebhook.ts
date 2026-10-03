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
import {
  isoFromSeconds, mapSubscriptionStatus, sha256Hex, verifySignature, type PaymentKind, type SubscriptionStatus,
} from './stripe.ts';
import { stripeMode } from './billingmode.ts';

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
export const MAX_WEBHOOK_BYTES = 256 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } as const;

const reply = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 && v.length <= 200 ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
/** A Stripe reference field is an id string, or an expanded object carrying one. */
const ref = (v: unknown): string | null => str(v) ?? str(obj(v).id);

/** The subscription an invoice bills, wherever this API version keeps it. */
function invoiceSubscription(o: Obj): string | null {
  return ref(o.subscription) ?? ref(obj(obj(o.parent).subscription_details).subscription);
}

/** Tax total across current and older Stripe invoice response shapes. */
function invoiceTax(o: Obj): number {
  for (const key of ['total_taxes', 'total_tax_amounts']) {
    const rows = o[key];
    if (Array.isArray(rows)) return rows.reduce((sum, row) => sum + (num(obj(row).amount) ?? 0), 0);
  }
  return num(o.tax) ?? 0;
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

  const verdict = await verifySignature(raw, req.headers.get('Stripe-Signature'), deps.secret, deps.now());
  if (verdict !== 'ok') return reply(400, { error: 'Invalid signature.' });

  let event: Obj;
  try {
    event = obj(JSON.parse(raw));
  } catch {
    return reply(400, { error: 'Not JSON.' });
  }
  const eventId = str(event.id);
  const type = str(event.type);
  const eventAt = isoFromSeconds(event.created);
  if (!eventId || !type || !eventAt) return reply(400, { error: 'Not an event.' });
  if (event.livemode !== (mode === 'live')) return reply(400, { error: 'Wrong payment environment.' });
  const o = obj(obj(event.data).object);

  try {
    const sha = await sha256Hex(raw);
    let kind: PaymentKind = 'other';
    let invoiceId: string | null = null;
    let amount: number | null = null;

    if (type === 'checkout.session.completed') {
      const checkout = str(o.client_reference_id) ?? str(obj(o.metadata).semester_checkout_id);
      if (checkout && UUID.test(checkout) && o.mode === 'subscription') {
        await deps.completeCheckout(checkout, ref(o.subscription), ref(o.customer));
      }
    } else if (type.startsWith('customer.subscription.')) {
      const id = str(o.id);
      const status = type === 'customer.subscription.deleted' ? 'ended' : mapSubscriptionStatus(o.status);
      // Newer API versions keep the period on the subscription's items.
      const item = obj(Array.isArray(obj(o.items).data) ? (obj(o.items).data as unknown[])[0] : null);
      if (id && status) {
        await deps.syncSubscription(
          id, status,
          isoFromSeconds(o.current_period_start ?? item.current_period_start),
          isoFromSeconds(o.current_period_end ?? item.current_period_end),
          typeof o.cancel_at_period_end === 'boolean' ? o.cancel_at_period_end : null,
          eventAt,
        );
      }
    } else if (type === 'invoice.paid' || type === 'invoice.payment_succeeded' ||
               type === 'invoice.payment_failed' || type === 'invoice.finalization_failed') {
      const finalizationFailed = type === 'invoice.finalization_failed';
      const needsCustomerLocation = finalizationFailed &&
        obj(o.automatic_tax).status === 'requires_location_inputs';
      // A Stripe Tax service failure is operational, not a failed customer
      // payment. Missing customer location is also not a card failure: keep a
      // distinct issue for the Account screen and never start dunning for it.
      const failed = type === 'invoice.payment_failed';
      kind = needsCustomerLocation ? 'address_required' : failed ? 'payment_failed' : 'payment_succeeded';
      if (finalizationFailed && !needsCustomerLocation) kind = 'other';
      const paid = type === 'invoice.paid' || type === 'invoice.payment_succeeded';
      // Stripe may deliver finalization failures after a later payment event.
      // The database uses this lifecycle rank before event time when deciding
      // whether the snapshot may replace stored invoice amounts.
      const snapshotRank = paid ? 2 : type === 'invoice.payment_failed' ? 1 : 0;
      const invoiceStatus = finalizationFailed ? 'draft' : paid ? 'paid' : 'open';
      amount = num(paid ? o.amount_paid : o.amount_due);
      const sub = invoiceSubscription(o);
      const id = str(o.id);
      if (sub && id) {
        const tax = invoiceTax(o);
        const subtotal = num(o.total_excluding_tax) ?? num(o.subtotal_excluding_tax) ??
          num(o.subtotal) ?? Math.max((num(o.amount_due) ?? 0) - tax, 0);
        const outcome = await deps.applyInvoiceEvent(
          eventId, kind, sub, id, invoiceStatus, subtotal, tax, str(o.currency), isoFromSeconds(o.created),
          isoFromSeconds(o.due_date) ?? isoFromSeconds(o.created), eventAt, snapshotRank, amount, sha,
        );
        if (outcome === 'not_ready') {
          // The subscription is not stored yet: its checkout event is still on
          // its way. Nothing is recorded, so the provider's retry is not a duplicate.
          console.error('billing-webhook: an invoice arrived before its subscription; asked for a retry');
          return reply(500, { error: 'Not ready for this event.' });
        }
        return reply(200, { received: true, outcome });
      }
    } else if (type === 'charge.refunded') {
      kind = 'refund';
      amount = num(o.amount_refunded);
    } else if (type === 'charge.dispute.created') {
      kind = 'chargeback';
      amount = num(o.amount);
    }

    const outcome = await deps.applyEvent(eventId, kind, invoiceId, amount, sha);
    return reply(200, { received: true, outcome });
  } catch {
    // Deliberately nothing about the event: no id, no body, no customer.
    console.error('billing-webhook: applying an event failed');
    return reply(500, { error: 'Could not apply the event.' });
  }
}
