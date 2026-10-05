/// <reference types="node" />
import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { handleBillingWebhook, type WebhookDeps } from '../../../../supabase/functions/_shared/billingwebhook';
import { createStripeAdapter } from '../../../../supabase/functions/_shared/payments/stripeadapter';
import type { NormalizedPaymentEvent } from '../../../../supabase/functions/_shared/payments/types';

/**
 * The normalizer is `billingwebhook.ts`'s reading of an event lifted out, and
 * the claim worth proving is that it *is* the same reading. Each event below is
 * sent through the real handler, which records what it hands the database, and
 * through the adapter (verify, then normalize); the second is turned back into
 * the same call tuples and the two must be equal. When the handler is moved to
 * read through the adapter, this is the test that says nothing changed.
 */

const SECRET = 'whsec_parity';
const KEY = 'sk_test_parity';
const NOW = 1790000000;
const CHECKOUT = '3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d';

const sign = (body: string) => `t=${NOW},v1=${createHmac('sha256', SECRET).update(`${NOW}.${body}`).digest('hex')}`;
const event = (type: string, object: Record<string, unknown>, id = 'evt_p1') =>
  JSON.stringify({ id, type, livemode: false, created: NOW - 5, data: { object } });

type Call = unknown[];

/** What the handler hands the database for one event. */
async function legacy(body: string): Promise<Call[]> {
  const calls: Call[] = [];
  const deps: WebhookDeps = {
    secret: SECRET, stripeKey: KEY, now: () => NOW,
    completeCheckout: vi.fn(async (...a) => { calls.push(['complete', ...a]); return 'x'; }),
    syncSubscription: vi.fn(async (...a) => { calls.push(['sync', ...a]); return 'updated'; }),
    applyInvoiceEvent: vi.fn(async (...a) => { calls.push(['invoice', ...a]); return 'recorded'; }),
    applyEvent: vi.fn(async (...a) => { calls.push(['apply', ...a]); return 'recorded'; }),
  };
  const res = await handleBillingWebhook(new Request('https://x/functions/v1/billing-webhook', {
    method: 'POST', headers: { 'Stripe-Signature': sign(body) }, body,
  }), deps);
  expect(res.status).toBe(200);
  return calls;
}

const LEGACY_KIND = {
  'payment.captured': 'payment_succeeded', 'payment.failed': 'payment_failed',
  'tax.location_required': 'address_required', other: 'other',
} as const;

/** The same calls, derived from normalized events instead. */
function callsFrom(events: NormalizedPaymentEvent[]): Call[] {
  const out: Call[] = [];
  for (const e of events) {
    switch (e.type) {
      case 'checkout.completed':
        out.push(['complete', e.checkoutId, e.subscriptionRef, e.customerRef]);
        out.push(['apply', e.eventId, 'other', null, null, e.payloadSha256]);
        break;
      case 'subscription.synced':
        out.push(['sync', e.subscriptionRef, e.status, e.periodStart, e.periodEnd, e.cancelAtPeriodEnd, e.occurredAt]);
        out.push(['apply', e.eventId, 'other', null, null, e.payloadSha256]);
        break;
      case 'payment.captured': case 'payment.failed': case 'tax.location_required': case 'other': {
        const kind = LEGACY_KIND[e.type];
        if (e.invoice) {
          const i = e.invoice;
          out.push(['invoice', e.eventId, kind, i.subscriptionRef, i.invoiceRef, i.status, i.subtotalCents, i.taxCents, i.currency,
            i.issuedAt, i.dueAt, e.occurredAt, i.rank, e.amountCents, e.payloadSha256]);
        } else {
          out.push(['apply', e.eventId, kind, null, e.amountCents, e.payloadSha256]);
        }
        break;
      }
      case 'refund.succeeded':
        out.push(['apply', e.eventId, 'refund', null, e.amountCents, e.payloadSha256]);
        break;
      case 'dispute.opened':
        out.push(['apply', e.eventId, 'chargeback', null, e.amountCents, e.payloadSha256]);
        break;
    }
  }
  return out;
}

async function normalized(body: string): Promise<NormalizedPaymentEvent[]> {
  const adapter = createStripeAdapter({ apiKey: KEY, webhookSecret: SECRET })!;
  const v = await adapter.verifyWebhook({ rawBody: body, headers: new Headers({ 'Stripe-Signature': sign(body) }), nowSeconds: NOW });
  if (!v.ok) throw new Error(`refused: ${v.refusal}`);
  return adapter.normalize(v.value);
}

