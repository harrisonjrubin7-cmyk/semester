import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activateLive, configuration, EVENTS } from './activate-live.mjs';

const env = { STRIPE_SECRET_KEY: 'sk_live_abc', SUPABASE_ACCESS_TOKEN: 'access-token',
  STRIPE_PRODUCT_TAX_CODE: 'txcd_10103000', ALLOWED_ORIGIN: 'https://harrisonjrubin7-cmyk.github.io' };
const response = (body, status = 200, headers) => new Response(JSON.stringify(body), { status, headers });

test('refuses test keys and unsafe origins without calling any provider', async () => {
  for (const overrides of [{ STRIPE_SECRET_KEY: 'sk_test_abc' }, { ALLOWED_ORIGIN: '*' },
    { STRIPE_PRODUCT_TAX_CODE: '' }, { ALLOWED_ORIGIN: 'https://app.example/path' },
    { CHECKOUT_RETURN_URL: 'https://evil.example/' }]) {
    let calls = 0;
    await assert.rejects(activateLive({ ...env, ...overrides }, { apply: true, fetch: async () => { calls++; return response({}); } }));
    assert.equal(calls, 0);
  }
  assert.equal(configuration(env).project, 'lzrqvlugnawcgywkhqlz');
});

test('an incomplete merchant account makes no mutations', async () => {
  const calls = [];
  await assert.rejects(activateLive(env, { apply: true, fetch: async (url, init) => {
    calls.push(init.method || 'GET'); return response({ id: 'acct_1', charges_enabled: false, details_submitted: true });
  } }), /onboarding/);
  assert.deepEqual(calls, ['GET']);
});

test('a check is read-only and never claims payment verification', async () => {
  const calls = [];
  const result = await activateLive(env, { fetch: async (url, init) => {
    calls.push(init.method || 'GET');
    if (url.endsWith('/account')) return response({ id: 'acct_1', charges_enabled: true, details_submitted: true });
    if (url.endsWith(`/tax_codes/${env.STRIPE_PRODUCT_TAX_CODE}`)) return response({ id: env.STRIPE_PRODUCT_TAX_CODE });
    if (url.endsWith('/tax/settings')) return response({ status: 'active', defaults: { tax_behavior: 'exclusive' } });
    return response({ data: [], has_more: false });
  } });
  assert.deepEqual(calls, ['GET', 'GET', 'GET', 'GET', 'GET', 'GET', 'GET']);
  assert.equal(result.state, 'checked');
  assert.equal(result.taxReady, true);
  assert.equal(result.portalConfigured, false);
  assert.equal(result.paymentsVerified, false);
});

test('apply refuses an incomplete Stripe Tax setup before any mutation', async () => {
  const calls = [];
  await assert.rejects(activateLive(env, { apply: true, fetch: async (url, init) => {
    calls.push(init.method || 'GET');
    if (url.endsWith('/account')) return response({ id: 'acct_1', charges_enabled: true, details_submitted: true });
    if (url.endsWith(`/tax_codes/${env.STRIPE_PRODUCT_TAX_CODE}`)) return response({ id: env.STRIPE_PRODUCT_TAX_CODE });
    return response({ status: 'pending' });
  } }), /Stripe Tax must be active/);
  assert.deepEqual(calls, ['GET', 'GET', 'GET']);
});

test('apply refuses active Stripe Tax without a reviewed default tax behavior', async () => {
  const calls = [];
  await assert.rejects(activateLive(env, { apply: true, fetch: async (url, init) => {
    calls.push(init.method || 'GET');
    if (url.endsWith('/account')) return response({ id: 'acct_1', charges_enabled: true, details_submitted: true });
    if (url.endsWith(`/tax_codes/${env.STRIPE_PRODUCT_TAX_CODE}`)) return response({ id: env.STRIPE_PRODUCT_TAX_CODE });
    return response({ status: 'active', defaults: { tax_behavior: null } });
  } }), /default tax behavior/);
  assert.deepEqual(calls, ['GET', 'GET', 'GET']);
});

test('refuses an unknown live product tax code before any mutation', async () => {
  const calls = [];
  await assert.rejects(activateLive(env, { apply: true, fetch: async (url, init) => {
    calls.push(init.method || 'GET');
    if (url.endsWith('/account')) return response({ id: 'acct_1', charges_enabled: true, details_submitted: true });
    return response({ error: { message: 'No such tax code' } }, 404);
  } }), /Stripe refused the request/);
  assert.deepEqual(calls, ['GET', 'GET']);
});

