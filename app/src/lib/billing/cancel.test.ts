import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  handleBillingCancel, type CancelDeps, type OwnSubscription,
} from '../../../../supabase/functions/_shared/billingcancel';

const APP = 'https://semester.example';
const SUB: OwnSubscription = {
  id: '3c2b1a09-8f7e-4d6c-9b5a-4e3d2c1b0a9f',
  provider_ref: 'sub_1Q2w3E4r5T6y',
  status: 'active',
  cancel_at_period_end: false,
  current_period_end: '2026-10-29T12:00:00Z',
};

function deps(over: Partial<CancelDeps> = {}) {
  const stripe = vi.fn(async () => new Response(JSON.stringify({ id: SUB.provider_ref, cancel_at_period_end: true }), { status: 200 }));
  const d = {
    stripeKey: 'sk_test_x',
    allowedOrigin: APP,
    ownSubscription: vi.fn(async (t: string, id: string) => (t === 'good-token' && id === SUB.id ? SUB : null)),
    record: vi.fn(async () => SUB.current_period_end),
    fetch: stripe as unknown as typeof fetch,
    ...over,
  };
  return d as CancelDeps & typeof d & { fetch: typeof stripe };
}

const post = (headers: Record<string, string> = {}, body: unknown = { subscription_id: SUB.id }) =>
  new Request('https://project.supabase.co/functions/v1/billing-cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: APP, Authorization: 'Bearer good-token', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

afterEach(() => vi.restoreAllMocks());

describe('billing-cancel', () => {
  it('tells Stripe first, then records it, and says when Plus ends', async () => {
    const d = deps();
    const res = await handleBillingCancel(post(), d);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ends_at: SUB.current_period_end });

    const [url, init] = d.fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.stripe.com/v1/subscriptions/${SUB.provider_ref}`);
    expect(init.body).toBe('cancel_at_period_end=true');
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe(`cancel-${SUB.id}`);
    expect(d.ownSubscription).toHaveBeenCalledWith('good-token', SUB.id);
    expect(d.record).toHaveBeenCalledWith('good-token', SUB.id);
    expect(d.fetch.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(d.record).mock.invocationCallOrder[0]);
  });

  it('records nothing when Stripe does not agree, and says the person is still subscribed', async () => {
    const d = deps({ fetch: vi.fn(async () => new Response('{}', { status: 500 })) as unknown as typeof fetch });
    const res = await handleBillingCancel(post(), d);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/still subscribed/);
    expect(d.record).not.toHaveBeenCalled();
  });

  it('still answers yes when Stripe agreed but the record lagged, since the webhook brings it into line', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const d = deps({ record: vi.fn(async () => { throw new Error('down'); }) });
    const res = await handleBillingCancel(post(), d);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ends_at: SUB.current_period_end });
  });

  it('asks Stripe nothing for a subscription already ending', async () => {
    const d = deps({ ownSubscription: vi.fn(async () => ({ ...SUB, cancel_at_period_end: true })) });
    const res = await handleBillingCancel(post(), d);
    expect(res.status).toBe(200);
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it('refuses without a key, without a token, from an unlisted page, and with nothing to cancel', async () => {
    expect((await handleBillingCancel(post(), deps({ stripeKey: undefined }))).status).toBe(503);
    expect((await handleBillingCancel(post({ Authorization: '' }), deps())).status).toBe(401);
    expect((await handleBillingCancel(post({ Origin: 'https://evil.example' }), deps())).status).toBe(403);
    expect((await handleBillingCancel(post({ Authorization: 'Bearer someone-else' }), deps())).status).toBe(404);
  });

  it('cancels only the subscription the page names, and only if it is the caller\'s', async () => {
    for (const body of [{}, { subscription_id: 'sub_1' }, 'not json', { subscription_id: 42 }]) {
      const d = deps();
      expect((await handleBillingCancel(post({}, body), d)).status).toBe(400);
      expect(d.fetch).not.toHaveBeenCalled();
    }
    const d = deps();
    const other = await handleBillingCancel(post({}, { subscription_id: '00000000-0000-4000-8000-000000000000' }), d);
    expect(other.status).toBe(404);
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it('never puts an unrecognised reference into Stripe’s path', async () => {
    for (const provider_ref of [null, 'sub_../../customers', 'cus_123456']) {
      const d = deps({ ownSubscription: vi.fn(async () => ({ ...SUB, provider_ref })) });
      expect((await handleBillingCancel(post(), d)).status).toBe(409);
      expect(d.fetch).not.toHaveBeenCalled();
    }
  });

  it('answers an allowed preflight even while off, and refuses GET', async () => {
    const pre = new Request('https://project.supabase.co/functions/v1/billing-cancel', { method: 'OPTIONS', headers: { Origin: APP } });
    expect((await handleBillingCancel(pre, deps({ stripeKey: undefined }))).status).toBe(204);
    const get = new Request('https://project.supabase.co/functions/v1/billing-cancel', { method: 'GET', headers: { Origin: APP } });
    expect((await handleBillingCancel(get, deps())).status).toBe(405);
  });
});
