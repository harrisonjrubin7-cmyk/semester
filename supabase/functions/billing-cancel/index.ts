/**
 * Cancel: a signed-in subscriber's Plus set to end at the close of the paid
 * period, in Stripe and then in Semester's record.
 *
 * Everything this function decides is in `../_shared/billingcancel.ts`, which
 * `app/src/lib/billing/cancel.test.ts` drives branch by branch. This file
 * only wires in a client that acts *as the caller* — their own token over the
 * anon key — so the subscription is found by row-level security and
 * `request_cancellation` checks whose it is, exactly as when the app called
 * it directly. No service key is used here.
 *
 * `verify_jwt` is off (supabase/config.toml) so the CORS preflight is
 * answered; the handler requires the caller's token itself. Off (503) until
 * `STRIPE_SECRET_KEY` is set. See `docs/COMMERCIAL-CORE.md`.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleBillingCancel, type OwnSubscription } from '../_shared/billingcancel.ts';

const URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? Deno.env.get('STRIPE_API_KEY');

const asCaller = (token: string) =>
  createClient(URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

const LIVE = ['trialing', 'active', 'past_due', 'grace'];

Deno.serve((req) =>
  handleBillingCancel(req, {
    stripeKey,
    allowedOrigin: Deno.env.get('ALLOWED_ORIGIN'),
    async ownSubscription(token, subscriptionId) {
      const db = asCaller(token);
      const { data: who } = await db.auth.getUser(token);
      if (!who.user) return null;
      const { data, error } = await db
        .from('subscriptions')
        .select('id, provider_ref, status, cancel_at_period_end, current_period_end, plan_code, billing_accounts!inner(kind, user_id)')
        .eq('billing_accounts.kind', 'individual')
        .eq('billing_accounts.user_id', who.user.id)
        .eq('id', subscriptionId)
        .in('status', LIVE)
        .neq('plan_code', 'free')
        .limit(1);
      if (error) throw new Error('subscription read failed');
      return ((data ?? [])[0] as OwnSubscription | undefined) ?? null;
    },
    async record(token, subscriptionId) {
      const { data, error } = await asCaller(token).rpc('request_cancellation', { want_subscription: subscriptionId });
      if (error) throw new Error('request_cancellation failed');
      return typeof data === 'string' ? data : '';
    },
    fetch,
  }),
);
