/**
 * A signed-in individual subscriber's short-lived Stripe billing portal link.
 *
 * The portal is the receipt and invoice surface. Semester authenticates the
 * caller and resolves only that person's individual billing account; Stripe
 * hosts the invoice history and payment-method UI. No reusable portal URL is
 * stored or returned to anyone else.
 *
 * Source: https://docs.stripe.com/customer-management/integrate-customer-portal#redirect
 */
import { allowedOrigins, strictCorsHeaders, strictOrigin } from './cors.ts';
import { STRIPE_API, formEncode } from './stripe.ts';

export interface PortalDeps {
  stripeKey: string | undefined;
  portalConfigurationId: string | undefined;
  allowedOrigin: string | undefined;
  returnUrl: string | undefined;
  customerForToken(token: string): Promise<string | null>;
  fetch: typeof fetch;
}

const CUSTOMER = /^cus_[A-Za-z0-9]{6,120}$/;
const PORTAL_CONFIGURATION = /^bpc_[A-Za-z0-9]{6,120}$/;

export async function handleBillingPortal(req: Request, deps: PortalDeps): Promise<Response> {
  const origin = req.headers.get('Origin');
  const allowed = strictOrigin(deps.allowedOrigin, origin);
  const cors = strictCorsHeaders(deps.allowedOrigin, origin);
  const reply = (status: number, body: unknown, extra: Record<string, string> = {}) =>
    new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { ...cors, 'Cache-Control': 'no-store', ...(body === null ? {} : { 'Content-Type': 'application/json' }), ...extra },
    });

  if (req.method === 'OPTIONS') return allowed ? reply(204, null) : reply(403, null);
  if (!deps.stripeKey || !deps.returnUrl || !deps.portalConfigurationId ||
      !PORTAL_CONFIGURATION.test(deps.portalConfigurationId)) {
    return reply(503, { error: 'Billing history is not available yet.' });
  }
  if (!allowed) return reply(403, { error: 'This page is not allowed to open billing history.' });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed.' }, { Allow: 'POST, OPTIONS' });

  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1]?.trim();
  if (!token) return reply(401, { error: 'Sign in to view billing history.' });

  try {
    const customer = await deps.customerForToken(token);
    if (!customer || !CUSTOMER.test(customer)) return reply(404, { error: 'There is no billing history for this account.' });
    const returnUrl = deps.returnUrl;
    const u = new URL(returnUrl);
    if (u.protocol !== 'https:' || u.username || u.password || !allowedOrigins(deps.allowedOrigin).includes(u.origin)) {
      return reply(503, { error: 'Billing history is not configured safely.' });
    }
    const res = await deps.fetch(`${STRIPE_API}/billing_portal/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${deps.stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formEncode({ customer, configuration: deps.portalConfigurationId, return_url: returnUrl }),
    });
    if (!res.ok) return reply(502, { error: 'Billing history could not be opened. Try again.' });
    const session = (await res.json()) as { url?: unknown; livemode?: unknown };
    const live = deps.stripeKey.startsWith('sk_live_') || deps.stripeKey.startsWith('rk_live_');
    if (session.livemode !== live || typeof session.url !== 'string' || !session.url.startsWith('https://billing.stripe.com/')) {
      return reply(502, { error: 'Billing history could not be opened. Try again.' });
    }
    return reply(200, { url: session.url });
  } catch {
    console.error('billing-portal: could not open billing history');
    return reply(500, { error: 'Billing history could not be opened. Try again.' });
  }
}
