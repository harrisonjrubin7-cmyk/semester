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

const env = import.meta.env as unknown as Record<string, string | undefined>;

/** The wording a person agrees to, and the version recorded with it. Change one, change both. */
export const CONSENT_VERSION = 'plus-v1';

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
}

export type Started = { kind: 'redirect'; url: string } | { kind: 'refused'; said: string };

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

/** The function's address for this build, or '' when the build has no project. */
export function checkoutEndpoint(base = env.VITE_SUPABASE_URL ?? ''): string {
  return base ? `${base.replace(/\/$/, '')}/functions/v1/billing-checkout` : '';
}

/** "$3.99", "$29.99", "$30" — in the catalog's currency, US dollars as written today. */
export function money(cents: number, currency = 'usd'): string {
  const n = cents / 100;
  const s = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return currency.toLowerCase() === 'usd' ? `$${s}` : `${s} ${currency.toUpperCase()}`;
}

/** "$3.99 a month", "$29.99 a year". */
export function priceWords(p: PlusPrice): string {
  return `${money(p.cents, p.currency)} a ${p.interval}`;
}

/**
 * What the checkbox says. Everything a recurring-charge consent has to name:
 * the amount, how often, that it renews, and how to stop it.
 */
export function consentText(p: PlusPrice): string {
  return (
    `I agree to be charged ${priceWords(p)} for Semester Plus, renewing every ${p.interval} ` +
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
    };
  }
  return null;
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
