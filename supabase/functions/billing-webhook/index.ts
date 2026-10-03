/**
 * The payment provider's webhook.
 *
 * Everything this function decides is in `../_shared/billingwebhook.ts`, which
 * `app/src/lib/billing/webhook.test.ts` drives branch by branch. This file only
 * wires in the service-key client that calls the service-only SQL functions in
 * `20260929080000_commercial_automation.sql`.
 *
 * `verify_jwt` is off (supabase/config.toml) because Stripe has no Supabase
 * token; the `Stripe-Signature` over the raw body is the credential. Off
 * (503) until `STRIPE_WEBHOOK_SECRET` is set. See `docs/COMMERCIAL-CORE.md`.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleBillingWebhook } from '../_shared/billingwebhook.ts';

const db = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
);

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(`${fn} failed`);
  return data as T;
}

Deno.serve((req) =>
  handleBillingWebhook(req, {
    secret: Deno.env.get('STRIPE_WEBHOOK_SECRET'),
    stripeKey: Deno.env.get('STRIPE_SECRET_KEY') ?? Deno.env.get('STRIPE_API_KEY'),
    now: () => Math.floor(Date.now() / 1000),
    completeCheckout: (checkout, subscriptionRef, customerRef) =>
      call('complete_checkout', {
        want_checkout: checkout, want_subscription_ref: subscriptionRef, want_customer_ref: customerRef, want_period_end: null,
      }),
    syncSubscription: (ref, status, start, end, cancelAtPeriodEnd, eventAt) =>
      call('sync_provider_subscription', {
        want_ref: ref, want_status: status, want_period_start: start, want_period_end: end,
        want_cancel_at_period_end: cancelAtPeriodEnd, want_event_at: eventAt,
      }),
    applyInvoiceEvent: (eventId, kind, subscriptionRef, invoiceRef, invoiceStatus, subtotal, tax, currency, issuedAt, dueAt, snapshotAt, snapshotRank, amount, sha) =>
      call<string>('apply_invoice_payment_event_v3', {
        want_provider: 'stripe', want_event_id: eventId, want_kind: kind,
        want_subscription_ref: subscriptionRef, want_invoice_ref: invoiceRef,
        want_invoice_status: invoiceStatus,
        want_subtotal_cents: subtotal, want_tax_cents: tax,
        want_currency: currency, want_issued_at: issuedAt, want_due_at: dueAt,
        want_snapshot_at: snapshotAt, want_snapshot_rank: snapshotRank,
        want_amount_cents: amount, want_payload_sha256: sha,
      }),
    applyEvent: (eventId, kind, invoiceId, amount, sha) =>
      call<string>('apply_payment_event', {
        want_provider: 'stripe', want_event_id: eventId, want_kind: kind, want_invoice: invoiceId,
        want_amount_cents: amount, want_payload_sha256: sha,
      }),
  }),
);
