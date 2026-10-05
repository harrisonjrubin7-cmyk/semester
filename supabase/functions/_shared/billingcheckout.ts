/**
 * Checkout, as a pure request handler: a signed-in person, one catalog price,
 * their explicit consent, and back comes the provider's hosted checkout page.
 *
 * Order matters, because the subscription table's own check constraint says
 * a paid plan needs recorded consent:
 *
 *   1. the caller's session is checked (their Supabase access token);
 *   2. `begin_checkout` records the consent — when, and to which wording — in
 *      `checkout_sessions`, and refuses a price sold by quote, a free one, or a
 *      person who already pays;
 *   3. only then is Stripe asked for a Checkout Session, priced from the
 *      catalog row (`price_data`), so no price has to exist in Stripe first;
 *   4. the session id is attached to the row, and the page's URL returned.
 *
 * The card is typed into Stripe's page, never into Semester. The subscription
 * itself is created by `billing-webhook` when Stripe confirms payment.
 *
 * ## Off, and closed
 *
 * With no `STRIPE_SECRET_KEY` it answers 503 and a plain sentence. CORS fails
 * closed: an origin is answered only when `ALLOWED_ORIGIN` names it
 * explicitly (`strictOrigin` in `cors.ts`); nothing configured, or `*`,
 * allows nobody.
 */
import { strictCorsHeaders, strictOrigin } from './cors.ts';
import { STRIPE_API, formEncode } from './stripe.ts';
import { checkoutSessionMatches, stripeMode } from './billingmode.ts';

export interface BeginRow {
  outcome: 'ok' | 'no_such_price' | 'already_subscribed';
  checkout_id: string | null;
  billing_account_id: string | null;
  customer_ref: string | null;
  email: string | null;
  plan_name: string | null;
  amount_cents: number | null;
  currency: string | null;
  billing_interval: string | null;
}

export interface CheckoutDeps {
  /** Explicit operations gate; only the literal production value `true` opens checkout. */
  liveEnabled: boolean;
  /** `STRIPE_SECRET_KEY`; unset turns checkout off. */
  stripeKey: string | undefined;
  /** Owner/accountant-approved Stripe Tax code for Semester Plus software. */
  taxCode: string | undefined;
  /** `ALLOWED_ORIGIN`, read strictly. */
  allowedOrigin: string | undefined;
  /** `CHECKOUT_RETURN_URL`, where Stripe sends the person back; defaults to the calling origin. */
  returnUrl: string | undefined;
  /** The user id an access token belongs to, or null. */
  userFromToken(token: string): Promise<string | null>;
  begin(user: string, priceId: string, consentVersion: string): Promise<BeginRow>;
  attach(checkoutId: string, sessionId: string): Promise<void>;
  fetch: typeof fetch;
}

export const MAX_CHECKOUT_BODY_BYTES = 2048;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** The same shape `checkout_sessions.consent_text_version` checks. */
export const CONSENT_VERSION = /^[a-z0-9][a-z0-9._-]{0,39}$/;
/** The first wording that explicitly consents to applicable sales tax. */
export const TAX_CONSENT_VERSION = 'plus-v2';

/** Where Stripe returns the person, with `checkout=success|cancel` added. */
export function returnTo(base: string, outcome: 'success' | 'cancel'): string {
  const u = new URL(base);
  u.searchParams.set('checkout', outcome);
  return u.toString();
}

/** The Checkout Session parameters, as Stripe's form API reads them. */
export function sessionParams(row: BeginRow, successUrl: string, cancelUrl: string, taxCode: string): Record<string, unknown> {
  return {
    mode: 'subscription',
    client_reference_id: row.checkout_id,
    customer: row.customer_ref ?? undefined,
    customer_email: row.customer_ref ? undefined : row.email ?? undefined,
    // Automatic Tax must be allowed to persist the address collected by
    // Checkout when an existing Customer is reused. Without this, Stripe
    // rejects the Session instead of letting a former subscriber return.
    // Source: https://docs.stripe.com/api/checkout/sessions/create#create_checkout_session-customer_update
    customer_update: row.customer_ref ? { address: 'auto' } : undefined,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: row.currency,
        unit_amount: row.amount_cents,
        recurring: { interval: row.billing_interval },
        // Name the reviewed software classification on every inline product;
        // never inherit an unrelated account default.
        // Source: https://docs.stripe.com/tax/tax-codes
        product_data: { name: `Semester ${row.plan_name}`, tax_code: taxCode },
      },
    }],
    // The contract marker lets the activation gate distinguish current,
    // tax-aware sessions from older open links that must be expired before
    // billing can be enabled.
    metadata: {
      semester_checkout_id: row.checkout_id,
      semester_tax_contract: TAX_CONSENT_VERSION,
      semester_tax_code: taxCode,
    },
    subscription_data: { metadata: {
      semester_checkout_id: row.checkout_id,
      semester_tax_contract: TAX_CONSENT_VERSION,
      semester_tax_code: taxCode,
    } },
    // Stripe Checkout collects the location it needs and carries the tax
    // result onto the subscription and its invoices. Collection still follows
    // the merchant account's reviewed registrations; this does not invent one.
    // Source: https://docs.stripe.com/api/checkout/sessions/create#create_checkout_session-automatic_tax
    automatic_tax: { enabled: true },
    success_url: successUrl,
    cancel_url: cancelUrl,
  };
}

