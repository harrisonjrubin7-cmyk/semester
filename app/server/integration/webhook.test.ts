import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  MAX_INTEGRATION_WEBHOOK_BYTES,
  MemoryWebhookReplayStore,
  verifyIntegrationWebhook,
  type WebhookReplayStore,
} from './webhook.ts';

const SECRET = 'provider-webhook-secret';
const NOW = 1_800_000_000;

async function signed(rawBody: string, timestamp = NOW): Promise<string> {
  return `t=${timestamp},v1=${createHmac('sha256', SECRET).update(`${timestamp}.${rawBody}`).digest('hex')}`;
}

const body = (id = 'evt_001') => JSON.stringify({ id, type: 'course.updated', version: '1', data: { courseId: 'c-1' } });

describe('verifyIntegrationWebhook', () => {
  it('verifies the raw body before returning a bounded provider envelope', async () => {
    const rawBody = body();
    const result = await verifyIntegrationWebhook({
      rawBody,
      signatureHeader: await signed(rawBody),
      secret: SECRET,
      nowSeconds: NOW,
      connectionPublicId: 'conn_canvas_1',
      replayStore: new MemoryWebhookReplayStore(),
    });

    expect(result).toEqual({
      ok: true,
      event: { id: 'evt_001', type: 'course.updated', version: '1', data: { courseId: 'c-1' } },
    });
  });

  it.each([
    ['missing_signature', null, SECRET, NOW],
    ['missing_secret', 't=1,v1=bad', '', NOW],
  ] as const)('fails closed for %s', async (code, signatureHeader, secret, nowSeconds) => {
    const result = await verifyIntegrationWebhook({
      rawBody: body(), signatureHeader, secret, nowSeconds,
      connectionPublicId: 'conn_canvas_1', replayStore: new MemoryWebhookReplayStore(),
    });
    expect(result).toEqual({ ok: false, code });
  });

  it('refuses forged and stale signatures', async () => {
    const rawBody = body();
    const forged = await verifyIntegrationWebhook({
      rawBody,
      signatureHeader: await signed(`${rawBody}changed`),
      secret: SECRET,
      nowSeconds: NOW,
      connectionPublicId: 'conn_canvas_1',
      replayStore: new MemoryWebhookReplayStore(),
    });
    const stale = await verifyIntegrationWebhook({
      rawBody,
      signatureHeader: await signed(rawBody, NOW - 301),
      secret: SECRET,
      nowSeconds: NOW,
      connectionPublicId: 'conn_canvas_1',
      replayStore: new MemoryWebhookReplayStore(),
    });
    expect(forged).toEqual({ ok: false, code: 'signature_mismatch' });
    expect(stale).toEqual({ ok: false, code: 'stale_signature' });
  });

  it('rejects an oversized body before signature or JSON processing', async () => {
    const rawBody = 'x'.repeat(MAX_INTEGRATION_WEBHOOK_BYTES + 1);
    const result = await verifyIntegrationWebhook({
      rawBody, signatureHeader: null, secret: '', nowSeconds: NOW,
      connectionPublicId: 'conn_canvas_1', replayStore: new MemoryWebhookReplayStore(),
    });
    expect(result).toEqual({ ok: false, code: 'body_too_large' });
  });

  it.each([
    ['not-json', 'invalid_json'],
    [JSON.stringify({ id: 'evt_001', type: '', data: {} }), 'invalid_envelope'],
    [JSON.stringify({ id: '../evt', type: 'course.updated', data: {} }), 'invalid_envelope'],
    [JSON.stringify({ id: 'evt_001', type: 'course.updated', data: [] }), 'invalid_envelope'],
  ] as const)('refuses malformed provider input without returning it: %s', async (rawBody, code) => {
    const result = await verifyIntegrationWebhook({
      rawBody,
      signatureHeader: await signed(rawBody),
      secret: SECRET,
      nowSeconds: NOW,
      connectionPublicId: 'conn_canvas_1',
      replayStore: new MemoryWebhookReplayStore(),
    });
    expect(result).toEqual({ ok: false, code });
  });

  it('refuses a replay for one connection without crossing connection boundaries', async () => {
    const rawBody = body();
    const signatureHeader = await signed(rawBody);
    const replayStore = new MemoryWebhookReplayStore();
    const verify = (connectionPublicId: string) => verifyIntegrationWebhook({
      rawBody, signatureHeader, secret: SECRET, nowSeconds: NOW, connectionPublicId, replayStore,
    });

    expect((await verify('conn_canvas_1')).ok).toBe(true);
    expect(await verify('conn_canvas_1')).toEqual({ ok: false, code: 'replayed_event' });
    expect((await verify('conn_canvas_2')).ok).toBe(true);
  });

  it('fails closed when durable replay protection is unavailable', async () => {
    const unavailable: WebhookReplayStore = { claim: async () => { throw new Error('store down'); } };
    const rawBody = body();
    const result = await verifyIntegrationWebhook({
      rawBody,
      signatureHeader: await signed(rawBody),
      secret: SECRET,
      nowSeconds: NOW,
      connectionPublicId: 'conn_canvas_1',
      replayStore: unavailable,
    });
    expect(result).toEqual({ ok: false, code: 'replay_unavailable' });
  });
});
