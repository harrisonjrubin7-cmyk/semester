import { describe, expect, it, vi } from 'vitest';
import {
  CONSENT_VERSION,
  cancelEndpoint,
  cancelMembership,
  checkoutEndpoint,
  checkoutReturn,
  consentText,
  currentSubscription,
  hasPaidBefore,
  money,
  openBillingPortal,
  portalEndpoint,
  plusPrices,
  priceWords,
  startCheckout,
} from './membership';
import { TAX_CONSENT_VERSION as SERVER_VERSION } from '../../../supabase/functions/_shared/billingcheckout';

const MONTH = { id: '6d5749ba-47da-4545-86d6-bb89461adac6', plan_code: 'plus', amount_cents: 799, currency: 'usd', billing_interval: 'month' };
const YEAR = { id: '64c5f28d-84dd-452d-b87a-257d6dc9b080', plan_code: 'plus', amount_cents: 5900, currency: 'usd', billing_interval: 'year' };

describe('the catalog', () => {
  it('keeps only Plus prices that can be bought online, monthly first', () => {
    const rows = [YEAR, MONTH, { ...MONTH, id: 'x', plan_code: 'free', amount_cents: 0 }, { ...MONTH, id: 'q', billing_interval: 'quote', amount_cents: null }];
    expect(plusPrices(rows).map((p) => p.interval)).toEqual(['month', 'year']);
    expect(plusPrices(null)).toEqual([]);
  });

  it('says the price the catalog charges, not the planned one', () => {
    const [m, y] = plusPrices([MONTH, YEAR]);
    expect(priceWords(m)).toBe('$7.99 a month');
    expect(priceWords(y)).toBe('$59 a year');
    expect(money(3000)).toBe('$30');
  });
});

describe('consent', () => {
  it('names amount, interval, renewal and the way to cancel', () => {
    const t = consentText(plusPrices([MONTH])[0]);
    expect(t).toContain('$7.99 a month');
    expect(t).toMatch(/applicable sales tax shown before purchase/);
    expect(t).toMatch(/renewing every month until I cancel/);
    expect(t).toMatch(/cancel any time from my Account screen/);
  });

  it('sends a version the server accepts', () => {
    expect(CONSENT_VERSION).toBe(SERVER_VERSION);
  });
});

describe('the subscription', () => {
  it('reads a live paid row, and ignores ended ones', () => {
    const rows = [
      { id: 'a', plan_code: 'plus', status: 'ended', current_period_end: '2026-01-01T00:00:00Z' },
      { id: 'b', plan_code: 'plus', status: 'active', current_period_end: '2026-10-29T00:00:00Z', cancel_at_period_end: false },
    ];
    expect(currentSubscription(rows)).toEqual({ id: 'b', plan: 'plus', status: 'active', periodEnd: '2026-10-29T00:00:00Z', cancelAtPeriodEnd: false, billingIssue: null });
    expect(currentSubscription([rows[0]])).toBeNull();
    expect(currentSubscription(undefined)).toBeNull();
  });

  it('preserves a missing billing-address issue for distinct remediation', () => {
    expect(currentSubscription([{
      id: 'b', plan_code: 'plus', status: 'active', current_period_end: '2026-10-29T00:00:00Z',
      cancel_at_period_end: false, billing_issue: 'address_required',
    }])?.billingIssue).toBe('address_required');
  });

  it('remembers a paid plan that has ended', () => {
    expect(hasPaidBefore([{ plan_code: 'plus', status: 'ended' }])).toBe(true);
    expect(hasPaidBefore([{ plan_code: 'free' }])).toBe(false);
    expect(hasPaidBefore(null)).toBe(false);
  });

  it('hears what Stripe’s return added to the address', () => {
    expect(checkoutReturn('?checkout=success')).toBe('success');
    expect(checkoutReturn('?checkout=cancel&x=1')).toBe('cancel');
    expect(checkoutReturn('?checkout=maybe')).toBeNull();
  });
});