test('counts every page of active tax registrations', async () => {
  const result = await activateLive(env, { fetch: async (url) => {
    if (url.endsWith('/account')) return response({ id: 'acct_1', charges_enabled: true, details_submitted: true });
    if (url.endsWith(`/tax_codes/${env.STRIPE_PRODUCT_TAX_CODE}`)) return response({ id: env.STRIPE_PRODUCT_TAX_CODE });
    if (url.endsWith('/tax/settings')) return response({ status: 'active', defaults: { tax_behavior: 'inclusive' } });
    if (url.includes('/tax/registrations') && !url.includes('starting_after'))
      return response({ data: [{ id: 'txr_1' }], has_more: true });
    if (url.includes('/tax/registrations')) return response({ data: [{ id: 'txr_2' }], has_more: false });
    return response({ data: [], has_more: false });
  } });
  assert.equal(result.activeTaxRegistrations, 2);
});

test('reuses the tagged non-default Semester portal configuration', async () => {
  const calls = [];
  const result = await activateLive(env, { fetch: async (url, init) => {
    calls.push({ url, method: init.method || 'GET' });
    if (url.endsWith('/account')) return response({ id: 'acct_1', charges_enabled: true, details_submitted: true });
    if (url.endsWith(`/tax_codes/${env.STRIPE_PRODUCT_TAX_CODE}`)) return response({ id: env.STRIPE_PRODUCT_TAX_CODE });
    if (url.endsWith('/tax/settings')) return response({ status: 'active', defaults: { tax_behavior: 'exclusive' } });
    if (url.includes('/tax/registrations')) return response({ data: [], has_more: false });
    if (url.includes('/billing_portal/configurations')) return response({ data: [{ id: 'bpc_semester', active: true,
      is_default: false, metadata: { semester_product: 'semester' }, features: { invoice_history: { enabled: true },
        payment_method_update: { enabled: true }, customer_update: { enabled: true, allowed_updates: ['address'] } } }], has_more: false });
    return response({ data: [], has_more: false });
  } });
  assert.equal(result.portalConfigured, true);
  assert.equal(calls.some(call => call.method === 'POST'), false);
});

test('a portal setup failure cannot create a webhook whose one-time secret would be lost', async () => {
  const calls = [];
  await assert.rejects(activateLive(env, { apply: true, fetch: async (url, init) => {
    calls.push({ url, method: init.method || 'GET' });
    if (url.endsWith('/account')) return response({ id: 'acct_1', charges_enabled: true, details_submitted: true });
    if (url.endsWith(`/tax_codes/${env.STRIPE_PRODUCT_TAX_CODE}`)) return response({ id: env.STRIPE_PRODUCT_TAX_CODE });
    if (url.endsWith('/tax/settings')) return response({ status: 'active', defaults: { tax_behavior: 'exclusive' } });
    if (url.includes('/tax/registrations') || url.includes('/checkout/sessions?') ||
        url.includes('/billing_portal/configurations?') || url.includes('webhook_endpoints?'))
      return response({ data: [], has_more: false });
    if (url.endsWith('/billing_portal/configurations')) return response({ id: 'bpc_bad', active: false, features: {} });
    throw new Error(`unexpected call to ${url}`);
  } }), /usable billing portal/);
  assert.equal(calls.some(call => call.method === 'POST' && call.url.endsWith('/webhook_endpoints')), false);
});

test('existing endpoints require their signing secret and pagination cannot create duplicates', async () => {
  const calls = [];
  await assert.rejects(activateLive(env, { apply: true, fetch: async (url, init) => {
    calls.push(init.method || 'GET');
    if (url.endsWith('/account')) return response({ id: 'acct_1', charges_enabled: true, details_submitted: true });
    if (url.endsWith(`/tax_codes/${env.STRIPE_PRODUCT_TAX_CODE}`)) return response({ id: env.STRIPE_PRODUCT_TAX_CODE });
    if (url.endsWith('/tax/settings')) return response({ status: 'active', defaults: { tax_behavior: 'exclusive' } });
    if (url.includes('/tax/registrations') || url.includes('/billing_portal/configurations') || url.includes('/checkout/sessions?'))
      return response({ data: [], has_more: false });
    if (!url.includes('starting_after')) return response({ data: [{ id: 'we_other', url: 'https://other.example' }], has_more: true });
    return response({ data: [{ id: 'we_semester', url: 'https://lzrqvlugnawcgywkhqlz.supabase.co/functions/v1/billing-webhook',
      livemode: true, status: 'enabled', enabled_events: EVENTS }], has_more: false });
  } }), /cannot be retrieved/);
  assert.deepEqual(calls, ['GET', 'GET', 'GET', 'GET', 'GET', 'GET', 'GET', 'GET']);
});

