/** Secure, rerunnable Stripe activation. No credentials or provider payloads are logged. */
import { createHash, createHmac } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const EVENTS = [
  'checkout.session.completed', 'customer.subscription.created',
  'customer.subscription.updated', 'customer.subscription.deleted',
  'invoice.paid', 'invoice.payment_failed', 'invoice.finalization_failed',
  'charge.refunded', 'charge.dispute.created',
];
const DEFAULT_PROJECT = 'lzrqvlugnawcgywkhqlz';
const DEFAULT_RETURN = 'https://harrisonjrubin7-cmyk.github.io/semester/#/account';

export function configuration(env) {
  const project = env.SUPABASE_PROJECT_REF || DEFAULT_PROJECT;
  const stripeKey = env.STRIPE_SECRET_KEY;
  const taxCode = env.STRIPE_PRODUCT_TAX_CODE;
  const accessToken = env.SUPABASE_ACCESS_TOKEN;
  if (!/^[a-z]{20}$/.test(project)) throw new Error('Invalid SUPABASE_PROJECT_REF.');
  // Restricted-key permissions are independently configurable per resource.
  // This workflow needs Checkout Session, Subscription, portal, webhook and
  // read permissions together, so accept only Stripe's full live secret key.
  if (!/^sk_live_[A-Za-z0-9]+$/.test(stripeKey || '')) throw new Error('A full live STRIPE_SECRET_KEY is required.');
  if (!/^txcd_[0-9]{8}$/.test(taxCode || ''))
    throw new Error('An owner-approved STRIPE_PRODUCT_TAX_CODE is required.');
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
  return { project, stripeKey, taxCode, accessToken, origins, returnUrl, webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    webhookUrl: `https://${project}.supabase.co/functions/v1/billing-webhook` };
}

