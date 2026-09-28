import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFERRED, DIMENSIONS, FRAMEWORKS, GATE, admit, priority, type Dimension, type Proposal } from './expansiongovernance';

const root = join(import.meta.dirname, '../../..');

const all = (n: number) => Object.fromEntries(Object.keys(DIMENSIONS).map((d) => [d, n])) as Record<Dimension, number>;

describe('the priority score', () => {
  it('uses the weights the plan sets', () => {
    expect(Object.fromEntries(Object.entries(DIMENSIONS).map(([d, v]) => [d, v.weight]))).toEqual({
      trust: 1.5,
      revenue: 1.3,
      studentValue: 1.2,
      differentiation: 1.1,
      dependency: 1.2,
      evidenceUrgency: 1.2,
      readiness: 0.8,
      complexity: -1,
      irreversibility: -1,
    });
  });

  it('scores a card by hand', () => {
    // 1.5+1.3+1.2+1.1+1.2+1.2+0.8 = 8.3 per point of benefit; -2 per point of cost.
    expect(priority(all(1))).toBe(6.3);
    expect(priority(all(5))).toBe(31.5);
    expect(priority({ ...all(5), complexity: 1, irreversibility: 1 })).toBe(39.5);
    expect(priority({ ...all(1), complexity: 5, irreversibility: 5 })).toBe(-1.7);
  });

  it('rises with trust and falls with irreversibility', () => {
    expect(priority({ ...all(3), trust: 4 })!).toBeGreaterThan(priority(all(3))!);
    expect(priority({ ...all(3), irreversibility: 4 })!).toBeLessThan(priority(all(3))!);
  });

  it('refuses an incomplete or out-of-range card rather than guessing', () => {
    const { trust: _omit, ...partial } = all(3);
    expect(priority(partial)).toBeNull();
    expect(priority({ ...all(3), trust: 0 })).toBeNull();
    expect(priority({ ...all(3), trust: 6 })).toBeNull();
    expect(priority({ ...all(3), trust: 2.5 })).toBeNull();
  });
});

describe('the admission gate', () => {
  const reason = 'Written down in the charter and reviewed by the council.';
  const good = (): Proposal => ({
    name: 'Credential wallet foundation',
    tier: 2,
    route: 'module',
    answers: Object.fromEntries(GATE.map((g) => [g.id, reason])),
  });

  it('admits a complete proposal', () => {
    expect(admit(good())).toEqual({ admitted: true, unanswered: [], reasons: [] });
  });

  it('refuses on each unanswered question, one at a time, and a bare yes is unanswered', () => {
    for (const g of GATE) {
      const p = good();
      p.answers[g.id] = 'yes';
      const a = admit(p);
      expect(a.admitted, g.id).toBe(false);
      expect(a.unanswered).toEqual([g.id]);
    }
  });

  it('refuses a scorecard route that is not delivery', () => {
    expect(admit({ ...good(), route: 'reject_or_redesign' }).admitted).toBe(false);
    expect(admit({ ...good(), route: 'partner_or_decline' }).admitted).toBe(false);
    for (const route of ['core', 'module', 'pilot'] as const) expect(admit({ ...good(), route }).admitted, route).toBe(true);
  });

  it('refuses Tier 4 and anything deferred without a recorded governance review', () => {
    expect(admit({ ...good(), tier: 4 }).admitted).toBe(false);
    expect(admit({ ...good(), touchesDeferred: 'Biometric proctoring' }).admitted).toBe(false);
    expect(admit({ ...good(), touchesDeferred: 'Biometric proctoring', governanceReview: 'AI Governance Board, minutes of 2027-02-01, item 4' }).admitted).toBe(true);
    expect(admit({ ...good(), tier: 4, governanceReview: 'AI Governance Board, minutes of 2027-02-01, item 4' }).admitted).toBe(true);
  });

  it('refuses a deferred line that is not on the list, so the list cannot be dodged by a new name', () => {
    expect(admit({ ...good(), touchesDeferred: 'Mood detection', governanceReview: 'AI Governance Board, minutes of 2027-02-01, item 4' }).admitted).toBe(false);
  });

  it('carries the final expansion test and the plan\'s decision gate', () => {
    expect(GATE).toHaveLength(13);
    expect(new Set(GATE.map((g) => g.id)).size).toBe(GATE.length);
  });
});

describe('the frameworks', () => {
  it('cite only files that exist', () => {
    for (const f of FRAMEWORKS) for (const p of f.evidence) expect(existsSync(join(root, p)), `${f.name} → ${p}`).toBe(true);
  });

  it('claim no certification or compliance', () => {
    const claim = /\b(certified|compliant|conformant|attested)\b/i;
    for (const f of FRAMEWORKS) {
      const said = `${f.use} ${f.note}`.replace(/\bnot (?:\w+ )?(certified|compliant|conformant)\b/gi, '');
      expect(claim.test(said), `${f.name}: ${f.note}`).toBe(false);
    }
    // The control: the rule does catch a claim.
    expect(claim.test('Semester is SOC 2 attested.')).toBe(true);
  });

  it('adopt now only what has a use today, and say when for the rest', () => {
    for (const f of FRAMEWORKS) expect(['now', 'readiness-now', 'when-justified']).toContain(f.adopt);
    expect(FRAMEWORKS.filter((f) => f.adopt === 'now').length).toBeGreaterThan(10);
  });
});

describe('what waits', () => {
  it('holds every line the plans name', () => {
    expect(DEFERRED).toHaveLength(16);
    expect(new Set(DEFERRED.map((d) => d.what)).size).toBe(DEFERRED.length);
  });

  it('agrees with DO-NOT-BUILD rule 3', () => {
    expect(readFileSync(join(root, 'docs/DO-NOT-BUILD.md'), 'utf8')).toMatch(/No unexplained score, risk label or recommendation/);
  });
});
