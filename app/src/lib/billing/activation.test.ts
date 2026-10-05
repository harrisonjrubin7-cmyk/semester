import { describe, expect, it, vi } from 'vitest';
import { checkoutSessionMatches, stripeMode } from '../../../../supabase/functions/_shared/billingmode';
import { handleBillingCheckout, type CheckoutDeps } from '../../../../supabase/functions/_shared/billingcheckout';
import { handleBillingWebhook, type WebhookDeps } from '../../../../supabase/functions/_shared/billingwebhook';
import { hmacSha256Hex } from '../../../../supabase/functions/_shared/stripe';

describe('payment environment boundaries', () => {
  it('recognizes secret and restricted keys without accepting public or malformed keys', () => {
    expect(stripeMode('sk_live_abc')).toBe('live');
    expect(stripeMode('rk_test_abc')).toBe('test');
    for (const key of [undefined, '', 'pk_live_abc', 'sk_live_', 'sk_test_a b']) expect(stripeMode(key)).toBeNull();
  });

  it('accepts only a Stripe hosted checkout in the configured environment', () => {
    const session = { id: 'cs_live_abc', url: 'https://checkout.stripe.com/c/pay/cs_live_abc', livemode: true };
    expect(checkoutSessionMatches(session, 'sk_live_abc')).toBe(true);
    expect(checkoutSessionMatches(session, 'sk_test_abc')).toBe(false);
    for (const url of ['http://checkout.stripe.com/c/pay/x', 'https://checkout.stripe.com.evil.example/x', 'https://evil.example/x', 'https://user@checkout.stripe.com/x', 'https://checkout.stripe.com:444/x', 'garbage'])
      expect(checkoutSessionMatches({ ...session, url }, 'sk_live_abc')).toBe(false);
    expect(checkoutSessionMatches({ ...session, livemode: undefined }, 'sk_live_abc')).toBe(false);
    expect(checkoutSessionMatches({ ...session, id: 'cs_test_abc' }, 'sk_live_abc')).toBe(false);
  });

  it('never attaches a test checkout to a live billing account', async () => {
    const deps: CheckoutDeps = {
      liveEnabled: true,
      stripeKey: 'sk_live_abc', taxCode: 'txcd_10103000',
      allowedOrigin: 'https://semester.example', returnUrl: undefined,
      userFromToken: async () => 'user',
      begin: async () => ({ outcome: 'ok', checkout_id: 'checkout', billing_account_id: 'acct', customer_ref: null,
        email: 'test@example.edu', plan_name: 'Plus', amount_cents: 799, currency: 'usd', billing_interval: 'month' }),
      attach: vi.fn(), fetch: vi.fn(async () => new Response(JSON.stringify({ id: 'cs_test_abc', livemode: false,
        url: 'https://checkout.stripe.com/c/pay/cs_test_abc' }))) as unknown as typeof fetch,
    };
    const res = await handleBillingCheckout(new Request('https://project.example', { method: 'POST',
      headers: { Origin: 'https://semester.example', Authorization: 'Bearer token' },
      body: JSON.stringify({ price_id: '0b1c2d3e-4f50-4617-8829-3a4b5c6d7e8f', consent: true, consent_text_version: 'plus-v2' }),
    }), deps);
    expect(res.status).toBe(502);
    expect(deps.attach).not.toHaveBeenCalled();
  });

  it('rejects even correctly signed test events before any live entitlement mutation', async () => {
    const body = JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed', created: 1790000000,
      livemode: false, data: { object: { client_reference_id: '0b1c2d3e-4f50-4617-8829-3a4b5c6d7e8f', mode: 'subscription' } } });
    const deps: WebhookDeps = { secret: 'whsec_abc', stripeKey: 'sk_live_abc', now: () => 1790000000,
      completeCheckout: vi.fn(), syncSubscription: vi.fn(), applyInvoiceEvent: vi.fn(), applyEvent: vi.fn() };
    const signature = await hmacSha256Hex('whsec_abc', `1790000000.${body}`);
    const request = new Request('https://project.example', { method: 'POST', body,
      headers: { 'Stripe-Signature': `t=1790000000,v1=${signature}` } });
    expect((await handleBillingWebhook(request, deps)).status).toBe(400);
    for (const callback of [deps.completeCheckout, deps.syncSubscription, deps.applyInvoiceEvent, deps.applyEvent]) expect(callback).not.toHaveBeenCalled();
  });
});