describe('starting a checkout', () => {
  const END = checkoutEndpoint('https://lzrqvlugnawcgywkhqlz.supabase.co/');

  it('addresses the function', () => {
    expect(END).toBe('https://lzrqvlugnawcgywkhqlz.supabase.co/functions/v1/billing-checkout');
    expect(checkoutEndpoint('')).toBe('');
  });

  it('posts the price and the consent with the session token, and follows the page it is given', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/pay/cs_test_1' }), { status: 200 }));
    const r = await startCheckout('tok', MONTH.id, fetcher, END, 'anon');
    expect(r).toEqual({ kind: 'redirect', url: 'https://checkout.stripe.com/c/pay/cs_test_1' });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(END);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body as string)).toEqual({ price_id: MONTH.id, consent: true, consent_text_version: CONSENT_VERSION });
  });

  it('passes the function’s own refusal through, and never follows a non-https page', async () => {
    const refused = vi.fn(async () => new Response(JSON.stringify({ error: 'You already have a subscription.' }), { status: 409 }));
    expect(await startCheckout('tok', MONTH.id, refused, END)).toEqual({ kind: 'refused', said: 'You already have a subscription.' });
    const odd = vi.fn(async () => new Response(JSON.stringify({ url: 'http://evil.example' }), { status: 200 }));
    expect((await startCheckout('tok', MONTH.id, odd, END)).kind).toBe('refused');
    const down = vi.fn(async () => {
      throw new TypeError('network');
    });
    expect(await startCheckout('tok', MONTH.id, down, END)).toMatchObject({ kind: 'refused', said: expect.stringContaining('Nothing was charged') });
  });
});

describe('cancelling', () => {
  const END = cancelEndpoint('https://lzrqvlugnawcgywkhqlz.supabase.co');

  it('posts to billing-cancel with the session token and reads when Plus ends', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ ends_at: '2026-10-29T12:00:00Z' }), { status: 200 }));
    expect(await cancelMembership('tok', 's1', fetcher, END, 'anon')).toEqual({ kind: 'cancelled', endsAt: '2026-10-29T12:00:00Z' });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://lzrqvlugnawcgywkhqlz.supabase.co/functions/v1/billing-cancel');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body as string)).toEqual({ subscription_id: 's1' });
  });

  it('passes a refusal through, and never calls a failure a cancellation', async () => {
    const refused = vi.fn(async () => new Response(JSON.stringify({ error: 'You are still subscribed; try again.' }), { status: 502 }));
    expect(await cancelMembership('tok', 's1', refused, END)).toEqual({ kind: 'refused', said: 'You are still subscribed; try again.' });
    const down = vi.fn(async () => { throw new TypeError('network'); });
    expect((await cancelMembership('tok', 's1', down, END)).kind).toBe('refused');
    expect((await cancelMembership('tok', 's1', refused, '')).kind).toBe('refused');
  });
});

describe('billing history', () => {
  const END = portalEndpoint('https://lzrqvlugnawcgywkhqlz.supabase.co/');

  it('opens only the Stripe-hosted portal returned for the signed-in account', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ url: 'https://billing.stripe.com/p/session/live_1' }), { status: 200 }));
    expect(await openBillingPortal('tok', fetcher, END, 'anon')).toEqual({ kind: 'redirect', url: 'https://billing.stripe.com/p/session/live_1' });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://lzrqvlugnawcgywkhqlz.supabase.co/functions/v1/billing-portal');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('passes refusals through and rejects arbitrary redirects', async () => {
    const refused = vi.fn(async () => new Response(JSON.stringify({ error: 'There is no billing history for this account.' }), { status: 404 }));
    expect(await openBillingPortal('tok', refused, END)).toEqual({ kind: 'refused', said: 'There is no billing history for this account.' });
    const odd = vi.fn(async () => new Response(JSON.stringify({ url: 'https://evil.example' }), { status: 200 }));
    expect((await openBillingPortal('tok', odd, END)).kind).toBe('refused');
  });
});
