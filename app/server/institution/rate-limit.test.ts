import { describe, expect, it } from 'vitest';
import { MemoryRateLimiter, PostgresRateLimiter } from './rate-limit.ts';

const identity = { institutionId: 'school-a', userId: 'student-a' };

describe('institution gateway rate limits', () => {
  it('limits each identity independently in a fixed local window', () => {
    const limiter = new MemoryRateLimiter({ windowMs: 1_000, max: 2 });
    expect(limiter.allow(identity, 10_000)).toBe(true);
    expect(limiter.allow(identity, 10_001)).toBe(true);
    expect(limiter.allow(identity, 10_002)).toBe(false);
    expect(limiter.allow({ ...identity, userId: 'student-b' }, 10_002)).toBe(true);
    expect(limiter.allow(identity, 11_000)).toBe(true);
  });

  it('uses the service-only atomic RPC and passes no request content', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return { data: true, error: null };
      },
    };
    const limiter = new PostgresRateLimiter({
      client: client as never,
      policy: { windowMs: 60_000, max: 60 },
    });
    expect(await limiter.allow(identity, Date.parse('2026-09-24T18:00:00Z'))).toBe(true);
    expect(calls).toEqual([{
      name: 'gateway_take_rate_limit',
      args: {
        want_tenant: 'school-a',
        want_actor: 'student-a',
        want_now: '2026-09-24T18:00:00.000Z',
        want_window_seconds: 60,
        want_max: 60,
      },
    }]);
  });

  it('fails closed when shared storage is unavailable', async () => {
    const limiter = new PostgresRateLimiter({
      client: { rpc: async () => ({ data: null, error: new Error('offline') }) } as never,
    });
    expect(await limiter.allow(identity, Date.now())).toBe(false);
  });

  it('rejects unsafe shared policies', () => {
    const client = { rpc: async () => ({ data: true, error: null }) } as never;
    expect(() => new PostgresRateLimiter({ client, policy: { windowMs: 999, max: 60 } })).toThrow(/window/);
    expect(() => new PostgresRateLimiter({ client, policy: { windowMs: 60_000, max: 0 } })).toThrow(/maximum/);
  });
});
