import { describe, expect, it } from 'vitest';
import { hmacSha256Hex } from './crypto';
import {
  acceptWebhook, httpStatusFor, memoryLedger, verifyWebhook,
  type WebhookHeaders, type WebhookRejection, type WebhookSecret,
} from './webhook-ingress';

const now = new Date('2026-10-01T12:00:00Z');
const nowS = Math.floor(now.getTime() / 1000);
const body = JSON.stringify({ assignment: 9001, state: 'published' });
const current: WebhookSecret = { id: 'k2', secret: 'current-secret' };
const previous: WebhookSecret = { id: 'k1', secret: 'previous-secret' };

async function signed(over: Partial<WebhookHeaders> = {}, opts: { secret?: string; timestamp?: number; payload?: string } = {}): Promise<WebhookHeaders> {
  const timestamp = String(opts.timestamp ?? nowS);
  const sig = await hmacSha256Hex(opts.secret ?? current.secret, `${timestamp}.${opts.payload ?? body}`);
  return { signature: `v1=${sig}`, timestamp, deliveryId: 'delivery-0001', eventType: 'assignment.updated', ...over };
}

const verify = (headers: WebhookHeaders, secrets: WebhookSecret[] = [current], rawBody = body, extra = {}) =>
  verifyWebhook({ rawBody, headers, secrets, now, ...extra });

describe('webhook verification', () => {
  it('accepts a correctly signed, fresh delivery and says which key signed it', async () => {
    expect(await verify(await signed())).toEqual({ ok: true, keyId: 'k2', timestampMs: nowS * 1000 });
  });

  it('refuses a body that changed after signing, and a signature from another secret', async () => {
    expect(await verify(await signed(), [current], `${body} `)).toEqual({ ok: false, reason: 'bad_signature' });
    expect(await verify(await signed({}, { secret: 'attacker' }))).toEqual({ ok: false, reason: 'bad_signature' });
    // The signature is over the timestamp too: moving the clock invalidates it.
    const h = await signed();
    expect(await verify({ ...h, timestamp: String(nowS - 1) })).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('accepts either secret during a rotation, and not one that has expired', async () => {
    const old = await signed({}, { secret: previous.secret });
    expect(await verify(old, [current, previous])).toMatchObject({ ok: true, keyId: 'k1' });
    const expired = { ...previous, notAfter: new Date(now.getTime() - 1) };
    expect(await verify(old, [current, expired])).toEqual({ ok: false, reason: 'bad_signature' });
    expect(await verify(old, [expired])).toEqual({ ok: false, reason: 'no_active_secret' });
    expect(await verify(old, [])).toEqual({ ok: false, reason: 'no_active_secret' });
  });

  it('accepts a header carrying several signatures if one of them is right', async () => {
    const h = await signed();
    expect(await verify({ ...h, signature: `v1=${'0'.repeat(64)}, ${h.signature}` })).toMatchObject({ ok: true });
    expect(await verify({ ...h, signature: `v0=${(h.signature as string).slice(3)}` })).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('bounds the replay window in both directions', async () => {
    const at = (offsetS: number) => signed({}, { timestamp: nowS + offsetS });
    expect(await verify(await at(-299))).toMatchObject({ ok: true });
    expect(await verify(await at(-301))).toEqual({ ok: false, reason: 'stale_timestamp' });
    expect(await verify(await at(299))).toMatchObject({ ok: true });
    expect(await verify(await at(301))).toEqual({ ok: false, reason: 'future_timestamp' });
    expect(await verify(await at(-301), [current], body, { toleranceMs: 600_000 })).toMatchObject({ ok: true });
  });

  it('refuses missing or malformed headers and an oversized body', async () => {
    const h = await signed();
    for (const key of ['signature', 'timestamp', 'deliveryId', 'eventType'] as const) {
      expect(await verify({ ...h, [key]: null }), key).toEqual({ ok: false, reason: 'missing_header' });
    }
    expect(await verify({ ...h, timestamp: 'yesterday' })).toEqual({ ok: false, reason: 'bad_timestamp' });
    expect(await verify({ ...h, eventType: 'bad type\n' })).toEqual({ ok: false, reason: 'bad_event_type' });
    const big = 'x'.repeat(2048);
    expect(await verify(await signed({}, { payload: big }), [current], big, { maxBytes: 1024 })).toEqual({ ok: false, reason: 'too_large' });
  });

  it('answers every rejection with the same status, except size', () => {
    const reasons: WebhookRejection[] = ['missing_header', 'bad_timestamp', 'stale_timestamp', 'future_timestamp', 'no_active_secret', 'bad_signature', 'bad_event_type'];
    expect(new Set(reasons.map(httpStatusFor))).toEqual(new Set([401]));
    expect(httpStatusFor('too_large')).toBe(413);
  });
});

describe('accepting a webhook', () => {
  it('accepts the first delivery and calls the second a duplicate', async () => {
    const ledger = memoryLedger();
    const input = async () => ({ rawBody: body, headers: await signed(), secrets: [current], now, connectionId: 'conn-1', ledger });
    const first = await acceptWebhook(await input());
    const second = await acceptWebhook(await input());
    expect(first).toMatchObject({ outcome: 'accepted', row: { processing_status: 'received' } });
    expect(second).toMatchObject({ outcome: 'duplicate', row: { processing_status: 'duplicate' } });
  });

  it('keeps one connection’s delivery ids apart from another’s', async () => {
    const ledger = memoryLedger();
    const send = async (connectionId: string) => acceptWebhook({ rawBody: body, headers: await signed(), secrets: [current], now, connectionId, ledger });
    expect((await send('conn-1')).outcome).toBe('accepted');
    expect((await send('conn-2')).outcome).toBe('accepted');
  });

  it('lets nobody who cannot sign touch the ledger', async () => {
    const ledger = memoryLedger();
    const result = await acceptWebhook({
      rawBody: body, headers: await signed({}, { secret: 'attacker' }), secrets: [current], now, connectionId: 'conn-1', ledger,
    });
    expect(result).toEqual({ outcome: 'rejected', reason: 'bad_signature', status: 401 });
    expect(ledger.keys.size).toBe(0);
  });

  it('shapes the row for integration_webhook_events: a hash and a type, never the payload', async () => {
    const result = await acceptWebhook({ rawBody: body, headers: await signed(), secrets: [current], now, connectionId: 'c', ledger: memoryLedger() });
    if (result.outcome === 'rejected') throw new Error('expected acceptance');
    expect(result.row.payload_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(result.row.idempotency_key.length).toBeGreaterThanOrEqual(8);
    expect(result.row.idempotency_key.length).toBeLessThanOrEqual(200);
    expect(JSON.stringify(result.row)).not.toContain('published');
  });

  it('derives a key from the body when the delivery id will not fit the column', async () => {
    const result = await acceptWebhook({
      rawBody: body, headers: await signed({ deliveryId: 'x' }), secrets: [current], now, connectionId: 'c', ledger: memoryLedger(),
    });
    if (result.outcome === 'rejected') throw new Error('expected acceptance');
    expect(result.row.idempotency_key).toMatch(/^body-[0-9a-f]{40}$/);
    expect(result.row.provider_event_id).toBe('x');
  });
});
