import { describe, expect, it, vi } from 'vitest';
import { handleBillingPortal, type PortalDeps } from '../../../../supabase/functions/_shared/billingportal';

const APP = 'https://semester.example';

function deps(over: Partial<PortalDeps> = {}): PortalDeps {
  return {
    stripeKey: 'sk_test_x',
    portalConfigurationId: 'bpc_123456',
    allowedOrigin: APP,
    returnUrl: `${APP}/account`,
    customerForToken: vi.fn(async (token) => token === 'good-token' ? 'cus_123456' : null),
    fetch: vi.fn(async () => new Response(JSON.stringify({
      url: 'https://billing.stripe.com/p/session/test_123', livemode: false,
    }), { status: 200 })) as unknown as typeof fetch,
    ...over,
  };
}

const post = (headers: Record<string, string> = {}) => new Request('https://project.supabase.co/functions/v1/billing-portal', {
  method: 'POST', headers: { Origin: APP, Authorization: 'Bearer good-token', ...headers }, body: '{}',
});

describe('billing portal', () => {
  it('is off until the provider key is set and fails closed on origin', async () => {
    expect((await handleBillingPortal(post(), deps({ stripeKey: undefined }))).status).toBe(503);
    const d = deps({ allowedOrigin: 'https://other.example' });
    expect((await handleBillingPortal(post(), d)).status).toBe(403);
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it('requires the caller and their own Stripe customer', async () => {
    expect((await handleBillingPortal(post({ Authorization: '' }), deps())).status).toBe(401);
    expect((await handleBillingPortal(post(), deps({ customerForToken: vi.fn(async () => null) }))).status).toBe(404);
    expect((await handleBillingPortal(post(), deps({ customerForToken: vi.fn(async () => 'acct_someone_else') }))).status).toBe(404);
  });

  it('creates a short-lived hosted session for the resolved customer', async () => {
    const d = deps();
    const res = await handleBillingPortal(post(), d);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://billing.stripe.com/p/session/test_123' });
    const [url, init] = vi.mocked(d.fetch).mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.stripe.com/v1/billing_portal/sessions');
    const form = new URLSearchParams(init.body as string);
    expect(form.get('customer')).toBe('cus_123456');
    expect(form.get('configuration')).toBe('bpc_123456');
    expect(form.get('return_url')).toBe(`${APP}/account`);
  });

  it('refuses a mismatched payment environment or unsafe return URL', async () => {
    const live = deps({ stripeKey: 'sk_live_x' });
    expect((await handleBillingPortal(post(), live)).status).toBe(502);
    const unsafe = deps({ returnUrl: 'https://evil.example/account' });
    expect((await handleBillingPortal(post(), unsafe)).status).toBe(503);
    expect(unsafe.fetch).not.toHaveBeenCalled();
  });

  it('requires a configured app return path and accepts it from any allowed origin', async () => {
    const missing = deps({ returnUrl: undefined });
    expect((await handleBillingPortal(post(), missing)).status).toBe(503);
    expect(missing.fetch).not.toHaveBeenCalled();
    const secondary = deps({
      allowedOrigin: `${APP},https://account.semester.example`,
      returnUrl: 'https://account.semester.example/semester/#/account',
    });
    expect((await handleBillingPortal(post(), secondary)).status).toBe(200);
  });
});
