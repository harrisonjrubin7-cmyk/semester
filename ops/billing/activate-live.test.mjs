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

test('an empty Stripe success response stays a controlled provider error', async () => {
  await assert.rejects(activateLive(env, {
    apply: true,
    fetch: async () => new Response(null, { status: 200 }),
  }), /Stripe returned an unreadable response/);
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
  assert.deepEqual(calls, ['GET', 'GET', 'GET', 'GET', 'GET', 'GET', 'GET', 'GET']);
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
        payment_method_update: { enabled: true }, customer_update: { enabled: true, allowed_updates: ['address'] },
        subscription_update: { enabled: false }, subscription_cancel: { enabled: false } } }], has_more: false });
    return response({ data: [], has_more: false });
  } });
  assert.equal(result.portalConfigured, true);
  assert.equal(calls.some(call => call.method === 'POST'), false);
});

test('does not accept a portal that can change or cancel the Semester subscription', async () => {
  const result = await activateLive(env, { fetch: async (url) => {
    if (url.endsWith('/account')) return response({ id: 'acct_1', charges_enabled: true, details_submitted: true });
    if (url.endsWith(`/tax_codes/${env.STRIPE_PRODUCT_TAX_CODE}`)) return response({ id: env.STRIPE_PRODUCT_TAX_CODE });
    if (url.endsWith('/tax/settings')) return response({ status: 'active', defaults: { tax_behavior: 'exclusive' } });
    if (url.includes('/billing_portal/configurations')) return response({ data: [{ id: 'bpc_unsafe', active: true,
      metadata: { semester_product: 'semester' }, features: { invoice_history: { enabled: true },
        payment_method_update: { enabled: true }, customer_update: { enabled: true, allowed_updates: ['address'] },
        subscription_update: { enabled: true }, subscription_cancel: { enabled: true } } }], has_more: false });
    return response({ data: [], has_more: false });
  } });
  assert.equal(result.portalConfigured, false);
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
    // A new origin is not allowed until activation publishes it. The deployed
    // contract header must still let the safe 403 preflight prove code version.
    if (url.endsWith('/billing-checkout') && init.method === 'OPTIONS') return new Response(null, { status: 403,
      headers: { 'X-Semester-Billing-Contract': 'plus-v2' } });
    if (url.endsWith('/secrets')) return new Response(null, { status: 201 });
    if (url.endsWith('/billing-checkout') && init.method === 'POST') return response(
      { error: 'Checkout is not available yet.' }, 503, { 'X-Semester-Billing-Contract': 'plus-v2' });
    if (url.endsWith('/billing_portal/configurations')) return response({ id: 'bpc_bad', active: false, features: {} });
    throw new Error(`unexpected call to ${url}`);
  } }), /usable billing portal/);
  assert.equal(calls.some(call => call.method === 'POST' && call.url.endsWith('/webhook_endpoints')), false);
});

test('refuses to publish a live key until the deployed checkout proves it is tax-aware', async () => {
  const calls = [];
  await assert.rejects(activateLive(env, { apply: true, fetch: async (url, init) => {
    calls.push({ url, method: init.method || 'GET' });
    if (url.endsWith('/account')) return response({ id: 'acct_1', charges_enabled: true, details_submitted: true });
    if (url.endsWith(`/tax_codes/${env.STRIPE_PRODUCT_TAX_CODE}`)) return response({ id: env.STRIPE_PRODUCT_TAX_CODE });
    if (url.endsWith('/tax/settings')) return response({ status: 'active', defaults: { tax_behavior: 'exclusive' } });
    if (url.includes('/tax/registrations') || url.includes('/checkout/sessions?') ||
        url.includes('/billing_portal/configurations?') || url.includes('webhook_endpoints?'))
      return response({ data: [], has_more: false });
    if (url.endsWith('/billing-checkout') && init.method === 'OPTIONS') return new Response(null, { status: 204,
      headers: { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN } });
    throw new Error(`unexpected call to ${url}`);
  } }), /plus-v2 tax-aware checkout/);
  assert.equal(calls.some(call => call.method === 'POST'), false);
});

test('blocks a completed legacy checkout while its subscription still uses the old tax contract', async () => {
  const calls = [];
  await assert.rejects(activateLive(env, { apply: true, fetch: async (url, init) => {
    calls.push({ url, method: init.method || 'GET' });
    if (url.endsWith('/account')) return response({ id: 'acct_1', charges_enabled: true, details_submitted: true });
    if (url.endsWith(`/tax_codes/${env.STRIPE_PRODUCT_TAX_CODE}`)) return response({ id: env.STRIPE_PRODUCT_TAX_CODE });
    if (url.endsWith('/tax/settings')) return response({ status: 'active', defaults: { tax_behavior: 'exclusive' } });
    if (url.includes('/tax/registrations') || url.includes('status=open')) return response({ data: [], has_more: false });
    if (url.includes('status=complete')) return response({ data: [{ id: 'cs_live_old', subscription: 'sub_old',
      metadata: { semester_checkout_id: 'old', semester_tax_contract: 'plus-v1' } }], has_more: false });
    if (url.includes('/subscriptions/sub_old?')) return response({
      id: 'sub_old', status: 'active', automatic_tax: { enabled: true },
      metadata: { semester_tax_contract: 'plus-v2', semester_tax_code: env.STRIPE_PRODUCT_TAX_CODE },
      items: { data: [{ price: { product: { id: 'prod_old', tax_code: 'txcd_99999999' } } }] },
    });
    throw new Error(`unexpected call to ${url}`);
  } }), /older tax contract/);
  assert.equal(calls.some(call => call.method === 'POST'), false);
});

