/**
 * A verified Stripe event, in Semester's vocabulary. Pure: no I/O, no clock, no
 * mutation of its input.
 *
 * This is `billingwebhook.ts`'s reading of an event lifted out of the handler,
 * not a new reading. Every fact it extracts is the fact the handler passes to
 * the database today, and `app/src/lib/payments/normalize.test.ts` holds the two
 * together by running the handler and the normalizer over the same events and
 * comparing what each hands on. The handler still has its own copy of the
 * helpers below; it stops having one when the handler reads through the
 * adapter (action 8 in `docs/finance/NATIVE_FINANCIAL_PLATFORM.md` §14), and
 * the parity test is what makes that change safe.
 *
 * An event the table below does not name becomes `other` and changes nothing.
 * Nothing here throws: a field that is missing or the wrong shape is `null`.
 */
import { isoFromSeconds, mapSubscriptionStatus } from '../stripe.ts';
import type { InvoiceSnapshot, NormalizedPaymentEvent, VerifiedProviderEvent } from './types.ts';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 && v.length <= 200 ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);
/** A Stripe reference field is an id string, or an expanded object carrying one. */
const ref = (v: unknown): string | null => str(v) ?? str(obj(v).id);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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

const INVOICE_TYPES = new Set(['invoice.paid', 'invoice.payment_succeeded', 'invoice.payment_failed', 'invoice.finalization_failed']);

export function normalizeStripeEvent(e: VerifiedProviderEvent): NormalizedPaymentEvent[] {
  const base = { provider: e.provider, eventId: e.eventId, occurredAt: e.occurredAt, payloadSha256: e.payloadSha256 };
  const o = e.object;
  const type = e.type;

  if (type === 'checkout.session.completed') {
    const checkout = str(o.client_reference_id) ?? str(obj(o.metadata).semester_checkout_id);
    if (checkout && UUID.test(checkout) && o.mode === 'subscription') {
      return [{ ...base, type: 'checkout.completed', checkoutId: checkout, subscriptionRef: ref(o.subscription), customerRef: ref(o.customer) }];
    }
    return [{ ...base, type: 'other', providerType: type, amountCents: null, invoice: null }];
  }

  if (type.startsWith('customer.subscription.')) {
    const id = str(o.id);
    const status = type === 'customer.subscription.deleted' ? 'ended' : mapSubscriptionStatus(o.status);
    // Newer API versions keep the period on the subscription's items.
    const item = obj(Array.isArray(obj(o.items).data) ? (obj(o.items).data as unknown[])[0] : null);
    if (id && status) {
      return [{
        ...base, type: 'subscription.synced', subscriptionRef: id, status,
        periodStart: isoFromSeconds(o.current_period_start ?? item.current_period_start),
        periodEnd: isoFromSeconds(o.current_period_end ?? item.current_period_end),
        cancelAtPeriodEnd: typeof o.cancel_at_period_end === 'boolean' ? o.cancel_at_period_end : null,
      }];
    }
    return [{ ...base, type: 'other', providerType: type, amountCents: null, invoice: null }];
  }

  if (INVOICE_TYPES.has(type)) {
    const finalizationFailed = type === 'invoice.finalization_failed';
    const needsCustomerLocation = finalizationFailed && obj(o.automatic_tax).status === 'requires_location_inputs';
    const failed = type === 'invoice.payment_failed';
    const paid = type === 'invoice.paid' || type === 'invoice.payment_succeeded';
    // A tax-service outage is operational, not a failed customer payment: it is
    // recorded as `other` and never starts dunning. A missing customer location
    // is its own thing, not a card failure.
    const kind: 'payment.captured' | 'payment.failed' | 'tax.location_required' | 'other' =
      needsCustomerLocation ? 'tax.location_required'
        : finalizationFailed ? 'other'
          : failed ? 'payment.failed'
            : 'payment.captured';
    const amountCents = num(paid ? o.amount_paid : o.amount_due);
    const sub = invoiceSubscription(o);
    const id = str(o.id);
    let invoice: InvoiceSnapshot | null = null;
    if (sub && id) {
      const tax = invoiceTax(o);
      invoice = {
        invoiceRef: id,
        subscriptionRef: sub,
        status: finalizationFailed ? 'draft' : paid ? 'paid' : 'open',
        subtotalCents: num(o.total_excluding_tax) ?? num(o.subtotal_excluding_tax) ?? num(o.subtotal) ??
          Math.max((num(o.amount_due) ?? 0) - tax, 0),
        taxCents: tax,
        currency: str(o.currency),
        issuedAt: isoFromSeconds(o.created),
        dueAt: isoFromSeconds(o.due_date) ?? isoFromSeconds(o.created),
        rank: paid ? 2 : failed ? 1 : 0,
        amountCents,
      };
    }
    if (kind === 'other') return [{ ...base, type: 'other', providerType: type, amountCents, invoice }];
    return [{ ...base, type: kind, amountCents, invoice }];
  }

  if (type === 'charge.refunded') return [{ ...base, type: 'refund.succeeded', amountCents: num(o.amount_refunded) }];
  if (type === 'charge.dispute.created') return [{ ...base, type: 'dispute.opened', amountCents: num(o.amount) }];

  return [{ ...base, type: 'other', providerType: type, amountCents: null, invoice: null }];
}
