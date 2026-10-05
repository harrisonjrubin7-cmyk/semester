/**
 * Checkout: a signed-in student, a catalog price and their consent in; the
 * payment provider's hosted checkout page out.
 *
 * Everything this function decides is in `../_shared/billingcheckout.ts`, which
 * `app/src/lib/billing/checkout.test.ts` drives branch by branch. This file
 * only wires in the service-key client (to check the caller's access token and
 * call `begin_checkout` / `attach_checkout_session`) and `fetch`.
 *
 * `verify_jwt` is off (supabase/config.toml) so the CORS preflight, which
 * carries no Authorization header, is answered; the handler checks the
 * caller's token itself. New checkout is code-held off even when payment
 * credentials and the operations setting exist. See `docs/COMMERCIAL-CORE.md`.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleBillingCheckout, type BeginRow } from '../_shared/billingcheckout.ts';

const db = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
);

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? Deno.env.get('STRIPE_API_KEY');
const billingOperationsRequested = Deno.env.get('BILLING_LIVE_ENABLED') === 'true';
/** Code-level market hold: environment configuration alone cannot open new checkout. */
const individualPaidAcquisitionApproved = false;

Deno.serve((req) =>
  handleBillingCheckout(req, {
    // New individual paid acquisition is held by the current market decision.
    // Cancellation and billing-history functions remain available to existing subscribers.
    liveEnabled: individualPaidAcquisitionApproved && billingOperationsRequested,
    stripeKey,
    taxCode: Deno.env.get('STRIPE_PRODUCT_TAX_CODE'),
    allowedOrigin: Deno.env.get('ALLOWED_ORIGIN'),
    returnUrl: Deno.env.get('CHECKOUT_RETURN_URL'),
    async userFromToken(token) {
      const { data, error } = await db.auth.getUser(token);
      return error || !data.user ? null : data.user.id;
    },
    async begin(user, priceId, version) {
      const { data, error } = await db.rpc('begin_checkout', {
        want_user: user, want_price: priceId, want_consent_version: version,
      });
      if (error) throw new Error('begin_checkout failed');
      return ((data ?? []) as BeginRow[])[0] ?? { outcome: 'no_such_price' } as BeginRow;
    },
    async attach(checkoutId, sessionId) {
      const { error } = await db.rpc('attach_checkout_session', { want_checkout: checkoutId, want_session: sessionId });
      if (error) throw new Error('attach_checkout_session failed');
    },
    fetch,
  }),
);
