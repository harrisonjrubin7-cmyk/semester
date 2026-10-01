/** Secure, rerunnable Stripe activation. No credentials or provider payloads are logged. */
import { createHash, createHmac } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const EVENTS = [
  'checkout.session.completed', 'customer.subscription.created',
  'customer.subscription.updated', 'customer.subscription.deleted',
  'invoice.paid', 'invoice.payment_failed', 'charge.refunded', 'charge.dispute.created',
];
const DEFAULT_PROJECT = 'lzrqvlugnawcgywkhqlz';
const DEFAULT_RETURN = 'https://harrisonjrubin7-cmyk.github.io/semester/#/account';

export function configuration(env) {
  const project = env.SUPABASE_PROJECT_REF || DEFAULT_PROJECT;
  const stripeKey = env.STRIPE_SECRET_KEY;
  const accessToken = env.SUPABASE_ACCESS_TOKEN;
  if (!/^[a-z]{20}$/.test(project)) throw new Error('Invalid SUPABASE_PROJECT_REF.');
  if (!/^(sk|rk)_live_[A-Za-z0-9]+$/.test(stripeKey || '')) throw new Error('A live STRIPE_SECRET_KEY is required.');
  if (!accessToken) throw new Error('SUPABASE_ACCESS_TOKEN is required.');
  const origins = (env.ALLOWED_ORIGIN || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!origins.length || origins.some(origin => {
    try { const u = new URL(origin); return u.protocol !== 'https:' || u.origin !== origin; }
    catch { return true; }
  })) throw new Error('ALLOWED_ORIGIN must contain explicit HTTPS origins. Preserve all existing app origins.');
  const returnUrl = env.CHECKOUT_RETURN_URL || DEFAULT_RETURN;
  const u = new URL(returnUrl);
  if (u.protocol !== 'https:' || u.username || u.password || !origins.includes(u.origin)) throw new Error('CHECKOUT_RETURN_URL must belong to ALLOWED_ORIGIN.');
  if (env.STRIPE_WEBHOOK_SECRET && !/^whsec_[A-Za-z0-9]+$/.test(env.STRIPE_WEBHOOK_SECRET)) throw new Error('Invalid STRIPE_WEBHOOK_SECRET.');
  return { project, stripeKey, accessToken, origins, returnUrl, webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    webhookUrl: `https://${project}.supabase.co/functions/v1/billing-webhook` };
}

