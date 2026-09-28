import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  PAYLOAD_KEYS,
  SUMMARY_MAX,
  channelFor,
  deliver,
  handle,
  payloadProblem,
  sign,
  type Deps,
  type Delivery,
} from '../../../supabase/functions/_shared/escalation';
import { SUMMARY_MAX as APP_SUMMARY_MAX } from '../community/crisis';

const KEY = 'k'.repeat(40);
const ENV: Record<string, string> = {
  ESCALATION_WEBHOOK_VU_DOS_URL: 'https://safety.example.edu/semester',
  ESCALATION_WEBHOOK_VU_DOS_KEY: KEY,
};
const payload = {
  case_id: 'c1',
  tenant_id: 'vu',
  category: 'threat_or_safety_concern',
  severity: 'P1',
  summary: 'Names a student and a place.',
  occurred_at: '2026-09-27T19:00:00Z',
  agreement_ref: 'VU-DSA-2026-01',
};
const delivery = (patch: Partial<Delivery> = {}): Delivery => ({
  id: 'd1',
  escalation_id: 'e1',
  channel: 'webhook:vu_dos',
  payload,
  attempts: 1,
  ...patch,
});

function deps(patch: Partial<Deps> = {}): Deps & { fetch: ReturnType<typeof vi.fn> } {
  return {
    secret: 's3cret',
    take: vi.fn(async () => [delivery()]),
    delivered: vi.fn(async () => {}),
    failed: vi.fn(async () => {}),
    env: (k) => ENV[k],
    fetch: vi.fn(async () => new Response('thanks, student Bo is known to us', { status: 200 })),
    now: () => new Date('2026-09-27T19:05:00Z'),
    ...patch,
  } as Deps & { fetch: ReturnType<typeof vi.fn> };
}

const req = (auth?: string) => new Request('https://x/escalate', { method: 'POST', headers: auth ? { Authorization: auth } : {} });

describe('the payload, checked again on the way out', () => {
  it('passes exactly what the SQL builds', () => {
    expect(payloadProblem(payload)).toBeNull();
    expect(payloadProblem({ ...payload, subject_ref: 'a'.repeat(64) })).toBeNull();
  });

  it('refuses anything added', () => {
    expect(payloadProblem({ ...payload, author_email: 'bo@vu.edu' })).toMatch(/unexpected field author_email/);
    expect(payloadProblem({ ...payload, subject_ref: 'Bo Smith' })).toMatch(/not a hash/);
  });

  it('refuses a missing field, a long summary, or a severity that cannot be escalated', () => {
    const { agreement_ref: _gone, ...short } = payload;
    expect(payloadProblem(short)).toMatch(/missing agreement_ref/);
    expect(payloadProblem({ ...payload, summary: 'x'.repeat(SUMMARY_MAX + 1) })).toMatch(/too long/);
    expect(payloadProblem({ ...payload, severity: 'P2' })).toMatch(/not escalable/);
    expect(payloadProblem(null)).toBe('not an object');
  });

  it('agrees with the SQL about which keys it builds, and with the app about the cap', () => {
    const sql = readFileSync(new URL('../../../supabase/migrations/20260928032000_community.sql', import.meta.url), 'utf8');
    const start = sql.indexOf('create or replace function public.decide_community_escalation(');
    const built = /jsonb_build_object\(([\s\S]*?)\);/.exec(sql.slice(start))?.[1] ?? '';
    const keys = [...built.matchAll(/'([a-z_]+)',/g)].map((m) => m[1]).sort();
    expect(keys.length, 'read no keys out of the SQL').toBeGreaterThan(3);
    expect(keys).toEqual([...PAYLOAD_KEYS].sort());
    expect(SUMMARY_MAX).toBe(APP_SUMMARY_MAX);
  });
});

