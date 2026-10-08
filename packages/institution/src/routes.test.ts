import { describe, expect, it } from 'vitest';
import {
  afterFailure, fellBack, isPinned, refusal, reserveCents, selectRoutes,
  type RouteRequest, type RouteRow,
} from './routes.ts';

const row = (id: string, patch: Partial<RouteRow> = {}): RouteRow => ({
  id, provider: 'openai', model: `${id}-2026-09-01`, regions: ['us'],
  attestation: { zeroRetention: true, noTraining: true, contract: 'MSA-1' },
  capabilities: ['structured-output'], estimatedCents: 1, p95Ms: 800, status: 'active',
  approvedTiers: [0, 1, 2, 3], evidenceUntil: '2026-12-31', ...patch,
});

const req = (patch: Partial<RouteRequest> = {}): RouteRequest => ({
  tenantId: 'northstar', zone: 'us', allowed: ['a', 'b', 'c', 'd'], fallback: ['b'],
  needs: ['structured-output'], tier: 2, maxCents: 5, requireZeroRetention: false, requireNoTraining: false,
  today: '2026-10-04', open: new Set(), ...patch,
});

const table = [
  row('a', { estimatedCents: 1 }),
  row('b', { provider: 'anthropic', estimatedCents: 3 }),
  row('c', { provider: 'anthropic', estimatedCents: 2, regions: ['eu'] }),
  row('d', { provider: 'anthropic', estimatedCents: 1.5 }),
];

describe('pinned models', () => {
  it('accepts a snapshot date and refuses a moving name', () => {
    expect(isPinned('gpt-5-mini-2025-08-07')).toBe(true);
    expect(isPinned('claude-haiku-4-5-20251001')).toBe(true);
    for (const alias of ['gpt-5-mini', 'claude-opus-latest', 'model-preview', 'openai:gpt-5-mini', 'x-2026-09-01-latest']) {
      expect(isPinned(alias), alias).toBe(false);
    }
  });
});

describe('what makes a route ineligible', () => {
  const why = (patch: Partial<RouteRow>, r: Partial<RouteRequest> = {}) => refusal(row('a', patch), req(r));

  it('names each reason, in a fixed order', () => {
    expect(why({})).toBeNull();
    expect(refusal(row('z'), req())).toBe('not-allowed');
    expect(why({ model: 'gpt-5-mini' })).toBe('alias');
    expect(why({ regions: ['eu'] })).toBe('zone');
    expect(why({ capabilities: [] })).toBe('capability');
    expect(why({ status: 'candidate' })).toBe('status');
    expect(why({ status: 'deprecated' })).toBe('status');
    expect(why({ approvedTiers: [0, 1] })).toBe('tier');
    expect(why({ evidenceUntil: null })).toBe('evidence');
    expect(why({ evidenceUntil: '2026-10-03' })).toBe('evidence');
    expect(why({ estimatedCents: 9 })).toBe('cost');
    expect(why({}, { open: new Set(['a']) })).toBe('breaker');
  });

  it('serves a canary only to the tenants it names', () => {
    expect(why({ status: 'canary', canaryTenants: ['northstar'] })).toBeNull();
    expect(why({ status: 'canary', canaryTenants: ['other'] })).toBe('status');
    expect(why({ status: 'canary' })).toBe('status');
  });

  it('asks for evidence at tier 1 and above and not at tier 0', () => {
    expect(why({ evidenceUntil: null }, { tier: 0 })).toBeNull();
    expect(why({ evidenceUntil: null }, { tier: 1 })).toBe('evidence');
  });

  it('counts an attested value only with a contract reference', () => {
    const noContract = { zeroRetention: true, noTraining: true, contract: null };
    expect(why({ attestation: noContract }, { requireZeroRetention: true })).toBe('attestation');
    expect(why({ attestation: noContract }, { requireNoTraining: true })).toBe('attestation');
    expect(why({ attestation: noContract })).toBeNull();
    expect(why({ attestation: { zeroRetention: false, noTraining: true, contract: 'MSA-1' } }, { requireZeroRetention: true })).toBe('attestation');
    expect(why({}, { requireZeroRetention: true, requireNoTraining: true })).toBeNull();
  });

  it('refuses a nonsense cost rather than serving it', () => {
    expect(why({ estimatedCents: Number.NaN })).toBe('cost');
    expect(why({ estimatedCents: -1 })).toBe('cost');
  });
});

