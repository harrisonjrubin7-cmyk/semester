import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  handleBillingCheckout, returnTo, type BeginRow, type CheckoutDeps,
} from '../../../../supabase/functions/_shared/billingcheckout';

const APP = 'https://semester.example';
const PRICE = '0b1c2d3e-4f50-4617-8829-3a4b5c6d7e8f';
const CHECKOUT = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d';

const OK: BeginRow = {
  outcome: 'ok', checkout_id: CHECKOUT, billing_account_id: 'acct', customer_ref: null, email: 'ana@example.edu',
  plan_name: 'Plus', amount_cents: 799, currency: 'usd', billing_interval: 'month',
};

function deps(over: Partial<CheckoutDeps> = {}) {
  const stripe = vi.fn(async () => new Response(JSON.stringify({ id: 'cs_test_1', livemode: false, url: 'https://checkout.stripe.com/c/pay/cs_test_1' }), { status: 200 }));
  const d = {
    liveEnabled: true,
    stripeKey: 'sk_test_x',
    taxCode: 'txcd_10103000',
    allowedOrigin: APP,
    returnUrl: undefined,
    userFromToken: vi.fn(async (t: string) => (t === 'good-token' ? 'user-1' : null)),
    begin: vi.fn(async () => OK),
    attach: vi.fn(async () => {}),
    fetch: stripe as unknown as typeof fetch,
    ...over,
  };
  return d as CheckoutDeps & typeof d & { fetch: typeof stripe };
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('https://project.supabase.co/functions/v1/billing-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: APP, Authorization: 'Bearer good-token', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const GOOD = { price_id: PRICE, consent: true, consent_text_version: 'plus-v2' };

afterEach(() => vi.restoreAllMocks());

describe('billing checkout', () => {
  it('stays off behind the explicit operations gate even when live credentials exist', async () => {
    const d = deps({ liveEnabled: false, stripeKey: 'sk_live_x' });
    const res = await handleBillingCheckout(post(GOOD), d);
    expect(res.status).toBe(503);
    expect(d.begin).not.toHaveBeenCalled();
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it('is off, with a plain sentence, until the provider key is set', async () => {
    const d = deps({ stripeKey: undefined });
    const res = await handleBillingCheckout(post(GOOD), d);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('Checkout is not available yet.');
    expect(d.begin).not.toHaveBeenCalled();
  });

  it('fails closed on CORS: an unlisted origin, *, or nothing configured allows nobody', async () => {
    for (const allowedOrigin of [undefined, '*', 'https://other.example']) {
      const d = deps({ allowedOrigin });
      const res = await handleBillingCheckout(post(GOOD), d);
      expect(res.status, String(allowedOrigin)).toBe(403);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
      expect(d.begin).not.toHaveBeenCalled();
      const pre = await handleBillingCheckout(new Request('https://x', { method: 'OPTIONS', headers: { Origin: APP } }), d);
      expect(pre.status).toBe(403);
      expect(pre.headers.get('Access-Control-Allow-Origin')).toBeNull();
    }
  });

  it('answers the app’s own preflight', async () => {
    const res = await handleBillingCheckout(new Request('https://x', { method: 'OPTIONS', headers: { Origin: APP } }), deps());
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(APP);
    expect(res.headers.get('X-Semester-Billing-Contract')).toBe('plus-v2');
  });

  it('needs a signed-in caller', async () => {
    expect((await handleBillingCheckout(post(GOOD, { Authorization: '' }), deps())).status).toBe(401);
    expect((await handleBillingCheckout(post(GOOD, { Authorization: 'Bearer bad' }), deps())).status).toBe(401);
  });

  it('needs explicit consent, to a named wording, before anything is recorded', async () => {
    for (const body of [
      { ...GOOD, consent: false }, { ...GOOD, consent: 'yes' }, { price_id: PRICE },
      { ...GOOD, consent_text_version: 'Not A Version' },
      { ...GOOD, consent_text_version: 'plus-v1' }, { ...GOOD, price_id: 'plus' },
    ]) {
      const d = deps();
      const res = await handleBillingCheckout(post(body), d);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(d.begin).not.toHaveBeenCalled();
      expect(d.fetch).not.toHaveBeenCalled();
    }
  });

  it('records consent first, then opens a hosted page priced from the catalog', async () => {
    const d = deps();
    const res = await handleBillingCheckout(post(GOOD), d);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_test_1', checkout_id: CHECKOUT });
    expect(d.begin).toHaveBeenCalledWith('user-1', PRICE, 'plus-v2');
    expect(vi.mocked(d.begin!).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(d.fetch!).mock.invocationCallOrder[0]);
    const [url, init] = vi.mocked(d.fetch!).mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk_test_x');
    expect(headers['Idempotency-Key']).toBe(`checkout-v2-txcd_10103000-${CHECKOUT}`);
    const form = new URLSearchParams(init.body as string);
    expect(form.get('mode')).toBe('subscription');
    expect(form.get('client_reference_id')).toBe(CHECKOUT);
    expect(form.get('line_items[0][price_data][unit_amount]')).toBe('799');
    expect(form.get('line_items[0][price_data][recurring][interval]')).toBe('month');
    expect(form.get('line_items[0][price_data][product_data][tax_code]')).toBe('txcd_10103000');
    expect(form.get('automatic_tax[enabled]')).toBe('true');
    expect(form.get('metadata[semester_tax_contract]')).toBe('plus-v2');
    expect(form.get('metadata[semester_tax_code]')).toBe('txcd_10103000');
    expect(form.get('subscription_data[metadata][semester_tax_contract]')).toBe('plus-v2');
    expect(form.get('subscription_data[metadata][semester_tax_code]')).toBe('txcd_10103000');
    expect(form.get('customer_email')).toBe('ana@example.edu');
    expect(form.has('customer_update[address]')).toBe(false);
    expect(form.get('success_url')).toBe(`${APP}/?checkout=success`);
    // No card field is ever part of what Semester sends.
    expect([...form.keys()].some((k) => /card|cvc|number/i.test(k))).toBe(false);
    expect(d.attach).toHaveBeenCalledWith(CHECKOUT, 'cs_test_1');
  });

  it('stays off until an owner-approved Stripe Tax product code is configured', async () => {
    const d = deps({ taxCode: undefined });
    const res = await handleBillingCheckout(post(GOOD), d);
    expect(res.status).toBe(503);
    expect(d.begin).not.toHaveBeenCalled();
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it('lets automatic tax refresh an existing customer address on re-subscribe', async () => {
    const d = deps({ begin: vi.fn(async () => ({ ...OK, customer_ref: 'cus_returning' })) });
    const res = await handleBillingCheckout(post(GOOD), d);
    expect(res.status).toBe(200);
    const [, init] = vi.mocked(d.fetch!).mock.calls[0] as unknown as [string, RequestInit];
    const form = new URLSearchParams(init.body as string);
    expect(form.get('customer')).toBe('cus_returning');
    expect(form.has('customer_email')).toBe(false);
    expect(form.get('customer_update[address]')).toBe('auto');
  });

  it('refuses a price sold by quote, and a second subscription', async () => {
    expect((await handleBillingCheckout(post(GOOD), deps({ begin: vi.fn(async () => ({ ...OK, outcome: 'no_such_price' as const })) }))).status).toBe(404);
    expect((await handleBillingCheckout(post(GOOD), deps({ begin: vi.fn(async () => ({ ...OK, outcome: 'already_subscribed' as const })) }))).status).toBe(409);
  });

  it('says nothing was charged when the provider fails', async () => {
    const d = deps({ fetch: vi.fn(async () => new Response('{}', { status: 500 })) as unknown as typeof fetch });
    const res = await handleBillingCheckout(post(GOOD), d);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain('Nothing was charged');
    expect(d.attach).not.toHaveBeenCalled();
  });

  it('returns the student to the configured page', () => {
    expect(returnTo('https://semester.example/app/#/settings', 'cancel')).toBe('https://semester.example/app/?checkout=cancel#/settings');
  });
});
