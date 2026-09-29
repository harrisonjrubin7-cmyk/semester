/// <reference types="node" />
import { createHash, createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleBillingWebhook, type WebhookDeps } from '../../../../supabase/functions/_shared/billingwebhook';

const SECRET = 'whsec_webhook_test';
const NOW = 1790000000;
const CHECKOUT = '3f2b8c1e-9a4d-4e7b-8c21-5d6f7a8b9c0d';

function sign(body: string, t = NOW, secret = SECRET): string {
  return `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
}

function deps(over: Partial<WebhookDeps> = {}) {
  const calls: string[] = [];
  const d = {
    secret: SECRET,
    now: () => NOW,
    completeCheckout: vi.fn(async () => { calls.push('complete'); return 'sub-id'; }),
    syncSubscription: vi.fn(async () => { calls.push('sync'); return 'updated'; }),
    upsertInvoice: vi.fn(async () => { calls.push('invoice'); return 'inv-uuid'; }),
    applyEvent: vi.fn(async () => { calls.push('apply'); return 'recorded'; }),
    ...over,
  };
  return { d: d as WebhookDeps & typeof d, calls };
}

const event = (type: string, object: Record<string, unknown>, id = 'evt_1') =>
  JSON.stringify({ id, type, created: NOW - 5, data: { object } });

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request('https://project.supabase.co/functions/v1/billing-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sign(body), ...headers },
    body,
  });

afterEach(() => vi.restoreAllMocks());

describe('the billing webhook', () => {
  it('is off, with a plain sentence, until its secret is set', async () => {
    const { d } = deps({ secret: undefined });
    const res = await handleBillingWebhook(post(event('invoice.paid', {})), d);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'Billing is not configured.' });
    expect(d.applyEvent).not.toHaveBeenCalled();
  });

  it('refuses a forged, stale or unsigned event before reading it', async () => {
    const body = event('invoice.paid', { id: 'in_1', subscription: 'sub_1', amount_paid: 399 });
    for (const sig of [sign(body, NOW, 'whsec_wrong'), sign(body, NOW - 301), '']) {
      const { d } = deps();
      const res = await handleBillingWebhook(post(body, { 'Stripe-Signature': sig }), d);
      expect(res.status).toBe(400);
      expect(d.applyEvent).not.toHaveBeenCalled();
      expect(d.upsertInvoice).not.toHaveBeenCalled();
    }
  });

  it('fails closed on CORS: no header on any answer, no preflight, no browser', async () => {
    const { d } = deps();
    const pre = await handleBillingWebhook(new Request('https://x/functions/v1/billing-webhook', { method: 'OPTIONS' }), d);
    expect(pre.status).toBe(405);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const body = event('invoice.paid', {});
    const browser = await handleBillingWebhook(post(body, { Origin: 'https://semester.example' }), d);
    expect(browser.status).toBe(403);
    expect(browser.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const ok = await handleBillingWebhook(post(body), d);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('hashes the raw body it verified, and records the event last', async () => {
    const { d, calls } = deps();
    const body = event('invoice.payment_failed', { id: 'in_1', subscription: 'sub_1', amount_due: 399, currency: 'usd', created: NOW - 60 });
    const res = await handleBillingWebhook(post(body), d);
    expect(res.status).toBe(200);
    expect(calls).toEqual(['invoice', 'apply']);
    expect(d.upsertInvoice).toHaveBeenCalledWith('sub_1', 'in_1', 399, 'usd', expect.any(String), expect.any(String));
    expect(d.applyEvent).toHaveBeenCalledWith(
      'evt_1', 'payment_failed', 'inv-uuid', 399, createHash('sha256').update(body).digest('hex'));
  });

  it('turns a completed checkout into a subscription, by the checkout id it carries', async () => {
    const { d, calls } = deps();
    const body = event('checkout.session.completed', {
      mode: 'subscription', client_reference_id: CHECKOUT, subscription: 'sub_9', customer: { id: 'cus_9' },
    });
    await handleBillingWebhook(post(body), d);
    expect(d.completeCheckout).toHaveBeenCalledWith(CHECKOUT, 'sub_9', 'cus_9');
    expect(calls).toEqual(['complete', 'apply']);
    expect(vi.mocked(d.applyEvent!).mock.calls[0][1]).toBe('other');
  });

  it('ignores a completed checkout that is not one of Semester’s', async () => {
    const { d } = deps();
    await handleBillingWebhook(post(event('checkout.session.completed', { mode: 'subscription', client_reference_id: 'not-a-uuid' })), d);
    expect(d.completeCheckout).not.toHaveBeenCalled();
  });

  it('syncs a subscription change with the event’s own time, reading the period off the items when needed', async () => {
    const { d } = deps();
    await handleBillingWebhook(post(event('customer.subscription.updated', {
      id: 'sub_1', status: 'active', cancel_at_period_end: true,
      items: { data: [{ current_period_start: NOW - 100, current_period_end: NOW + 2_592_000 }] },
    })), d);
    expect(d.syncSubscription).toHaveBeenCalledWith(
      'sub_1', 'active', new Date((NOW - 100) * 1000).toISOString(), new Date((NOW + 2_592_000) * 1000).toISOString(),
      true, new Date((NOW - 5) * 1000).toISOString(),
    );
    await handleBillingWebhook(post(event('customer.subscription.deleted', { id: 'sub_1', status: 'canceled' }, 'evt_2')), d);
    expect(vi.mocked(d.syncSubscription!).mock.calls[1][1]).toBe('ended');
  });

  it('records refunds and disputes by kind, and anything else as other', async () => {
    const { d } = deps();
    await handleBillingWebhook(post(event('charge.refunded', { amount_refunded: 399 })), d);
    await handleBillingWebhook(post(event('charge.dispute.created', { amount: 399 }, 'evt_3')), d);
    await handleBillingWebhook(post(event('customer.created', {}, 'evt_4')), d);
    expect(vi.mocked(d.applyEvent!).mock.calls.map((c) => [c[1], c[3]])).toEqual([['refund', 399], ['chargeback', 399], ['other', null]]);
  });

  it('answers 500 and logs nothing about the event when applying fails, so the provider retries', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const info = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { d } = deps({ applyEvent: vi.fn(async () => { throw new Error('db down'); }) });
    const body = event('invoice.paid', { id: 'in_secret_1', subscription: 'sub_secret', customer_email: 'student@example.edu' });
    const res = await handleBillingWebhook(post(body), d);
    expect(res.status).toBe(500);
    const logged = JSON.stringify([...log.mock.calls, ...info.mock.calls]);
    for (const leak of ['in_secret_1', 'sub_secret', 'student@example.edu', 'evt_1', body]) expect(logged).not.toContain(leak);
  });

  it('asks for a retry, recording nothing, when an invoice arrives before its subscription', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { d } = deps({ upsertInvoice: vi.fn(async () => null) });
    const body = event('invoice.paid', { id: 'in_secret_2', subscription: 'sub_not_yet', amount_paid: 399 });
    const res = await handleBillingWebhook(post(body), d);
    expect(res.status).toBe(500);
    expect(d.upsertInvoice).toHaveBeenCalledTimes(1);
    expect(d.applyEvent).not.toHaveBeenCalled();
    const logged = JSON.stringify(log.mock.calls);
    for (const leak of ['in_secret_2', 'sub_not_yet', 'evt_1', body]) expect(logged).not.toContain(leak);
    // An invoice that bills no subscription has nothing to wait for: recorded as before.
    const one = await handleBillingWebhook(post(event('invoice.paid', { id: 'in_once', amount_paid: 500 }, 'evt_2')), d);
    expect(one.status).toBe(200);
    expect(d.upsertInvoice).toHaveBeenCalledTimes(1);
    expect(d.applyEvent).toHaveBeenCalledWith('evt_2', 'payment_succeeded', null, 500, expect.any(String));
  });

  it('refuses a body over the limit without reading it', async () => {
    const { d } = deps();
    const res = await handleBillingWebhook(post('{}', { 'Content-Length': String(10 * 1024 * 1024) }), d);
    expect(res.status).toBe(413);
  });
});
