/**
 * Upgrading to Plus, from the app's side.
 *
 * Three reads and one call, each against something that already exists:
 *
 *  - the catalog: `commercial_prices`, readable by anyone (the "anyone reads
 *    current prices" policy), so the price the button names is the price
 *    `begin_checkout` charges — never the planned figure in `plans.ts`;
 *  - the person's subscription: `subscriptions`, which RLS narrows to their
 *    own billing account;
 *  - `billing-checkout`, which records their consent and answers with
 *    Stripe's hosted page. The card is typed there, never here.
 *
 * The subscription row itself is written by `billing-webhook` when Stripe
 * confirms payment, so the app only ever reads it. See
 * `docs/COMMERCIAL-CORE.md`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const env = import.meta.env as unknown as Record<string, string | undefined>;

/** The wording a person agrees to, and the version recorded with it. Change one, change both. */
export const CONSENT_VERSION = 'plus-v2';

export interface PlusPrice {
  id: string;
  cents: number;
  currency: string;
  interval: 'month' | 'year';
}

export interface Subscription {
  id: string;
  plan: string;
  status: 'trialing' | 'active' | 'past_due' | 'grace' | 'canceled' | 'ended';
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
  billingIssue: 'address_required' | null;
}

export type Started = { kind: 'redirect'; url: string } | { kind: 'refused'; said: string };

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

/** The function's address for this build, or '' when the build has no project. */
export function checkoutEndpoint(base = env.VITE_SUPABASE_URL ?? ''): string {
  return base ? `${base.replace(/\/$/, '')}/functions/v1/billing-checkout` : '';
}

/** The cancel function's address, or ''. */
export function cancelEndpoint(base = env.VITE_SUPABASE_URL ?? ''): string {
  return base ? `${base.replace(/\/$/, '')}/functions/v1/billing-cancel` : '';
}

/** The hosted receipt and invoice portal function's address, or ''. */
export function portalEndpoint(base = env.VITE_SUPABASE_URL ?? ''): string {
  return base ? `${base.replace(/\/$/, '')}/functions/v1/billing-portal` : '';
}

/** "$7.99", "$59", "$30.50" — in the catalog's currency, US dollars as written today. */
export function money(cents: number, currency = 'usd'): string {
  const n = cents / 100;
  const s = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return currency.toLowerCase() === 'usd' ? `$${s}` : `${s} ${currency.toUpperCase()}`;
}

/** "$7.99 a month", "$59 a year". */
export function priceWords(p: PlusPrice): string {
  return `${money(p.cents, p.currency)} a ${p.interval}`;
}

/**
 * What the checkbox says. Everything a recurring-charge consent has to name:
 * the amount, how often, that it renews, and how to stop it.
 */
export function consentText(p: PlusPrice): string {
  return (
    `I agree to be charged ${priceWords(p)}, plus any applicable sales tax shown before purchase, ` +
    `for Semester Plus, renewing every ${p.interval} ` +
    `until I cancel. I can cancel any time from my Account screen, and it stops at the end of the ${p.interval} I have paid for.`
  );
}

/** Rows from `commercial_prices` → the Plus prices that can be bought online, monthly first. */
export function plusPrices(rows: unknown): PlusPrice[] {
  if (!Array.isArray(rows)) return [];
  const out: PlusPrice[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    if (!r || r.plan_code !== 'plus') continue;
    if (typeof r.id !== 'string' || typeof r.amount_cents !== 'number' || r.amount_cents <= 0) continue;
    if (r.billing_interval !== 'month' && r.billing_interval !== 'year') continue;
    out.push({ id: r.id, cents: r.amount_cents, currency: typeof r.currency === 'string' ? r.currency : 'usd', interval: r.billing_interval });
  }
  return out.sort((a, b) => (a.interval === b.interval ? 0 : a.interval === 'month' ? -1 : 1));
}