test('blocks a current checkout whose live subscription drifted from the tax contract', async () => {
  const calls = [];
  await assert.rejects(activateLive(env, { apply: true, fetch: async (url, init) => {
    calls.push({ url, method: init.method || 'GET' });
    if (url.endsWith('/account')) return response({ id: 'acct_1', charges_enabled: true, details_submitted: true });
    if (url.endsWith(`/tax_codes/${env.STRIPE_PRODUCT_TAX_CODE}`)) return response({ id: env.STRIPE_PRODUCT_TAX_CODE });
    if (url.endsWith('/tax/settings')) return response({ status: 'active', defaults: { tax_behavior: 'exclusive' } });
    if (url.includes('/tax/registrations') || url.includes('status=open')) return response({ data: [], has_more: false });
    if (url.includes('status=complete')) return response({ data: [{ id: 'cs_live_current', subscription: 'sub_current',
      metadata: { semester_checkout_id: 'current', semester_tax_contract: 'plus-v2',
        semester_tax_code: env.STRIPE_PRODUCT_TAX_CODE } }], has_more: false });
    if (url.includes('/subscriptions/sub_current?')) return response({
      id: 'sub_current', status: 'active', automatic_tax: { enabled: false },
      metadata: { semester_tax_contract: 'plus-v2', semester_tax_code: env.STRIPE_PRODUCT_TAX_CODE },
      items: { data: [{ price: { product: { id: 'prod_current', tax_code: env.STRIPE_PRODUCT_TAX_CODE } } }] },
    });
    throw new Error(`unexpected call to ${url}`);
  } }), /older tax contract/);
  assert.equal(calls.some(call => call.method === 'POST'), false);
});

test('rejects restricted keys before calling any provider', async () => {
  let calls = 0;
  await assert.rejects(activateLive({ ...env, STRIPE_SECRET_KEY: 'rk_live_readonly' }, {
    apply: true, fetch: async () => { calls += 1; return response({}); },
  }), /full live STRIPE_SECRET_KEY/);
  assert.equal(calls, 0);
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
  assert.deepEqual(calls, ['GET', 'GET', 'GET', 'GET', 'GET', 'GET', 'GET', 'GET', 'GET']);
});

