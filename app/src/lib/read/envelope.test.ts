import { describe, expect, it } from 'vitest';
import { OPERATIONAL_STATES, effectiveState, envelope, present, type ReadEnvelope } from './envelope';

const NOW = Date.parse('2026-10-04T12:00:00Z');
const src = { id: 't', label: 'Test', kind: 'estimated' };
const iso = (ms: number) => new Date(ms).toISOString();
const make = (over: Partial<ReadEnvelope<string[]>> = {}) =>
  envelope<string[]>({ state: 'connected', authority: 'derived', source: src, data: ['a'], observedAt: iso(NOW - 1000), ...over });

describe('effectiveState — fail closed', () => {
  it('an unknown state is unavailable, never connected', () => {
    expect(effectiveState(make({ state: 'ok' as never }), NOW)).toBe('unavailable');
    expect(effectiveState(make({ state: undefined as never }), NOW)).toBe('unavailable');
  });

  it('a read the caller may not make is denied whatever state it claims', () => {
    const env = make({ state: 'connected', permission: { canRead: false, allowedActions: [] } });
    expect(effectiveState(env, NOW)).toBe('permission_denied');
  });

  it('unknown freshness is stale, not current', () => {
    expect(effectiveState(make({ observedAt: null }), NOW)).toBe('stale');
    expect(effectiveState(make({ observedAt: 'not a date' }), NOW)).toBe('stale');
  });

  it('a read past staleAfter is stale; before it, connected (control)', () => {
    expect(effectiveState(make({ staleAfter: iso(NOW - 1) }), NOW)).toBe('stale');
    expect(effectiveState(make({ staleAfter: iso(NOW + 60_000) }), NOW)).toBe('connected');
  });

  it('verified needs a verifier time and an authority that can verify', () => {
    const base = { state: 'verified' as const, staleAfter: iso(NOW + 60_000) };
    expect(effectiveState(make({ ...base, authority: 'sis', verifiedAt: iso(NOW - 5) }), NOW)).toBe('verified');
    expect(effectiveState(make({ ...base, authority: 'sis', verifiedAt: null }), NOW)).toBe('connected');
    // A device-derived or student-entered fact is never "verified", however it is stamped.
    expect(effectiveState(make({ ...base, authority: 'derived', verifiedAt: iso(NOW - 5) }), NOW)).toBe('connected');
    expect(effectiveState(make({ ...base, authority: 'student', verifiedAt: iso(NOW - 5) }), NOW)).toBe('connected');
  });

  it('every documented state is accepted as itself when it has no evidence to contradict it', () => {
    for (const s of OPERATIONAL_STATES) {
      if (s === 'connected' || s === 'verified') continue; // these need evidence, tested above
      expect(effectiveState(make({ state: s }), NOW)).toBe(s);
    }
  });
});

describe('present', () => {
  it('denial leaks nothing: data and limitations are dropped', () => {
    const p = present(make({ permission: { canRead: false, allowedActions: [] }, limitations: ['secret detail'] }), NOW);
    expect(p.surface).toBe('denied');
    expect(p.data).toBeNull();
    expect(p.limitations).toEqual([]);
  });

  it('loading and failed never show data', () => {
    expect(present(make({ state: 'loading' }), NOW).data).toBeNull();
    expect(present(make({ state: 'error' }), NOW).data).toBeNull();
    expect(present(make({ state: 'error' }), NOW).surface).toBe('failed');
  });

  it('offline and stale keep the last data, beside a notice', () => {
    const off = present(make({ state: 'offline' }), NOW);
    expect(off).toMatchObject({ surface: 'offline', data: ['a'], withNotice: true });
    const stale = present(make({ staleAfter: iso(NOW - 1) }), NOW);
    expect(stale).toMatchObject({ surface: 'degraded', data: ['a'], withNotice: true });
  });

  it('stale with no data stands alone as degraded, with no notice-beside', () => {
    expect(present(make({ data: null, staleAfter: iso(NOW - 1) }), NOW)).toMatchObject({ surface: 'degraded', withNotice: false });
  });

  it('pending approval is not content', () => {
    expect(present(make({ state: 'pending_approval' }), NOW).surface).toBe('pending');
  });

  it('connected with data is plain content (control)', () => {
    expect(present(make(), NOW)).toMatchObject({ surface: 'content', withNotice: false, data: ['a'] });
  });
});
