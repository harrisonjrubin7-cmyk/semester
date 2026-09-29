/**
 * Cancelling Plus, as a pure request handler: a signed-in person's own
 * subscription is set to end at the close of the period they paid for, in
 * Stripe first and in Semester's record second.
 *
 * Stripe first, because Stripe is the party that charges. Recording the
 * cancellation here alone (what `request_cancellation` did on its own until
 * D-132) left Stripe renewing — and the next `customer.subscription.updated`
 * the webhook applied would have put `cancel_at_period_end` back to false.
 * So:
 *
 *   1. the subscription the page names is read *as the caller* (RLS, and
 *      only their individual billing account) — never taken on trust;
 *   2. Stripe is told `cancel_at_period_end=true` for its `provider_ref`,
 *      with an idempotency key per subscription;
 *   3. only if Stripe agreed, `request_cancellation` records it — also as the
 *      caller, so the rule about whose subscription it is stays in one place.
 *
 * If step 3 fails after step 2 succeeded, nothing is lost: Stripe sends
 * `customer.subscription.updated` carrying `cancel_at_period_end`, which
 * `billing-webhook` applies. A retry is safe at every step.
 *
 * ## Off, and closed
 *
 * With no `STRIPE_SECRET_KEY` it answers 503. CORS fails closed on
 * `ALLOWED_ORIGIN`, the same list checkout reads (`strictOrigin`).
 */
import { strictCorsHeaders, strictOrigin } from './cors.ts';
import { STRIPE_API, formEncode } from './stripe.ts';

export interface OwnSubscription {
  id: string;
  provider_ref: string | null;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string;
}

export interface CancelDeps {
  /** `STRIPE_SECRET_KEY`; unset turns cancelling off. */
  stripeKey: string | undefined;
  /** `ALLOWED_ORIGIN`, read strictly. */
  allowedOrigin: string | undefined;
  /** That subscription if it is the caller's own, live and paid, read with their token; else null. */
  ownSubscription(token: string, subscriptionId: string): Promise<OwnSubscription | null>;
  /** `request_cancellation`, called with their token; the period end it returns. */
  record(token: string, subscriptionId: string): Promise<string>;
  fetch: typeof fetch;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const MAX_CANCEL_BODY_BYTES = 512;

/** Stripe's subscription ids: `sub_` and a short run of letters and digits. */
const STRIPE_SUB = /^sub_[A-Za-z0-9]{6,120}$/;

export async function handleBillingCancel(req: Request, deps: CancelDeps): Promise<Response> {
  const origin = req.headers.get('Origin');
  const allowed = strictOrigin(deps.allowedOrigin, origin);
  const cors = strictCorsHeaders(deps.allowedOrigin, origin);
  const reply = (status: number, body: unknown, extra: Record<string, string> = {}) =>
    new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { ...cors, 'Cache-Control': 'no-store', ...(body === null ? {} : { 'Content-Type': 'application/json' }), ...extra },
    });

  if (req.method === 'OPTIONS') return allowed ? reply(204, null) : reply(403, null);
  if (!deps.stripeKey) return reply(503, { error: 'Cancelling online is not available yet. Email harrisonjrubin7@gmail.com and it will be done by hand.' });
  if (!allowed) return reply(403, { error: 'This page is not allowed to change a subscription.' });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed.' }, { Allow: 'POST, OPTIONS' });

  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1]?.trim();
  if (!token) return reply(401, { error: 'Sign in to cancel.' });

  // The subscription the person is looking at, named by the page: with two
  // live ones (two checkouts finished at once), "whichever comes first" could
  // cancel a different one from the one the page then calls cancelled.
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > MAX_CANCEL_BODY_BYTES) return reply(413, { error: 'Too large.' });
  let wanted: unknown;
  try {
    wanted = (JSON.parse(raw) as Record<string, unknown> | null)?.subscription_id;
  } catch {
    wanted = undefined;
  }
  if (typeof wanted !== 'string' || !UUID.test(wanted)) return reply(400, { error: 'Say which subscription to cancel.' });

  try {
    const sub = await deps.ownSubscription(token, wanted);
    if (!sub) return reply(404, { error: 'You have no subscription to cancel.' });
    if (sub.cancel_at_period_end) return reply(200, { ends_at: sub.current_period_end });
    if (!sub.provider_ref || !STRIPE_SUB.test(sub.provider_ref)) {
      return reply(409, { error: 'This subscription cannot be cancelled online. Email harrisonjrubin7@gmail.com and it will be done by hand.' });
    }

    const res = await deps.fetch(`${STRIPE_API}/subscriptions/${sub.provider_ref}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${deps.stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': `cancel-${sub.id}`,
      },
      body: formEncode({ cancel_at_period_end: true }),
    });
    if (!res.ok) return reply(502, { error: 'The payment provider did not answer, so nothing changed. You are still subscribed; try again.' });

    let endsAt = sub.current_period_end;
    try {
      endsAt = (await deps.record(token, sub.id)) || endsAt;
    } catch {
      // Stripe has it; its webhook will bring the record into line.
      console.error('billing-cancel: recorded in Stripe, not yet here');
    }
    return reply(200, { ends_at: endsAt });
  } catch {
    console.error('billing-cancel: could not cancel');
    return reply(500, { error: 'The cancellation did not go through. Try again, or email harrisonjrubin7@gmail.com.' });
  }
}