test('activates one endpoint, writes secrets only to Supabase, probes without charging', async () => {
  const calls = [];
  let legacyOpen = true;
  let checkoutEnabled = true;
  let failFinalConnection = false;
  const fetch = async (url, init) => {
    calls.push({ url, method: init.method || 'GET', body: init.body });
    if (url.endsWith('/account')) return response({ id: 'acct_1', charges_enabled: true, details_submitted: true });
    if (url.endsWith(`/tax_codes/${env.STRIPE_PRODUCT_TAX_CODE}`)) return response({ id: env.STRIPE_PRODUCT_TAX_CODE });
    if (url.endsWith('/tax/settings')) return response({ status: 'active', defaults: { tax_behavior: 'exclusive' } });
    if (url.includes('/tax/registrations')) return response({ data: [], has_more: false });
    if (url.endsWith('/billing-checkout') && init.method === 'OPTIONS') return new Response(null, { status: 204,
      headers: { 'X-Semester-Billing-Contract': 'plus-v2', 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN } });
    if (url.includes('status=open')) return response({ data: legacyOpen ? [{ id: 'cs_live_legacy',
      metadata: { semester_checkout_id: 'old-checkout', semester_tax_contract: 'plus-v2',
        semester_tax_code: 'txcd_99999999' }, status: 'open' }] : [], has_more: false });
    if (url.includes('status=complete')) return response({ data: [], has_more: false });
    if (url.endsWith('/checkout/sessions/cs_live_legacy/expire')) {
      legacyOpen = false;
      return response({ id: 'cs_live_legacy', status: 'expired' });
    }
    if (url.includes('/billing_portal/configurations?')) return response({ data: [], has_more: false });
    if (url.endsWith('/billing_portal/configurations')) return response({ id: 'bpc_1', active: true,
      features: { invoice_history: { enabled: true }, payment_method_update: { enabled: true },
        customer_update: { enabled: true, allowed_updates: ['address'] },
        subscription_update: { enabled: false }, subscription_cancel: { enabled: false } } });
    if (url.endsWith('/billing_portal/sessions')) return response({
      error: { code: 'resource_missing', param: 'customer' },
    }, 400);
    if (url.includes('webhook_endpoints?')) return response({ data: [], has_more: false });
    if (url.endsWith('/webhook_endpoints')) return response({ id: 'we_semester', secret: 'whsec_abc', livemode: true, status: 'enabled' });
    if (url.endsWith('/secrets')) {
      const secrets = JSON.parse(init.body);
      const gate = secrets.find(secret => secret.name === 'BILLING_LIVE_ENABLED');
      if (gate) checkoutEnabled = gate.value === 'true';
      return new Response(null, { status: 201 });
    }
    if (url.endsWith('/billing-webhook')) {
      const event = JSON.parse(init.body);
      return event.type === 'invoice.finalization_failed'
        ? response({ error: 'Not ready for this event.' }, 500)
        : response({ error: 'Not an event.' }, 400);
    }
    if (url.endsWith('/billing-checkout') && init.method === 'POST') {
      if (checkoutEnabled && failFinalConnection) throw new Error('network down');
      return checkoutEnabled
        ? response({ error: 'Sign in.' }, 401, { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
          'X-Semester-Billing-Contract': 'plus-v2' })
        : response({ error: 'Checkout is not available yet.' }, 503, { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
          'X-Semester-Billing-Contract': 'plus-v2' });
    }
    return response({ error: 'Sign in.' }, 401, { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN });
  };
  const result = await activateLive(env, { apply: true, fetch });
  assert.equal(result.state, 'configured');
  assert.equal(result.taxReady, true);
  assert.equal(result.portalConfigured, true);
  assert.equal(result.expiredLegacyCheckoutSessions, 1);
  assert.equal(result.paymentsVerified, false);
  const secretWrites = calls.filter(call => call.url.endsWith('/secrets'));
  const stored = JSON.parse(secretWrites.find(call => call.body.includes('STRIPE_SECRET_KEY')).body);
  assert.deepEqual(stored.map(secret => secret.name), [
    'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'ALLOWED_ORIGIN',
    'CHECKOUT_RETURN_URL', 'STRIPE_PORTAL_CONFIGURATION_ID', 'STRIPE_PRODUCT_TAX_CODE', 'BILLING_LIVE_ENABLED',
  ]);
  assert.equal(stored.find(secret => secret.name === 'STRIPE_PORTAL_CONFIGURATION_ID').value, 'bpc_1');
  assert.equal(stored.find(secret => secret.name === 'STRIPE_PRODUCT_TAX_CODE').value, env.STRIPE_PRODUCT_TAX_CODE);
  assert.equal(stored.find(secret => secret.name === 'BILLING_LIVE_ENABLED').value, 'false');
  assert.equal(JSON.parse(secretWrites.at(-1).body)[0].value, 'true');
  const enableIndex = calls.findIndex(call => call.url.endsWith('/secrets') &&
    JSON.parse(call.body).some(secret => secret.name === 'BILLING_LIVE_ENABLED' && secret.value === 'true'));
  assert.ok(enableIndex >= 0);
  for (const name of ['billing-cancel', 'billing-portal']) {
    const probeIndex = calls.findIndex(call => call.url.endsWith(`/${name}`) && call.method === 'POST');
    assert.ok(probeIndex >= 0 && probeIndex < enableIndex);
  }
  const rpcProbeIndex = calls.findIndex(call => call.url.endsWith('/billing-webhook') &&
    JSON.parse(call.body).type === 'invoice.finalization_failed');
  assert.ok(rpcProbeIndex >= 0 && rpcProbeIndex < enableIndex);
  const portalBody = new URLSearchParams(calls.find(call => call.url.endsWith('/billing_portal/configurations')).body);
  assert.equal(portalBody.get('metadata[semester_product]'), 'semester');
  assert.equal(portalBody.get('features[customer_update][enabled]'), 'true');
  assert.equal(portalBody.get('features[customer_update][allowed_updates][0]'), 'address');
  assert.equal(portalBody.get('features[subscription_update][enabled]'), 'false');
  assert.equal(portalBody.get('features[subscription_cancel][enabled]'), 'false');
  assert.equal(calls.filter(call => call.url.endsWith('/webhook_endpoints')).length, 1);
  assert.ok(calls.findIndex(call => call.url.endsWith('/billing_portal/configurations')) <
    calls.findIndex(call => call.url.endsWith('/webhook_endpoints')));
  const expiration = calls.find(call => call.url.endsWith('/checkout/sessions/cs_live_legacy/expire'));
  assert.equal(expiration.method, 'POST');
  assert.ok(calls.indexOf(expiration) < calls.findIndex(call =>
    call.url.endsWith('/secrets') && call.body.includes('STRIPE_SECRET_KEY')));
  assert.equal(calls.some(call => /payment_intents/.test(call.url)), false);
  assert.equal(JSON.stringify(result).includes('whsec_'), false);
  assert.equal(JSON.stringify(result).includes('sk_live_'), false);

  failFinalConnection = true;
  await assert.rejects(activateLive(env, { apply: true, fetch }), /disabled again/);
  assert.equal(checkoutEnabled, false);
  assert.equal(JSON.parse(calls.filter(call => call.url.endsWith('/secrets')).at(-1).body)[0].value, 'false');
});