test('activates one endpoint, writes secrets only to Supabase, probes without charging', async () => {
  const calls = [];
  let legacyOpen = true;
  const result = await activateLive(env, { apply: true, fetch: async (url, init) => {
    calls.push({ url, method: init.method || 'GET', body: init.body });
    if (url.endsWith('/account')) return response({ id: 'acct_1', charges_enabled: true, details_submitted: true });
    if (url.endsWith(`/tax_codes/${env.STRIPE_PRODUCT_TAX_CODE}`)) return response({ id: env.STRIPE_PRODUCT_TAX_CODE });
    if (url.endsWith('/tax/settings')) return response({ status: 'active', defaults: { tax_behavior: 'exclusive' } });
    if (url.includes('/tax/registrations')) return response({ data: [], has_more: false });
    if (url.includes('/checkout/sessions?')) return response({ data: legacyOpen ? [{ id: 'cs_live_legacy',
      metadata: { semester_checkout_id: 'old-checkout' }, status: 'open' }] : [], has_more: false });
    if (url.endsWith('/checkout/sessions/cs_live_legacy/expire')) {
      legacyOpen = false;
      return response({ id: 'cs_live_legacy', status: 'expired' });
    }
    if (url.includes('/billing_portal/configurations?')) return response({ data: [], has_more: false });
    if (url.endsWith('/billing_portal/configurations')) return response({ id: 'bpc_1', active: true,
      features: { invoice_history: { enabled: true }, payment_method_update: { enabled: true },
        customer_update: { enabled: true, allowed_updates: ['address'] } } });
    if (url.includes('webhook_endpoints?')) return response({ data: [], has_more: false });
    if (url.endsWith('/webhook_endpoints')) return response({ id: 'we_semester', secret: 'whsec_abc', livemode: true, status: 'enabled' });
    if (url.endsWith('/secrets')) return response([]);
    if (url.endsWith('/billing-webhook')) return response({ error: 'Not an event.' }, 400);
    return response({ error: 'Sign in.' }, 401, { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN });
  } });
  assert.equal(result.state, 'configured');
  assert.equal(result.taxReady, true);
  assert.equal(result.portalConfigured, true);
  assert.equal(result.expiredLegacyCheckoutSessions, 1);
  assert.equal(result.paymentsVerified, false);
  const stored = JSON.parse(calls.find(call => call.url.endsWith('/secrets')).body);
  assert.deepEqual(stored.map(secret => secret.name), [
    'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'ALLOWED_ORIGIN',
    'CHECKOUT_RETURN_URL', 'STRIPE_PORTAL_CONFIGURATION_ID', 'STRIPE_PRODUCT_TAX_CODE',
  ]);
  assert.equal(stored.find(secret => secret.name === 'STRIPE_PORTAL_CONFIGURATION_ID').value, 'bpc_1');
  assert.equal(stored.find(secret => secret.name === 'STRIPE_PRODUCT_TAX_CODE').value, env.STRIPE_PRODUCT_TAX_CODE);
  const portalBody = new URLSearchParams(calls.find(call => call.url.endsWith('/billing_portal/configurations')).body);
  assert.equal(portalBody.get('metadata[semester_product]'), 'semester');
  assert.equal(portalBody.get('features[customer_update][enabled]'), 'true');
  assert.equal(portalBody.get('features[customer_update][allowed_updates][0]'), 'address');
  assert.equal(calls.filter(call => call.url.endsWith('/webhook_endpoints')).length, 1);
  assert.ok(calls.findIndex(call => call.url.endsWith('/billing_portal/configurations')) <
    calls.findIndex(call => call.url.endsWith('/webhook_endpoints')));
  const expiration = calls.find(call => call.url.endsWith('/checkout/sessions/cs_live_legacy/expire'));
  assert.equal(expiration.method, 'POST');
  assert.ok(calls.indexOf(expiration) < calls.findIndex(call => call.url.endsWith('/secrets')));
  assert.equal(calls.some(call => /payment_intents/.test(call.url)), false);
  assert.equal(JSON.stringify(result).includes('whsec_'), false);
  assert.equal(JSON.stringify(result).includes('sk_live_'), false);
});
