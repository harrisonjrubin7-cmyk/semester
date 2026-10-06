/// <reference types="node" />
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { handleBillingWebhook, type WebhookDeps } from '../../../../supabase/functions/_shared/billingwebhook';
import { createStripeAdapter } from '../../../../supabase/functions/_shared/payments/stripeadapter';
import type { NormalizedPaymentEvent } from '../../../../supabase/functions/_shared/payments/types';
import { cases, event, KEY, NOW, SECRET, sign } from './stripefixtures';
import golden from './stripe.golden.json';

/**
 * The normalizer is the webhook handler's old reading of an event, lifted out,
 * and the handler now reads through it. The claim worth proving is that nothing
 * the database is told changed.
 *
 * `stripe.golden.json` is what the handler handed the database for each of the
 * events in `stripefixtures.ts`, **recorded before the handler was moved behind
 * the adapter**. Both sides are held to it: the handler as it is now, and the
 * normalizer's events turned back into the same call tuples. A comparison of the
 * handler with the normalizer would prove nothing once they share code; a frozen
 * record of the old behaviour is the one oracle that does not.
 */

type Call = unknown[];

/** What the handler, as it is now, hands the database for one event. */
async function handlerCalls(body: string): Promise<Call[]> {
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


const golden_ = golden as unknown as Record<string, Call[]>;

describe('the Stripe normalizer and the webhook handler hand the database what the handler handed it before the move', () => {
  it('has a golden record for every event, and no record for an event that is gone', () => {
    expect(Object.keys(golden_).sort()).toEqual(cases.map(([name]) => name).sort());
  });

  for (const [name, body] of cases) {
    it(`handler: ${name}`, async () => {
      expect(await handlerCalls(body)).toEqual(golden_[name]);
    });
    it(`normalizer: ${name}`, async () => {
      expect(callsFrom(await normalized(body))).toEqual(golden_[name]);
    });
  }

  it('is not trivially equal: the handler and the normalizer each make the calls the table says', async () => {
    // The control. If both sides were empty, or both ignored the event, every
    // case above would pass. These pin real tuples on each side.
    const body = event('invoice.payment_failed', { id: 'in_1', subscription: 'sub_1', amount_due: 799, currency: 'usd', created: NOW - 60 });
    const sha = createHash('sha256').update(body).digest('hex');
    const expected = [['invoice', 'evt_p1', 'payment_failed', 'sub_1', 'in_1', 'open', 799, 0, 'usd',
      expect.any(String), expect.any(String), new Date((NOW - 5) * 1000).toISOString(), 1, 799, sha]];
    expect(await handlerCalls(body)).toEqual(expected);
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
