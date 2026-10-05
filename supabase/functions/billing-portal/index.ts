/** Stripe-hosted receipts, invoices and payment-method management. */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleBillingPortal } from '../_shared/billingportal.ts';

const URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? Deno.env.get('STRIPE_API_KEY');

const asCaller = (token: string) =>
  createClient(URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

Deno.serve((req) =>
  handleBillingPortal(req, {
    stripeKey,
    portalConfigurationId: Deno.env.get('STRIPE_PORTAL_CONFIGURATION_ID'),
    allowedOrigin: Deno.env.get('ALLOWED_ORIGIN'),
    returnUrl: Deno.env.get('CHECKOUT_RETURN_URL'),
    async customerForToken(token) {
      const db = asCaller(token);
      const { data: who } = await db.auth.getUser(token);
      if (!who.user) return null;
      const { data, error } = await db
        .from('billing_accounts')
        .select('provider_ref')
        .eq('kind', 'individual')
        .eq('user_id', who.user.id)
        .limit(1);
      if (error) throw new Error('billing account read failed');
      const ref = (data ?? [])[0]?.provider_ref;
      return typeof ref === 'string' ? ref : null;
    },
    fetch,
  }),
);