export async function activateLive(env, { apply = false, fetch: send = globalThis.fetch } = {}) {
  const c = configuration(env);
  async function request(url, init, label) {
    let res;
    try { res = await send(url, { ...init, signal: AbortSignal.timeout(20_000), redirect: 'error' }); }
    catch { throw new Error(`${label} could not connect. No provider payload was logged.`); }
    if (!res.ok) throw new Error(`${label} refused the request (HTTP ${res.status}).`);
    try { return await res.json(); } catch { throw new Error(`${label} returned an unreadable response.`); }
  }
  const stripe = (path, init = {}) => request(`https://api.stripe.com/v1/${path}`, {
    ...init, headers: { Authorization: `Bearer ${c.stripeKey}`, ...init.headers },
  }, 'Stripe');
  const account = await stripe('account');
  if (!account.id || account.charges_enabled !== true || account.details_submitted !== true)
    throw new Error('Stripe account onboarding is incomplete or live charges are disabled. No settings changed.');

  // Follow pagination; never mistake page one for the complete endpoint list.
  let matches = [], cursor;
  do {
    const page = await stripe(`webhook_endpoints?limit=100${cursor ? `&starting_after=${encodeURIComponent(cursor)}` : ''}`);
    if (!Array.isArray(page.data)) throw new Error('Stripe returned an invalid endpoint list.');
    matches.push(...page.data.filter(endpoint => endpoint.url === c.webhookUrl));
    cursor = page.has_more === true ? page.data.at(-1)?.id : undefined;
    if (page.has_more === true && !cursor) throw new Error('Stripe returned invalid pagination.');
  } while (cursor);
  if (matches.length > 1) throw new Error('Multiple Stripe endpoints target this project. Resolve duplicate delivery before activation.');
  let endpoint = matches[0];
  if (endpoint && (endpoint.livemode !== true || endpoint.status !== 'enabled'))
    throw new Error('The existing webhook is not enabled in live mode. No settings changed.');
  if (endpoint && !c.webhookSecret)
    throw new Error('Set STRIPE_WEBHOOK_SECRET from the existing live endpoint; its secret cannot be retrieved through the API. No settings changed.');
  const completeEvents = endpoint && (endpoint.enabled_events?.includes('*') || EVENTS.every(event => endpoint.enabled_events?.includes(event)));
  if (!apply) return { state: 'checked', project: c.project, chargesEnabled: true,
    webhookExists: !!endpoint, requiredEventsConfigured: !!completeEvents, paymentsVerified: false };

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (!endpoint) {
    const body = new URLSearchParams({ url: c.webhookUrl, description: 'Semester subscription lifecycle' });
    EVENTS.forEach((event, i) => body.set(`enabled_events[${i}]`, event));
    const key = createHash('sha256').update(`${account.id}:${c.project}:semester-billing-v1`).digest('hex');
    endpoint = await stripe('webhook_endpoints', { method: 'POST', headers: { ...headers, 'Idempotency-Key': key }, body });
    if (endpoint.livemode !== true || endpoint.status !== 'enabled' || !/^whsec_[A-Za-z0-9]+$/.test(endpoint.secret || ''))
      throw new Error('Stripe did not return a usable live webhook. Project secrets were not changed.');
    c.webhookSecret = endpoint.secret;
  } else if (!completeEvents) {
    // Retain any event types already configured by the owner.
    const body = new URLSearchParams();
    [...new Set([...endpoint.enabled_events, ...EVENTS])].forEach((event, i) => body.set(`enabled_events[${i}]`, event));
    await stripe(`webhook_endpoints/${encodeURIComponent(endpoint.id)}`, { method: 'POST', headers, body });
  }
  await request(`https://api.supabase.com/v1/projects/${c.project}/secrets`, {
    method: 'POST', headers: { Authorization: `Bearer ${c.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      { name: 'STRIPE_SECRET_KEY', value: c.stripeKey },
      { name: 'STRIPE_WEBHOOK_SECRET', value: c.webhookSecret },
      { name: 'ALLOWED_ORIGIN', value: c.origins.join(',') },
      { name: 'CHECKOUT_RETURN_URL', value: c.returnUrl },
    ]),
  }, 'Supabase secret configuration');

  // Signed malformed input validates the deployed signing key without creating
  // an invoice, subscription, checkout, or synthetic financial event.
  const body = '{}', t = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', c.webhookSecret).update(`${t}.${body}`).digest('hex');
  let verified = false;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await send(c.webhookUrl, { method: 'POST', body, redirect: 'error', signal: AbortSignal.timeout(20_000),
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${t},v1=${sig}` } });
    const said = await res.json().catch(() => ({}));
    if (res.status === 400 && said.error === 'Not an event.') { verified = true; break; }
    if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!verified) throw new Error('Secrets were configured, but the deployed webhook did not verify the signing key. Check deployment; do not advertise live billing yet.');
  for (const origin of c.origins) {
    for (const name of ['billing-checkout', 'billing-cancel']) {
      const res = await send(`https://${c.project}.supabase.co/functions/v1/${name}`, {
        method: 'POST', body: '{}', redirect: 'error', signal: AbortSignal.timeout(20_000),
        headers: { Origin: origin, 'Content-Type': 'application/json' },
      });
      if (res.status !== 401 || res.headers.get('Access-Control-Allow-Origin') !== origin)
        throw new Error(`Secrets were configured, but ${name} did not pass authentication/CORS verification. Do not advertise live billing yet.`);
    }
  }
  return { state: 'configured', project: c.project, chargesEnabled: true,
    webhookVerified: true, originsVerified: true, paymentsVerified: false,
    remaining: 'Complete one owner-approved checkout, receipt, entitlement and cancellation lifecycle before marking billing available.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await activateLive(process.env, { apply: process.argv.includes('--apply') }), null, 2)); }
  catch (error) { console.error(error instanceof Error ? error.message : 'Activation failed.'); process.exitCode = 1; }
}
