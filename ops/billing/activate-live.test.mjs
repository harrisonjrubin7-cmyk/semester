import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activateLive, configuration, EVENTS } from './activate-live.mjs';

const env = { STRIPE_SECRET_KEY: 'sk_live_abc', SUPABASE_ACCESS_TOKEN: 'access-token',
  ALLOWED_ORIGIN: 'https://harrisonjrubin7-cmyk.github.io' };
const response = (body, status = 200, headers) => new Response(JSON.stringify(body), { status, headers });

test('refuses test keys and unsafe origins without calling any provider', async () => {
  for (const overrides of [{ STRIPE_SECRET_KEY: 'sk_test_abc' }, { ALLOWED_ORIGIN: '*' },
    { ALLOWED_ORIGIN: 'https://app.example/path' }, { CHECKOUT_RETURN_URL: 'https://evil.example/' }]) {
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
    return response(url.endsWith('/account') ? { id: 'acct_1', charges_enabled: true, details_submitted: true } : { data: [], has_more: false });
  } });
  assert.deepEqual(calls, ['GET', 'GET']);
  assert.equal(result.state, 'checked');
  assert.equal(result.paymentsVerified, false);
});

test('existing endpoints require their signing secret and pagination cannot create duplicates', async () => {
  const calls = [];
  await assert.rejects(activateLive(env, { apply: true, fetch: async (url, init) => {
    calls.push(init.method || 'GET');
    if (url.endsWith('/account')) return response({ id: 'acct_1', charges_enabled: true, details_submitted: true });
    if (!url.includes('starting_after')) return response({ data: [{ id: 'we_other', url: 'https://other.example' }], has_more: true });
    return response({ data: [{ id: 'we_semester', url: 'https://lzrqvlugnawcgywkhqlz.supabase.co/functions/v1/billing-webhook',
      livemode: true, status: 'enabled', enabled_events: EVENTS }], has_more: false });
  } }), /cannot be retrieved/);
  assert.deepEqual(calls, ['GET', 'GET', 'GET']);
});

test('activates one endpoint, writes secrets only to Supabase, probes without charging', async () => {
  const calls = [];
  const result = await activateLive(env, { apply: true, fetch: async (url, init) => {
    calls.push({ url, method: init.method || 'GET', body: init.body });
    if (url.endsWith('/account')) return response({ id: 'acct_1', charges_enabled: true, details_submitted: true });
    if (url.includes('webhook_endpoints?')) return response({ data: [], has_more: false });
    if (url.endsWith('/webhook_endpoints')) return response({ id: 'we_semester', secret: 'whsec_abc', livemode: true, status: 'enabled' });
    if (url.endsWith('/secrets')) return response([]);
    if (url.endsWith('/billing-webhook')) return response({ error: 'Not an event.' }, 400);
    return response({ error: 'Sign in.' }, 401, { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN });
  } });
  assert.equal(result.state, 'configured');
  assert.equal(result.paymentsVerified, false);
  const stored = JSON.parse(calls.find(call => call.url.endsWith('/secrets')).body);
  assert.deepEqual(stored.map(secret => secret.name), ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'ALLOWED_ORIGIN', 'CHECKOUT_RETURN_URL']);
  assert.equal(calls.filter(call => call.url.endsWith('/webhook_endpoints')).length, 1);
  assert.equal(calls.some(call => /checkout\/sessions|payment_intents/.test(call.url)), false);
  assert.equal(JSON.stringify(result).includes('whsec_'), false);
  assert.equal(JSON.stringify(result).includes('sk_live_'), false);
});
