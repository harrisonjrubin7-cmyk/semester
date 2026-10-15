import { describe, expect, it } from 'vitest';
import { assemble, type Candidate, type DataTier, type RetrievalPolicy } from '../../../../packages/institution/src/retrieval';
import { gate } from '../toolkit/classification';

/**
 * The server-side retrieval gate must say what the client gate says. The
 * package cannot import the app, so it carries its own copy of the rule, and
 * this is what keeps the two from drifting: for every tier the toolkit knows,
 * and an unclassified source, and a course that does and does not allow AI,
 * `assemble` sends a source exactly when `gate(tier, 'ai', courseAllowsAi)` allows it.
 */

const TIERS: readonly (DataTier | undefined)[] = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', undefined];

const candidate = (classification: DataTier | undefined): Candidate => ({
  tenantId: 't', sourceId: 's', chunkId: 'c', versionHash: 'v', text: 'text', anchor: null, origin: 'course',
  authority: 'authoritative', classification, verifiedAt: null, verifiedBy: null, validUntil: null, superseded: false,
});

const policy = (courseAllowsAi: boolean): RetrievalPolicy => ({
  tenantId: 't', today: '2026-10-04', courseAllowsAi, webAllowed: false, requireVerified: false, maxChunks: 5, maxChars: 100,
});

describe('the server retrieval gate against the toolkit gate', () => {
  it('sends a source exactly when gate(tier, "ai", courseAllowsAi) allows it, for every tier and both course policies', () => {
    for (const tier of TIERS) {
      for (const courseAllowsAi of [true, false]) {
        const sent = assemble([candidate(tier)], policy(courseAllowsAi)).items.length === 1;
        expect(sent, `${tier ?? 'unclassified'} / course ${courseAllowsAi}`).toBe(gate(tier, 'ai', courseAllowsAi).allowed);
      }
    }
  });

  it('is not vacuous: some pairs are allowed and some are not', () => {
    const verdicts = TIERS.flatMap((t) => [true, false].map((c) => gate(t, 'ai', c).allowed));
    expect(verdicts).toContain(true);
    expect(verdicts).toContain(false);
  });
});