const cases: Array<[string, string]> = [
  ['an invoice payment failure', event('invoice.payment_failed', { id: 'in_1', subscription: 'sub_1', amount_due: 799, currency: 'usd', created: NOW - 60 })],
  ['a paid invoice with tax listed in total_taxes', event('invoice.paid', {
    id: 'in_paid', subscription: 'sub_1', amount_paid: 864, subtotal_excluding_tax: 799, total_taxes: [{ amount: 65 }], currency: 'usd', created: NOW - 60 })],
  ['a succeeded invoice with the older total_tax_amounts shape', event('invoice.payment_succeeded', {
    id: 'in_old', subscription: 'sub_1', amount_paid: 864, subtotal: 864, total_tax_amounts: [{ amount: 65 }, { amount: 10 }], currency: 'usd', created: NOW - 60, due_date: NOW + 86400 })],
  ['a finalization failure that needs the customer’s location', event('invoice.finalization_failed', {
    id: 'in_tax', subscription: 'sub_1', amount_due: 815, subtotal_excluding_tax: 799, total_excluding_tax: 750,
    total_taxes: [{ amount: 65 }], currency: 'usd', created: NOW - 60, automatic_tax: { status: 'requires_location_inputs' } })],
  ['a finalization failure that is a tax outage', event('invoice.finalization_failed', {
    id: 'in_outage', subscription: 'sub_1', amount_due: 799, subtotal_excluding_tax: 799, total_taxes: [], currency: 'usd', created: NOW - 60,
    automatic_tax: { status: 'failed' } })],
  ['an invoice whose subscription is under parent.subscription_details', event('invoice.paid', {
    id: 'in_new', parent: { subscription_details: { subscription: 'sub_new' } }, amount_paid: 799, currency: 'usd', created: NOW - 60 })],
  ['an invoice whose subscription is an expanded object', event('invoice.paid', {
    id: 'in_exp', subscription: { id: 'sub_exp' }, amount_paid: 799, currency: 'usd', created: NOW - 60 })],
  ['an invoice event with no subscription at all', event('invoice.payment_failed', { id: 'in_nosub', amount_due: 799, currency: 'usd', created: NOW - 60 })],
  ['an invoice event with no id', event('invoice.paid', { subscription: 'sub_1', amount_paid: 799 })],
  ['an invoice with a non-numeric amount', event('invoice.paid', { id: 'in_nan', subscription: 'sub_1', amount_paid: 'lots', currency: 'usd' })],
  ['a completed subscription checkout', event('checkout.session.completed', {
    client_reference_id: CHECKOUT, mode: 'subscription', subscription: 'sub_1', customer: 'cus_1' })],
  ['a completed checkout named only in metadata', event('checkout.session.completed', {
    metadata: { semester_checkout_id: CHECKOUT }, mode: 'subscription', subscription: { id: 'sub_m' }, customer: { id: 'cus_m' } })],
  ['a completed checkout that is not a subscription', event('checkout.session.completed', { client_reference_id: CHECKOUT, mode: 'payment' })],
  ['a completed checkout with a client reference that is not a uuid', event('checkout.session.completed', { client_reference_id: 'not-a-uuid', mode: 'subscription' })],
  ['a subscription update with the period on the subscription', event('customer.subscription.updated', {
    id: 'sub_1', status: 'active', current_period_start: NOW - 100, current_period_end: NOW + 2592000, cancel_at_period_end: true })],
  ['a subscription update with the period on its items', event('customer.subscription.updated', {
    id: 'sub_1', status: 'past_due', items: { data: [{ current_period_start: NOW - 100, current_period_end: NOW + 100 }] } })],
  ['a subscription deletion', event('customer.subscription.deleted', { id: 'sub_1', status: 'canceled' })],
  ['a subscription deletion that still reports an active status', event('customer.subscription.deleted', { id: 'sub_1', status: 'active' })],
  ['a subscription whose status is unknown', event('customer.subscription.updated', { id: 'sub_1', status: 'something_new' })],
  ['a subscription with no id', event('customer.subscription.updated', { status: 'active' })],
  ['a refund', event('charge.refunded', { amount_refunded: 799 })],
  ['a refund with no amount', event('charge.refunded', {})],
  ['a dispute', event('charge.dispute.created', { amount: 799 })],
  ['an event of a type nobody handles', event('customer.created', { id: 'cus_1' })],
  ['an event with no object at all', JSON.stringify({ id: 'evt_n', type: 'ping', livemode: false, created: NOW - 5 })],
];

describe('the Stripe normalizer reads an event exactly as the webhook handler does', () => {
  for (const [name, body] of cases) {
    it(`hands the database the same facts for ${name}`, async () => {
      expect(callsFrom(await normalized(body))).toEqual(await legacy(body));
    });
  }

  it('is not trivially equal: the handler and the normalizer each make the calls the table says', async () => {
    // The control. If both sides were empty, or both ignored the event, every
    // case above would pass. These pin real tuples on each side.
    const body = event('invoice.payment_failed', { id: 'in_1', subscription: 'sub_1', amount_due: 799, currency: 'usd', created: NOW - 60 });
    const sha = createHash('sha256').update(body).digest('hex');
    const expected = [['invoice', 'evt_p1', 'payment_failed', 'sub_1', 'in_1', 'open', 799, 0, 'usd',
      expect.any(String), expect.any(String), new Date((NOW - 5) * 1000).toISOString(), 1, 799, sha]];
    expect(await legacy(body)).toEqual(expected);
    expect(callsFrom(await normalized(body))).toEqual(expected);
  });

  it('turns a finalization failure that is not a missing location into `other`, never a payment failure', async () => {
    const body = event('invoice.finalization_failed', { id: 'in_o', subscription: 'sub_1', amount_due: 799, currency: 'usd', automatic_tax: { status: 'failed' } });
    const [e] = await normalized(body);
    expect(e.type).toBe('other');
    expect(e.type === 'other' && e.invoice?.rank).toBe(0);
  });

  it('never throws on shapes it was not written for', async () => {
    for (const object of [{}, { id: 7 }, { subscription: 3, amount_due: -1 }, { items: { data: 'x' } }, { total_taxes: 'x' }]) {
      for (const type of ['invoice.paid', 'customer.subscription.updated', 'checkout.session.completed', 'charge.refunded']) {
        await expect(normalized(event(type, object as Record<string, unknown>))).resolves.toBeInstanceOf(Array);
      }
    }
  });
});
