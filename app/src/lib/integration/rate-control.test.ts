import { describe, expect, it } from 'vitest';
import { ConnectionGuard } from './rate-control';

const T = 'school-a';
const C = 'conn-1';
const t0 = 1_000_000;

function fail(g: ConnectionGuard, n: number, at: number, tenant = T, connection = C) {
  for (let i = 0; i < n; i++) {
    const a = g.admit(tenant, connection, at);
    if (a.ok) a.release();
    g.record(tenant, connection, 'retryable_failure', at);
  }
}

describe('the connection guard', () => {
  it('admits up to the per-minute allowance and says when to try again', () => {
    const g = new ConnectionGuard({ perMinute: 3, maxConcurrent: 10 });
    for (let i = 0; i < 3; i++) { const a = g.admit(T, C, t0); expect(a.ok).toBe(true); if (a.ok) a.release(); }
    const refused = g.admit(T, C, t0);
    expect(refused).toMatchObject({ ok: false, reason: 'rate_limited' });
    expect(refused.ok === false && refused.retryAtMs).toBeGreaterThan(t0);
    const later = g.admit(T, C, t0 + 20_000);
    expect(later.ok).toBe(true);
  });

  it('keeps one school’s quota and breaker apart from another’s', () => {
    const g = new ConnectionGuard({ perMinute: 2, failureThreshold: 3 });
    fail(g, 3, t0);
    expect(g.admit(T, C, t0)).toMatchObject({ ok: false, reason: 'circuit_open' });
    expect(g.admit('school-b', C, t0).ok).toBe(true);
    expect(g.admit(T, 'conn-2', t0).ok).toBe(true);
    expect(g.breaker('school-b', C, t0)).toBe('closed');
  });

  it('does not spend a token on a refusal', () => {
    // perMinute 2, one at a time. If the concurrency refusal ate a token, the third call would be limited.
    const g = new ConnectionGuard({ perMinute: 2, maxConcurrent: 1 });
    const first = g.admit(T, C, t0);
    expect(first.ok).toBe(true);
    expect(g.admit(T, C, t0)).toMatchObject({ ok: false, reason: 'concurrency' });
    if (first.ok) first.release();
    const third = g.admit(T, C, t0);
    expect(third.ok).toBe(true);
    if (third.ok) third.release();
    expect(g.admit(T, C, t0)).toMatchObject({ ok: false, reason: 'rate_limited' });
  });

  it('releases a slot once, however many times release is called', () => {
    const g = new ConnectionGuard({ perMinute: 100, maxConcurrent: 2 });
    const a = g.admit(T, C, t0);
    const b = g.admit(T, C, t0);
    if (!a.ok || !b.ok) throw new Error('expected admission');
    a.release(); a.release(); a.release();
    expect(g.admit(T, C, t0).ok).toBe(true);
    expect(g.admit(T, C, t0)).toMatchObject({ ok: false, reason: 'concurrency' });
  });

  it('honours the provider’s Retry-After and only ever extends it', () => {
    const g = new ConnectionGuard({ perMinute: 100 });
    const a = g.admit(T, C, t0);
    if (a.ok) a.release();
    g.record(T, C, 'retryable_failure', t0, 30_000);
    expect(g.admit(T, C, t0 + 29_999)).toMatchObject({ ok: false, reason: 'penalized', retryAtMs: t0 + 30_000 });
    expect(g.admit(T, C, t0 + 30_000).ok).toBe(true);
    g.record(T, C, 'success', t0 + 30_000, 5_000);
    g.record(T, C, 'success', t0 + 30_001, 1_000);
    expect(g.penalizedUntil(T, C)).toBe(t0 + 35_000);
  });
});

describe('the circuit breaker', () => {
  it('opens after the threshold of consecutive retryable failures, and not before', () => {
    const g = new ConnectionGuard({ perMinute: 100, failureThreshold: 5, openMs: 60_000 });
    fail(g, 4, t0);
    expect(g.breaker(T, C, t0)).toBe('closed');
    fail(g, 1, t0);
    expect(g.breaker(T, C, t0)).toBe('open');
    expect(g.admit(T, C, t0 + 59_999)).toMatchObject({ ok: false, reason: 'circuit_open', retryAtMs: t0 + 60_000 });
  });

  it('counts only consecutive failures: a success resets the run', () => {
    const g = new ConnectionGuard({ perMinute: 100, failureThreshold: 3 });
    fail(g, 2, t0);
    g.record(T, C, 'success', t0);
    fail(g, 2, t0);
    expect(g.breaker(T, C, t0)).toBe('closed');
  });

  it('lets exactly one probe through when half open, and closes on its success', () => {
    const g = new ConnectionGuard({ perMinute: 100, failureThreshold: 2, openMs: 60_000 });
    fail(g, 2, t0);
    const at = t0 + 60_000;
    expect(g.breaker(T, C, at)).toBe('half_open');
    const probe = g.admit(T, C, at);
    expect(probe.ok).toBe(true);
    expect(g.admit(T, C, at)).toMatchObject({ ok: false, reason: 'circuit_open' });
    if (probe.ok) probe.release();
    g.record(T, C, 'success', at);
    expect(g.breaker(T, C, at)).toBe('closed');
    expect(g.admit(T, C, at).ok).toBe(true);
  });

  it('reopens for a full period when the probe fails', () => {
    const g = new ConnectionGuard({ perMinute: 100, failureThreshold: 2, openMs: 60_000 });
    fail(g, 2, t0);
    const at = t0 + 60_000;
    const probe = g.admit(T, C, at);
    if (probe.ok) probe.release();
    g.record(T, C, 'retryable_failure', at);
    expect(g.breaker(T, C, at + 59_999)).toBe('open');
    expect(g.breaker(T, C, at + 60_000)).toBe('half_open');
  });

  it('is never opened by permanent failures: those are our fault, not the provider’s', () => {
    const g = new ConnectionGuard({ perMinute: 1000, failureThreshold: 3 });
    for (let i = 0; i < 50; i++) {
      const a = g.admit(T, C, t0);
      if (a.ok) a.release();
      g.record(T, C, 'permanent_failure', t0);
    }
    expect(g.breaker(T, C, t0)).toBe('closed');
  });

  it('stays half open after a permanent failure on the probe, and probes again', () => {
    const g = new ConnectionGuard({ perMinute: 100, failureThreshold: 2, openMs: 60_000 });
    fail(g, 2, t0);
    const at = t0 + 60_000;
    const probe = g.admit(T, C, at);
    if (probe.ok) probe.release();
    g.record(T, C, 'permanent_failure', at);
    expect(g.breaker(T, C, at)).toBe('half_open');
    expect(g.admit(T, C, at).ok).toBe(true);
  });
});