const LIVE = new Set(['trialing', 'active', 'past_due', 'grace']);

/** The person's current paid subscription, from their own `subscriptions` rows, or null. */
export function currentSubscription(rows: unknown): Subscription | null {
  if (!Array.isArray(rows)) return null;
  for (const r of rows as Record<string, unknown>[]) {
    if (!r || typeof r.id !== 'string' || typeof r.status !== 'string' || !LIVE.has(r.status)) continue;
    if (r.plan_code === 'free' || typeof r.plan_code !== 'string') continue;
    return {
      id: r.id,
      plan: r.plan_code,
      status: r.status as Subscription['status'],
      periodEnd: typeof r.current_period_end === 'string' ? r.current_period_end : '',
      cancelAtPeriodEnd: r.cancel_at_period_end === true,
      billingIssue: r.billing_issue === 'address_required' ? 'address_required' : null,
    };
  }
  return null;
}

/** Whether any of the person's own rows is a paid plan, current or long over. */
export function hasPaidBefore(rows: unknown): boolean {
  return Array.isArray(rows) && (rows as Record<string, unknown>[]).some((r) => r && typeof r.plan_code === 'string' && r.plan_code !== 'free');
}

/** What Stripe's return added to the address: `?checkout=success|cancel`, or null. */
export function checkoutReturn(search: string): 'success' | 'cancel' | null {
  const v = new URLSearchParams(search).get('checkout');
  return v === 'success' || v === 'cancel' ? v : null;
}

/**
 * Ask `billing-checkout` for Stripe's page. Every refusal comes back as the
 * function's own sentence, so the panel never has to invent one.
 */
export async function startCheckout(
  token: string,
  priceId: string,
  fetcher: Fetch = fetch,
  endpoint = checkoutEndpoint(),
  key = env.VITE_SUPABASE_KEY ?? '',
): Promise<Started> {
  if (!endpoint) return { kind: 'refused', said: 'This build has no account service, so nothing can be bought here.' };
  let res: Response;
  try {
    res = await fetcher(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(key ? { apikey: key } : {}),
      },
      body: JSON.stringify({ price_id: priceId, consent: true, consent_text_version: CONSENT_VERSION }),
      cache: 'no-store',
      credentials: 'omit',
    });
  } catch {
    return { kind: 'refused', said: 'Checkout could not be reached. Check your connection and try again. Nothing was charged.' };
  }
  let body: Record<string, unknown> | null = null;
  try {
    const v: unknown = await res.json();
    body = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    body = null;
  }
  if (res.ok && body && typeof body.url === 'string' && body.url.startsWith('https://')) {
    return { kind: 'redirect', url: body.url };
  }
  const said = body && typeof body.error === 'string' && body.error ? body.error : 'Checkout could not start. Nothing was charged.';
  return { kind: 'refused', said };
}

export type Cancelled = { kind: 'cancelled'; endsAt: string } | { kind: 'refused'; said: string };
export type Portal = { kind: 'redirect'; url: string } | { kind: 'refused'; said: string };

/**
 * Open Stripe's short-lived customer portal for receipts, invoices and the
 * payment method. The endpoint resolves the Stripe customer from the caller's
 * authenticated individual billing account; the browser never supplies it.
 */
export async function openBillingPortal(
  token: string,
  fetcher: Fetch = fetch,
  endpoint = portalEndpoint(),
  key = env.VITE_SUPABASE_KEY ?? '',
): Promise<Portal> {
  const fallback = 'Billing history could not be opened. Try again.';
  if (!endpoint) return { kind: 'refused', said: fallback };
  let res: Response;
  try {
    res = await fetcher(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, ...(key ? { apikey: key } : {}) },
      body: '{}',
      cache: 'no-store',
      credentials: 'omit',
    });
  } catch {
    return { kind: 'refused', said: fallback };
  }
  let body: Record<string, unknown> | null = null;
  try {
    const value: unknown = await res.json();
    body = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    body = null;
  }
  if (res.ok && body && typeof body.url === 'string' && body.url.startsWith('https://billing.stripe.com/')) {
    return { kind: 'redirect', url: body.url };
  }
  return { kind: 'refused', said: body && typeof body.error === 'string' && body.error ? body.error : fallback };
}