export async function activateLive(env, { apply = false, fetch: send = globalThis.fetch } = {}) {
  const c = configuration(env);
  async function request(url, init, label, { allowEmpty = false } = {}) {
    let res;
    try { res = await send(url, { ...init, signal: AbortSignal.timeout(20_000), redirect: 'error' }); }
    catch { throw new Error(`${label} could not connect. No provider payload was logged.`); }
    if (!res.ok) throw new Error(`${label} refused the request (HTTP ${res.status}).`);
    let body;
    try { body = await res.text(); } catch { throw new Error(`${label} returned an unreadable response.`); }
    if (!body.trim()) {
      if (allowEmpty) return null;
      throw new Error(`${label} returned an unreadable response.`);
    }
    try { return JSON.parse(body); } catch { throw new Error(`${label} returned an unreadable response.`); }
  }
  const stripe = (path, init = {}) => request(`https://api.stripe.com/v1/${path}`, {
    ...init, headers: { Authorization: `Bearer ${c.stripeKey}`, ...init.headers },
  }, 'Stripe');
  const semesterSessionIsCurrent = item => item?.metadata?.semester_checkout_id &&
    item?.metadata?.semester_tax_contract === 'plus-v2' &&
    item?.metadata?.semester_tax_code === c.taxCode;
  async function checkoutSessions(status) {
    const sessions = [];
    let sessionCursor;
    do {
      const page = await stripe(`checkout/sessions?status=${status}&limit=100${sessionCursor ? `&starting_after=${encodeURIComponent(sessionCursor)}` : ''}`);
      if (!Array.isArray(page.data)) throw new Error('Stripe returned an invalid Checkout Session list.');
      sessions.push(...page.data);
      sessionCursor = page.has_more === true ? page.data.at(-1)?.id : undefined;
      if (page.has_more === true && !sessionCursor) throw new Error('Stripe returned invalid Checkout Session pagination.');
    } while (sessionCursor);
    return sessions;
  }
  async function invalidActiveSubscriptions(sessions) {
    const subscriptions = [];
    for (const session of sessions.filter(item => item?.metadata?.semester_checkout_id)) {
      const subscriptionRef = typeof session?.subscription === 'string' ? session.subscription : session?.subscription?.id;
      if (!/^sub_[A-Za-z0-9]+$/.test(subscriptionRef || '')) {
        subscriptions.push('missing_subscription_reference');
        continue;
      }
      const subscription = await stripe(
        `subscriptions/${encodeURIComponent(subscriptionRef)}?expand[]=items.data.price.product`,
      );
      const ended = ['canceled', 'incomplete_expired'].includes(subscription?.status);
      const items = subscription?.items?.data;
      const productsAreCurrent = Array.isArray(items) && items.length > 0 &&
        items.every(item => item?.price?.product?.tax_code === c.taxCode);
      const migrated = subscription?.metadata?.semester_tax_contract === 'plus-v2' &&
        subscription?.metadata?.semester_tax_code === c.taxCode &&
        subscription?.automatic_tax?.enabled === true && productsAreCurrent;
      if (!ended && !migrated) subscriptions.push(subscriptionRef);
    }
    return subscriptions;
  }
  const account = await stripe('account');
  if (!account.id || account.charges_enabled !== true || account.details_submitted !== true)
    throw new Error('Stripe account onboarding is incomplete or live charges are disabled. No settings changed.');
  // A well-shaped tax code can still be a typo. Retrieve the exact live
  // object before reporting readiness or publishing the secret to checkout.
  const productTaxCode = await stripe(`tax_codes/${encodeURIComponent(c.taxCode)}`);
  if (productTaxCode?.id !== c.taxCode)
    throw new Error('Stripe did not confirm the configured product tax code. No settings changed.');
  const tax = await stripe('tax/settings');
  const taxBehavior = tax?.defaults?.tax_behavior;
  const taxReady = tax.status === 'active' && ['exclusive', 'inclusive', 'inferred_by_currency'].includes(taxBehavior);
  if (apply && !taxReady)
    throw new Error('Stripe Tax must be active with a default tax behavior. No settings changed and checkout remains unavailable.');

  // Tax registration lists are cursor-paginated just like webhook endpoints.
  // Count every active registration before asking the owner/counsel to reconcile it.
  const registrations = [];
  let registrationCursor;
  do {
    const page = await stripe(`tax/registrations?status=active&limit=100${registrationCursor ? `&starting_after=${encodeURIComponent(registrationCursor)}` : ''}`);
    if (!Array.isArray(page.data)) throw new Error('Stripe returned an invalid tax registration list.');
    registrations.push(...page.data);
    registrationCursor = page.has_more === true ? page.data.at(-1)?.id : undefined;
    if (page.has_more === true && !registrationCursor) throw new Error('Stripe returned invalid tax registration pagination.');
  } while (registrationCursor);

  // Any Semester link created before the tax-aware contract remains usable
  // until Stripe expires it. Inventory every open page before activation;
  // --apply invalidates those links and verifies none remain before secrets
  // can make the new checkout available.
  const legacySessions = (await checkoutSessions('open')).filter(item =>
    item?.metadata?.semester_checkout_id && !semesterSessionIsCurrent(item));

  // An old page may already have completed before activation starts. Open-page
  // expiration cannot repair the resulting subscription, so detect any live
  // subscription whose Checkout tax contract or product classification is
  // stale and stop for an explicit provider-side migration.
  const legacyActiveSubscriptions = await invalidActiveSubscriptions(await checkoutSessions('complete'));
  if (apply && legacyActiveSubscriptions.length > 0)
    throw new Error('An active Semester subscription uses an older tax contract. Migrate it in Stripe before activation; no settings changed.');

  // API-created portal configurations are non-default. Tag Semester's one and
  // page through active configurations so a retry updates it instead of
  // creating another configuration every time.
  const portals = [];
  let portalCursor;
  do {
    const page = await stripe(`billing_portal/configurations?active=true&limit=100${portalCursor ? `&starting_after=${encodeURIComponent(portalCursor)}` : ''}`);
    if (!Array.isArray(page.data)) throw new Error('Stripe returned an invalid billing portal configuration list.');
    portals.push(...page.data);
    portalCursor = page.has_more === true ? page.data.at(-1)?.id : undefined;
    if (page.has_more === true && !portalCursor) throw new Error('Stripe returned invalid portal configuration pagination.');
  } while (portalCursor);
  const semesterPortals = portals.filter(item => item?.metadata?.semester_product === 'semester');
  if (semesterPortals.length > 1)
    throw new Error('Multiple Semester billing portal configurations exist. Resolve the duplicate before activation.');
  // Never rewrite the account-wide default: other products or integrations
  // may rely on its subscription-management features. Semester sessions name
  // this dedicated tagged configuration explicitly.
  let portal = semesterPortals[0];
  let portalReady = portal?.features?.invoice_history?.enabled === true &&
    portal?.features?.payment_method_update?.enabled === true &&
    portal?.features?.customer_update?.enabled === true &&
    portal?.features?.customer_update?.allowed_updates?.includes('address') &&
    portal?.features?.subscription_update?.enabled === false &&
    portal?.features?.subscription_cancel?.enabled === false;

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
    taxReady, taxBehaviorConfigured: !!taxBehavior, productTaxCodeConfigured: true,
    activeTaxRegistrations: registrations.length,
    portalConfigured: portalReady, webhookExists: !!endpoint,
    legacyOpenCheckoutSessions: legacySessions.length,
    legacyActiveSubscriptions: legacyActiveSubscriptions.length,
    requiredEventsConfigured: !!completeEvents, paymentsVerified: false };

  // Do not publish a live key until the deployed checkout proves it is the
  // tax-aware handler. This preflight needs no Stripe secret, so an older
  // deployment cannot become purchasable in the gap between secret storage
  // and the post-activation authentication probes.
  let checkoutContract;
  try {
    checkoutContract = await send(`https://${c.project}.supabase.co/functions/v1/billing-checkout`, {
      method: 'OPTIONS', redirect: 'error', signal: AbortSignal.timeout(20_000),
      headers: { Origin: c.origins[0], 'Access-Control-Request-Method': 'POST' },
    });
  } catch {
    throw new Error('The deployed tax-aware checkout could not be verified. No settings changed.');
  }
  const contractStatusIsSafe = checkoutContract.status === 403 ||
    (checkoutContract.status === 204 &&
     checkoutContract.headers.get('Access-Control-Allow-Origin') === c.origins[0]);
  if (!contractStatusIsSafe || checkoutContract.headers.get('X-Semester-Billing-Contract') !== 'plus-v2')
    throw new Error('Deploy the plus-v2 tax-aware checkout before activation. No settings changed.');

  const secretUrl = `https://api.supabase.com/v1/projects/${c.project}/secrets`;
  const secretHeaders = { Authorization: `Bearer ${c.accessToken}`, 'Content-Type': 'application/json' };
  const writeProjectSecrets = (values, label) => request(secretUrl, {
    method: 'POST', headers: secretHeaders, body: JSON.stringify(values),
  }, label, { allowEmpty: true });

  // Close checkout before expiring or rescanning sessions. This is the first
  // mutation and it is fail-safe: any later error leaves purchases disabled.
  // It also makes tax-code rotation atomic from the customer's perspective.
  await writeProjectSecrets([{ name: 'BILLING_LIVE_ENABLED', value: 'false' }], 'Supabase checkout quiescence');
  let checkoutQuiesced = false;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await send(`https://${c.project}.supabase.co/functions/v1/billing-checkout`, {
      method: 'POST', body: '{}', redirect: 'error', signal: AbortSignal.timeout(20_000),
      headers: { Origin: c.origins[0], 'Content-Type': 'application/json' },
    });
    if (res.status === 503 && res.headers.get('X-Semester-Billing-Contract') === 'plus-v2') {
      checkoutQuiesced = true;
      break;
    }
    if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!checkoutQuiesced)
    throw new Error('Checkout could not be disabled before activation. No billing settings were published.');

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  const sessionsToExpire = (await checkoutSessions('open')).filter(item =>
    item?.metadata?.semester_checkout_id && !semesterSessionIsCurrent(item));
  for (const session of sessionsToExpire) {
    if (!/^cs_(?:live|test)_[A-Za-z0-9]+$/.test(session?.id || ''))
      throw new Error('Stripe returned an invalid legacy Checkout Session. No settings changed.');
    const expired = await stripe(`checkout/sessions/${encodeURIComponent(session.id)}/expire`, { method: 'POST', headers });
    if (expired?.id !== session.id || expired?.status !== 'expired')
      throw new Error('Stripe did not confirm expiration of a legacy Checkout Session. Checkout remains unavailable.');
  }
  if ((await checkoutSessions('open')).some(item =>
    item?.metadata?.semester_checkout_id && !semesterSessionIsCurrent(item)))
    throw new Error('A legacy untaxed Checkout Session is still open. Checkout remains unavailable.');
  if ((await invalidActiveSubscriptions(await checkoutSessions('complete'))).length > 0)
    throw new Error('An active Semester subscription uses an older tax contract. Migrate it in Stripe; checkout remains unavailable.');

  // Configure and validate the portal before creating a webhook. Stripe only
  // returns a new endpoint's signing secret once; no later setup failure may
  // strand that secret and make an otherwise-safe rerun impossible.
  if (!portalReady) {
    const body = new URLSearchParams({
      'features[invoice_history][enabled]': 'true',
      'features[payment_method_update][enabled]': 'true',
      'features[customer_update][enabled]': 'true',
      'features[subscription_update][enabled]': 'false',
      'features[subscription_cancel][enabled]': 'false',
      'metadata[semester_product]': 'semester',
      default_return_url: c.returnUrl,
    });
    const customerUpdates = new Set([...(portal?.features?.customer_update?.allowed_updates ?? []), 'address']);
    [...customerUpdates].forEach((value, i) => body.set(`features[customer_update][allowed_updates][${i}]`, value));
    portal = await stripe(
      portal?.id ? `billing_portal/configurations/${encodeURIComponent(portal.id)}` : 'billing_portal/configurations',
      { method: 'POST', headers, body },
    );
    portalReady = portal?.active === true && portal?.features?.invoice_history?.enabled === true &&
      portal?.features?.payment_method_update?.enabled === true &&
      portal?.features?.customer_update?.enabled === true &&
      portal?.features?.customer_update?.allowed_updates?.includes('address') &&
      portal?.features?.subscription_update?.enabled === false &&
      portal?.features?.subscription_cancel?.enabled === false;
    if (!portalReady) throw new Error('Stripe did not return a usable billing portal configuration. Project secrets were not changed.');
  }
  if (!/^bpc_[A-Za-z0-9]+$/.test(portal?.id || ''))
    throw new Error('Stripe did not return a usable billing portal configuration id. Project secrets were not changed.');

  // Exercise the live portal-session write route without creating a session.
  // An intentionally nonexistent customer must reach Stripe's resource lookup
  // (400 resource_missing), proving the credential and configuration work
  // together before the credential is published.
  let portalProbe;
  try {
    portalProbe = await send('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${c.stripeKey}`, ...headers },
      body: new URLSearchParams({
        customer: 'cus_semester_permission_probe_not_real', configuration: portal.id, return_url: c.returnUrl,
      }),
    });
  } catch {
    throw new Error('Stripe portal write permission could not be verified. Project secrets were not changed.');
  }
  const portalProbeBody = await portalProbe.json().catch(() => ({}));
  if (portalProbe.status !== 400 || portalProbeBody?.error?.code !== 'resource_missing' ||
      portalProbeBody?.error?.param !== 'customer')
    throw new Error('STRIPE_SECRET_KEY cannot create billing portal sessions. Project secrets were not changed.');

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
  await writeProjectSecrets([
      { name: 'STRIPE_SECRET_KEY', value: c.stripeKey },
      { name: 'STRIPE_WEBHOOK_SECRET', value: c.webhookSecret },
      { name: 'ALLOWED_ORIGIN', value: c.origins.join(',') },
      { name: 'CHECKOUT_RETURN_URL', value: c.returnUrl },
      { name: 'STRIPE_PORTAL_CONFIGURATION_ID', value: portal.id },
      { name: 'STRIPE_PRODUCT_TAX_CODE', value: c.taxCode },
      { name: 'BILLING_LIVE_ENABLED', value: 'false' },
    ], 'Supabase secret configuration');

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

  // A structurally valid invoice event reaches the v3 database RPC. Its
  // deliberately nonexistent subscription makes the RPC return not_ready
  // before inserting an invoice or payment event, so this proves the schema
  // and deployed function agree without manufacturing a financial record.
  const invoiceProbeBody = JSON.stringify({
    id: 'evt_semester_activation_probe', type: 'invoice.finalization_failed',
    livemode: true, created: t, data: { object: {
      id: 'in_semester_activation_probe', subscription: 'sub_semester_activation_probe',
      amount_due: 0, subtotal_excluding_tax: 0, total_taxes: [], currency: 'usd', created: t,
      automatic_tax: { status: 'failed' },
    } },
  });
  const invoiceProbeSig = createHmac('sha256', c.webhookSecret).update(`${t}.${invoiceProbeBody}`).digest('hex');
  let invoiceRpcVerified = false;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await send(c.webhookUrl, { method: 'POST', body: invoiceProbeBody, redirect: 'error', signal: AbortSignal.timeout(20_000),
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${t},v1=${invoiceProbeSig}` } });
    const said = await res.json().catch(() => ({}));
    if (res.status === 500 && said.error === 'Not ready for this event.') { invoiceRpcVerified = true; break; }
    if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!invoiceRpcVerified)
    throw new Error('The deployed webhook did not confirm the invoice-event database RPC. Checkout remains unavailable.');

  // The provider inventory is now stable because checkout is confirmed off.
  // Recheck immediately before the only write that can make purchases live.
  if ((await checkoutSessions('open')).some(item =>
    item?.metadata?.semester_checkout_id && !semesterSessionIsCurrent(item)) ||
      (await invalidActiveSubscriptions(await checkoutSessions('complete'))).length > 0)
    throw new Error('A stale tax contract appeared during activation. Checkout remains unavailable.');

  // Prove every management path while checkout is still fail-closed. A probe
  // failure cannot leave purchases enabled without cancellation or portal.
  for (const origin of c.origins) {
    for (const name of ['billing-checkout', 'billing-cancel', 'billing-portal']) {
      const expectedStatus = name === 'billing-checkout' ? 503 : 401;
      let ready = false;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const res = await send(`https://${c.project}.supabase.co/functions/v1/${name}`, {
          method: 'POST', body: '{}', redirect: 'error', signal: AbortSignal.timeout(20_000),
          headers: { Origin: origin, 'Content-Type': 'application/json' },
        });
        if (res.status === expectedStatus && res.headers.get('Access-Control-Allow-Origin') === origin) {
          ready = true;
          break;
        }
        if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 1000));
      }
      if (!ready)
        throw new Error(`Secrets were configured, but ${name} did not pass authentication/CORS verification. Do not advertise live billing yet.`);
    }
  }

  await writeProjectSecrets([{ name: 'BILLING_LIVE_ENABLED', value: 'true' }], 'Supabase checkout enablement');
  for (const origin of c.origins) {
    let ready = false;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      let res;
      try {
        res = await send(`https://${c.project}.supabase.co/functions/v1/billing-checkout`, {
          method: 'POST', body: '{}', redirect: 'error', signal: AbortSignal.timeout(20_000),
          headers: { Origin: origin, 'Content-Type': 'application/json' },
        });
      } catch {
        await writeProjectSecrets([{ name: 'BILLING_LIVE_ENABLED', value: 'false' }], 'Supabase checkout rollback');
        throw new Error('Checkout final verification could not connect and checkout was disabled again.');
      }
      if (res.status === 401 && res.headers.get('Access-Control-Allow-Origin') === origin) {
        ready = true;
        break;
      }
      if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 1000));
    }
    if (!ready) {
      await writeProjectSecrets([{ name: 'BILLING_LIVE_ENABLED', value: 'false' }], 'Supabase checkout rollback');
      throw new Error('Checkout did not pass its final authentication/CORS verification and was disabled again.');
    }
  }
  return { state: 'configured', project: c.project, chargesEnabled: true,
    taxReady: true, taxBehaviorConfigured: true, productTaxCodeConfigured: true,
    activeTaxRegistrations: registrations.length,
    portalConfigured: true, webhookVerified: true, originsVerified: true,
    expiredLegacyCheckoutSessions: sessionsToExpire.length, paymentsVerified: false,
    remaining: 'Complete one owner-approved checkout, receipt, entitlement and cancellation lifecycle before marking billing available.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await activateLive(process.env, { apply: process.argv.includes('--apply') }), null, 2)); }
  catch (error) { console.error(error instanceof Error ? error.message : 'Activation failed.'); process.exitCode = 1; }
}