export async function handleBillingCheckout(req: Request, deps: CheckoutDeps): Promise<Response> {
  const origin = req.headers.get('Origin');
  const allowed = strictOrigin(deps.allowedOrigin, origin);
  const cors = strictCorsHeaders(deps.allowedOrigin, origin);
  const reply = (status: number, body: unknown, extra: Record<string, string> = {}) =>
    new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: {
        ...cors,
        'Cache-Control': 'no-store',
        'X-Semester-Billing-Contract': TAX_CONSENT_VERSION,
        ...(body === null ? {} : { 'Content-Type': 'application/json' }),
        ...extra,
      },
    });

  // A preflight from an allowed page succeeds even while checkout is off, so
  // the page can read the 503's sentence rather than a bare network error.
  if (req.method === 'OPTIONS') return allowed ? reply(204, null) : reply(403, null);
  if (deps.liveEnabled !== true) return reply(503, { error: 'Checkout is not available yet.' });
  const taxCode = deps.taxCode;
  if (!stripeMode(deps.stripeKey) || !taxCode || !/^txcd_[0-9]{8}$/.test(taxCode)) {
    return reply(503, { error: 'Checkout is not available yet.' });
  }
  if (!allowed) return reply(403, { error: 'This page is not allowed to start a checkout.' });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed.' }, { Allow: 'POST, OPTIONS' });

  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1]?.trim();
  if (!token) return reply(401, { error: 'Sign in to subscribe.' });

  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > MAX_CHECKOUT_BODY_BYTES) return reply(413, { error: 'Too large.' });
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return reply(400, { error: 'Send JSON.' });
  }
  const { price_id: priceId, consent, consent_text_version: version } = body;
  if (typeof priceId !== 'string' || !UUID.test(priceId)) return reply(400, { error: 'Choose a plan.' });
  if (consent !== true || version !== TAX_CONSENT_VERSION || !CONSENT_VERSION.test(version)) {
    return reply(400, { error: 'Agree to the recurring charge to continue.' });
  }

  try {
    const user = await deps.userFromToken(token);
    if (!user) return reply(401, { error: 'Sign in to subscribe.' });

    const row = await deps.begin(user, priceId, version);
    if (row.outcome === 'no_such_price') return reply(404, { error: 'That plan cannot be bought online.' });
    if (row.outcome === 'already_subscribed') return reply(409, { error: 'You already have a subscription.' });
    if (!row.checkout_id) return reply(500, { error: 'Checkout could not start.' });

    const base = deps.returnUrl || `${allowed}/`;
    const res = await deps.fetch(`${STRIPE_API}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${deps.stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        // One session per checkout row, however often the button is pressed.
        // Versioned for the tax-aware parameter contract. This avoids Stripe
        // rejecting a retry that reuses a pre-tax session's key with new
        // automatic-tax, product-code, or customer-update parameters.
        'Idempotency-Key': `checkout-v2-${taxCode}-${row.checkout_id}`,
      },
      body: formEncode(sessionParams(row, returnTo(base, 'success'), returnTo(base, 'cancel'), taxCode)),
    });
    if (!res.ok) return reply(502, { error: 'The payment provider did not answer. Nothing was charged.' });
    const session = (await res.json()) as { id?: unknown; url?: unknown; livemode?: unknown };
    if (typeof session.id !== 'string' || !checkoutSessionMatches(session, deps.stripeKey)) {
      return reply(502, { error: 'The payment provider did not answer. Nothing was charged.' });
    }
    await deps.attach(row.checkout_id, session.id);
    return reply(200, { url: session.url, checkout_id: row.checkout_id });
  } catch {
    console.error('billing-checkout: could not start a checkout');
    return reply(500, { error: 'Checkout could not start. Nothing was charged.' });
  }
}