/**
 * Ask `billing-cancel` to end Plus at the close of the paid period. It tells
 * Stripe first and records it second, so a "cancelled" here means Stripe will
 * not charge again. Refusals come back in the function's own words.
 */
export async function cancelMembership(
  token: string,
  subscriptionId: string,
  fetcher: Fetch = fetch,
  endpoint = cancelEndpoint(),
  key = env.VITE_SUPABASE_KEY ?? '',
): Promise<Cancelled> {
  const fallback = 'The cancellation did not go through. Try again, or email harrisonjrubin7@gmail.com.';
  if (!endpoint) return { kind: 'refused', said: fallback };
  let res: Response;
  try {
    res = await fetcher(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(key ? { apikey: key } : {}) },
      body: JSON.stringify({ subscription_id: subscriptionId }),
      cache: 'no-store',
      credentials: 'omit',
    });
  } catch {
    return { kind: 'refused', said: fallback };
  }
  let body: Record<string, unknown> | null = null;
  try {
    const v: unknown = await res.json();
    body = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    body = null;
  }
  if (res.ok && body && typeof body.ends_at === 'string') return { kind: 'cancelled', endsAt: body.ends_at };
  return { kind: 'refused', said: body && typeof body.error === 'string' && body.error ? body.error : fallback };
}

/**
 * The two reads the Membership panel and Today's Plus card both make, so the
 * price one names and the other charges cannot drift apart. `db` is the
 * Supabase client from `cloud()`; the import is type-only, so this module
 * still loads without the SDK.
 */
type Db = SupabaseClient;

/** Plus's current catalog prices, monthly first; [] when there are none. */
export async function fetchPlusPrices(db: Db): Promise<PlusPrice[]> {
  const { data } = await db
    .from('commercial_prices')
    .select('id, plan_code, amount_cents, currency, billing_interval')
    .eq('plan_code', 'plus');
  return plusPrices(data);
}

/**
 * The signed-in person's own subscription rows: their *individual* billing
 * account only. A billing contact or operator can read other accounts' rows
 * under RLS, and none of those is their plan.
 *
 * A failed read throws rather than returning nothing: PostgREST reports an
 * error in the result instead of rejecting, and "no rows" would read as "not
 * a subscriber" — which would offer Plus to someone already paying for it.
 */
export async function fetchOwnSubscriptions(db: Db, accountId: string): Promise<unknown> {
  const { data, error } = await db
    .from('subscriptions')
    .select('id, plan_code, status, current_period_end, cancel_at_period_end, billing_issue, billing_accounts!inner(kind, user_id)')
    .eq('billing_accounts.kind', 'individual')
    .eq('billing_accounts.user_id', accountId);
  if (error) throw new Error('subscription read failed');
  return data;
}

/**
 * "See Plus" on Today hands over to the Membership panel through this one
 * key: set, the panel opens its upgrade section once and clears it.
 */
export const OPEN_UPGRADE_KEY = 'semester.open-upgrade';

export function askToOpenUpgrade(): void {
  try {
    sessionStorage.setItem(OPEN_UPGRADE_KEY, '1');
  } catch {
    /* Storage refused: the panel opens closed, one tap from the same place. */
  }
}

/** True once if Today asked for the upgrade to be open; the ask is used up. */
export function takeOpenUpgrade(): boolean {
  try {
    const asked = sessionStorage.getItem(OPEN_UPGRADE_KEY) === '1';
    if (asked) sessionStorage.removeItem(OPEN_UPGRADE_KEY);
    return asked;
  } catch {
    return false;
  }
}