describe('a channel is a name; its address lives in the environment', () => {
  it('resolves a configured webhook name', () => {
    expect(channelFor('webhook:vu_dos', (k) => ENV[k])).toEqual({ url: 'https://safety.example.edu/semester', key: KEY });
  });

  it('refuses a raw URL, an unknown scheme or an unconfigured name', () => {
    expect(channelFor('https://evil.example/collect', (k) => ENV[k])).toBeNull();
    expect(channelFor('secure-mail:dos', (k) => ENV[k])).toBeNull();
    expect(channelFor('webhook:nobody', (k) => ENV[k])).toBeNull();
  });

  it('refuses plain http, credentials in the URL, and a short key', () => {
    const env = (over: Record<string, string>) => (k: string) => ({ ...ENV, ...over })[k];
    expect(channelFor('webhook:vu_dos', env({ ESCALATION_WEBHOOK_VU_DOS_URL: 'http://safety.example.edu/' }))).toBeNull();
    expect(channelFor('webhook:vu_dos', env({ ESCALATION_WEBHOOK_VU_DOS_URL: 'https://u:p@safety.example.edu/' }))).toBeNull();
    expect(channelFor('webhook:vu_dos', env({ ESCALATION_WEBHOOK_VU_DOS_KEY: 'short' }))).toBeNull();
  });
});

describe('sending', () => {
  it('posts the payload, signed, with the delivery id as the idempotency key', async () => {
    const d = deps();
    expect(await deliver(delivery(), d)).toBe('sent');
    const [url, init] = d.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://safety.example.edu/semester');
    const headers = init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('d1');
    const ts = String(Math.floor(new Date('2026-09-27T19:05:00Z').getTime() / 1000));
    expect(headers['X-Semester-Signature']).toBe(`t=${ts},v1=${await sign(KEY, ts, init.body as string)}`);
    expect(JSON.parse(init.body as string)).toEqual(payload);
    expect(init.redirect).toBe('error');
    expect(d.delivered).toHaveBeenCalledWith('d1');
  });

  it('never sends a payload that fails the allowlist, and does not retry it', async () => {
    const d = deps();
    expect(await deliver(delivery({ payload: { ...payload, author_email: 'bo@vu.edu' } }), d)).toBe('payload_rejected');
    expect(d.fetch).not.toHaveBeenCalled();
    expect(d.failed).toHaveBeenCalledWith('d1', 'payload_rejected', true);
  });

  it('never sends to an unconfigured channel, and retries so an operator can fix it', async () => {
    const d = deps();
    expect(await deliver(delivery({ channel: 'webhook:nobody' }), d)).toBe('channel_not_configured');
    expect(d.fetch).not.toHaveBeenCalled();
    expect(d.failed).toHaveBeenCalledWith('d1', 'channel_not_configured', false);
  });

  it('records a refusal as its status code, never the words that came back', async () => {
    const d = deps({ fetch: vi.fn(async () => new Response('student Bo Smith is not ours', { status: 502 })) as never });
    expect(await deliver(delivery(), d)).toBe('http_502');
    expect(d.failed).toHaveBeenCalledWith('d1', 'http_502', false);
    expect(d.delivered).not.toHaveBeenCalled();
  });

  it('calls a timeout a timeout and anything else network', async () => {
    const timeout = Object.assign(new Error('slow'), { name: 'TimeoutError' });
    expect(await deliver(delivery(), deps({ fetch: vi.fn(async () => { throw timeout; }) as never }))).toBe('timeout');
    expect(await deliver(delivery(), deps({ fetch: vi.fn(async () => { throw new TypeError('reset'); }) as never }))).toBe('network');
  });
});

describe('the handler', () => {
  it('refuses everything while its secret is unset', async () => {
    const d = deps({ secret: '' });
    expect((await handle(req('Bearer '), d)).status).toBe(503);
    expect(d.take).not.toHaveBeenCalled();
  });

  it('refuses a wrong or missing bearer', async () => {
    const d = deps();
    expect((await handle(req('Bearer nope'), d)).status).toBe(401);
    expect((await handle(req(), d)).status).toBe(401);
    expect(d.take).not.toHaveBeenCalled();
  });

  it('sends what is due and reports counts only', async () => {
    const d = deps({
      take: vi.fn(async () => [delivery(), delivery({ id: 'd2', channel: 'webhook:nobody' })]),
    });
    const res = await handle(req('Bearer s3cret'), d);
    const body = await res.json();
    expect(body).toEqual({ taken: 2, sent: 1, channel_not_configured: 1 });
    expect(JSON.stringify(body)).not.toMatch(/d1|d2|vu_dos|VU-DSA/);
  });
});
