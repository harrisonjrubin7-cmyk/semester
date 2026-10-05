import { describe, expect, it } from 'vitest';
import { assemble, dropReason, type Candidate, type RetrievalPolicy } from './retrieval.ts';

const cand = (id: string, patch: Partial<Candidate> = {}): Candidate => ({
  tenantId: 'northstar', sourceId: id, chunkId: `${id}-1`, versionHash: 'v1', text: `text of ${id}`, anchor: 'p. 2',
  origin: 'course', authority: 'authoritative', classification: 'T1', verifiedAt: '2026-09-01', verifiedBy: 'registrar',
  validUntil: '2026-12-31', superseded: false, ...patch,
});

const policy = (patch: Partial<RetrievalPolicy> = {}): RetrievalPolicy => ({
  tenantId: 'northstar', today: '2026-10-04', courseAllowsAi: true, webAllowed: false, requireVerified: false,
  maxChunks: 5, maxChars: 1000, ...patch,
});

describe('what may not be sent, and why', () => {
  const why = (patch: Partial<Candidate>, p: Partial<RetrievalPolicy> = {}) => dropReason(cand('a', patch), policy(p));

  it('names each reason, in a fixed order', () => {
    expect(why({})).toBeNull();
    expect(why({ tenantId: 'other' })).toBe('other-tenant');
    expect(why({ authority: 'prohibited' })).toBe('prohibited');
    expect(why({ superseded: true })).toBe('superseded');
    expect(why({ classification: 'T3' })).toBe('classification');
    expect(why({}, { courseAllowsAi: false })).toBe('course-policy');
    expect(why({ origin: 'web' })).toBe('web-not-allowed');
    expect(why({ validUntil: '2026-10-03' })).toBe('stale');
    expect(why({ verifiedAt: null }, { requireVerified: true })).toBe('unverified');
    expect(why({ verifiedBy: null }, { requireVerified: true })).toBe('unverified');
  });

  it('treats an unclassified source as an education record, and sends nothing from T3 up', () => {
    expect(why({ classification: undefined })).toBe('classification');
    for (const t of ['T3', 'T4', 'T5', 'T6'] as const) expect(why({ classification: t }), t).toBe('classification');
    for (const t of ['T0', 'T1', 'T2'] as const) expect(why({ classification: t }), t).toBeNull();
  });

  it('never widens the course policy: public material is still refused where the course says no', () => {
    expect(why({ classification: 'T0' }, { courseAllowsAi: false })).toBe('course-policy');
  });

  it('lets web material through only where the institution allows it', () => {
    expect(why({ origin: 'web' }, { webAllowed: true })).toBeNull();
  });

  it('sends a source on its last valid day and not the day after', () => {
    expect(why({ validUntil: '2026-10-04' })).toBeNull();
    expect(why({ validUntil: '2026-10-03' })).toBe('stale');
  });

  it('does not ask for verification unless told to', () => {
    expect(why({ verifiedAt: null, verifiedBy: null })).toBeNull();
  });
});

describe('assembling the set', () => {
  it('keeps the caller’s order, carries authority and provenance, and says which sources are undated', () => {
    const { items } = assemble([cand('b', { authority: 'supplemental' }), cand('a', { validUntil: null })], policy());
    expect(items.map((i) => i.sourceId)).toEqual(['b', 'a']);
    expect(items[0]).toMatchObject({ authority: 'supplemental', anchor: 'p. 2', undated: false });
    expect(items[1]).toMatchObject({ authority: 'authoritative', undated: true });
  });

  it('reports every drop with its reason and never the text', () => {
    const out = assemble([cand('a'), cand('b', { classification: 'T4' }), cand('c', { validUntil: '2026-01-01' })], policy());
    expect(out.items.map((i) => i.sourceId)).toEqual(['a']);
    expect(out.dropped).toEqual([
      { sourceId: 'b', chunkId: 'b-1', reason: 'classification' },
      { sourceId: 'c', chunkId: 'c-1', reason: 'stale' },
    ]);
    expect(JSON.stringify(out.dropped)).not.toContain('text of');
  });

  it('flags another tenant’s source as a divergence and never as a quiet drop', () => {
    const out = assemble([cand('a'), cand('x', { tenantId: 'other' })], policy());
    expect(out.crossTenant).toBe(true);
    expect(out.dropped).toEqual([{ sourceId: 'x', chunkId: 'x-1', reason: 'other-tenant' }]);
    expect(assemble([cand('a')], policy()).crossTenant).toBe(false);
  });

  it('bounds the count and the size before the call, drops the overflow and tries the next', () => {
    const many = ['a', 'b', 'c'].map((id) => cand(id));
    expect(assemble(many, policy({ maxChunks: 2 })).dropped).toEqual([{ sourceId: 'c', chunkId: 'c-1', reason: 'budget' }]);
    const big = [cand('big', { text: 'x'.repeat(900) }), cand('huge', { text: 'y'.repeat(900) }), cand('small', { text: 'z'.repeat(50) })];
    const out = assemble(big, policy({ maxChars: 1000 }));
    expect(out.items.map((i) => i.sourceId)).toEqual(['big', 'small']);
    expect(out.dropped).toEqual([{ sourceId: 'huge', chunkId: 'huge-1', reason: 'budget' }]);
  });

  it('never truncates text to make it fit', () => {
    const out = assemble([cand('a', { text: 'x'.repeat(2000) })], policy({ maxChars: 1000 }));
    expect(out.items).toEqual([]);
    expect(out.dropped[0].reason).toBe('budget');
  });

  it('keys the set by id, chunk and version, in order, so the audit can hash what was sent', () => {
    const out = assemble([cand('a', { versionHash: 'v7' }), cand('b')], policy());
    expect(out.key).toBe('a#a-1@v7|b#b-1@v1');
    expect(assemble([], policy()).key).toBe('');
  });

  it('returns an empty set, with reasons, when nothing may be sent, and relaxes nothing to find one', () => {
    const out = assemble([cand('a')], policy({ courseAllowsAi: false }));
    expect(out.items).toEqual([]);
    expect(out.dropped).toHaveLength(1);
  });
});