describe('selecting a chain', () => {
  it('takes the cheapest eligible route first, then the approved fallbacks in order', () => {
    const { chain } = selectRoutes(table, req({ fallback: ['b', 'd'] }));
    expect(chain.map((r) => r.id)).toEqual(['a', 'b', 'd']);
  });

  it('never crosses a data zone: a cheaper route in another region is not even a fallback', () => {
    const { chain, refused } = selectRoutes(table, req({ fallback: ['c', 'b'] }));
    expect(chain.map((r) => r.id)).toEqual(['a', 'b']);
    expect(refused.c).toBe('zone');
  });

  it('never uses a route that is not on the tenant’s fallback list, however cheap and healthy', () => {
    const { chain } = selectRoutes(table, req({ fallback: ['b'] }));
    expect(chain.map((r) => r.id)).not.toContain('d');
    expect(chain.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('does not let a fallback be a route the tenant has not allowed at all', () => {
    const { chain, refused } = selectRoutes(table, req({ allowed: ['a'], fallback: ['b'] }));
    expect(chain.map((r) => r.id)).toEqual(['a']);
    expect(refused.b).toBe('not-allowed');
  });

  it('skips a route whose breaker is open, as primary and as fallback', () => {
    // `a` open: `d` is the cheapest route left, so it leads; `b` follows from the approved list.
    expect(selectRoutes(table, req({ open: new Set(['a']) })).chain.map((r) => r.id)).toEqual(['d', 'b']);
    expect(selectRoutes(table, req({ allowed: ['a', 'b'], open: new Set(['a']) })).chain.map((r) => r.id)).toEqual(['b']);
    expect(selectRoutes(table, req({ open: new Set(['b']) })).chain.map((r) => r.id)).toEqual(['a']);
  });

  it('breaks a tie on latency, then id, so the choice is the same every time', () => {
    const tied = [row('y', { p95Ms: 900 }), row('x', { p95Ms: 900 }), row('w', { p95Ms: 700 })];
    expect(selectRoutes(tied, req({ allowed: ['w', 'x', 'y'], fallback: [] })).chain[0].id).toBe('w');
    expect(selectRoutes(tied.slice(0, 2), req({ allowed: ['x', 'y'], fallback: [] })).chain[0].id).toBe('x');
  });

  it('returns no chain, with the reasons, when nothing may serve, and relaxes nothing to find one', () => {
    const none = selectRoutes(table, req({ zone: 'ap' }));
    expect(none.chain).toEqual([]);
    expect(Object.values(none.refused)).toEqual(['zone', 'zone', 'zone', 'zone']);
  });

  it('lists a fallback once even if the tenant lists it twice or lists the primary', () => {
    expect(selectRoutes(table, req({ fallback: ['a', 'b', 'b'] })).chain.map((r) => r.id)).toEqual(['a', 'b']);
  });
});

describe('after a failure', () => {
  it('retries once on the same route for a timeout or a server error, then moves on', () => {
    expect(afterFailure(3, { index: 0, retried: false }, 'timeout')).toEqual({ do: 'retry' });
    expect(afterFailure(3, { index: 0, retried: true }, 'timeout')).toEqual({ do: 'next', index: 1 });
    expect(afterFailure(3, { index: 1, retried: true }, 'server-error')).toEqual({ do: 'next', index: 2 });
  });

  it('goes straight to the next route on an invalid response', () => {
    expect(afterFailure(2, { index: 0, retried: false }, 'invalid-response')).toEqual({ do: 'next', index: 1 });
  });

  it('stops, and says so, when the chain is spent', () => {
    expect(afterFailure(2, { index: 1, retried: true }, 'timeout')).toEqual({ do: 'stop', reason: 'exhausted' });
    expect(afterFailure(1, { index: 0, retried: true }, 'server-error')).toEqual({ do: 'stop', reason: 'exhausted' });
  });

  it('never fails over on a refusal, a policy stop or a stream cut part-way, whatever remains in the chain', () => {
    for (const f of ['refusal', 'policy', 'partial-stream'] as const) {
      expect(afterFailure(5, { index: 0, retried: false }, f)).toEqual({ do: 'stop', reason: f });
    }
  });
});

describe('the reservation and the disclosure', () => {
  it('reserves for the worst route in the chain, not the first', () => {
    expect(reserveCents(selectRoutes(table, req({ fallback: ['b'] })).chain)).toBe(3);
    expect(reserveCents([])).toBe(0);
  });

  it('says when a different provider handled the request, and not when the same one did', () => {
    const chain = selectRoutes(table, req({ fallback: ['b'] })).chain;
    expect(fellBack(chain, 0)).toBe(false);
    expect(fellBack(chain, 1)).toBe(true);
    expect(fellBack([row('p'), row('q')], 1)).toBe(false);
  });
});
