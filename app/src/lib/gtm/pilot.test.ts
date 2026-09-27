import { describe, expect, it } from 'vitest';
import {
  SCORE_CRITERIA, entryProblems, overdue, pilotDataMode, pilotReadiness, pilotVerdict, portfolioDecision, unmappedRoles,
  type DecisionLogEntry, type PilotPlan, type ScoreCriterion,
} from './pilot';

const PLAN: PilotPlan = {
  startDate: '2027-01-11', endDate: '2027-04-30', workflow: 'Orientation next-action checklist', cohort: 'Fall 2027 transfer students',
  baseline: 'Checklist completion 54% by week 2 (fall 2026)', executiveSponsor: 'VP Student Affairs', operationalChampion: 'Director, Transfer Center',
  dataPlan: { minimumNecessary: true, readOnlyFirst: true, sourceLabelled: true },
  metrics: [
    { name: 'Activation rate', target: '≥ 60%', baseline: 'n/a (new)' },
    { name: 'Checklist completion by week 2', target: '≥ 70%', baseline: '54%' },
    { name: 'Student-reported usefulness', target: '≥ 4/5', baseline: 'survey at kickoff' },
  ],
  conversionDate: '2027-05-15', annualPriceAgreed: true, midpointReviewDate: '2027-03-01', productionDataApproved: false,
};

describe('pilot readiness', () => {
  it('accepts a plan with every §6.2 element', () => {
    expect(pilotReadiness(PLAN)).toEqual([]);
  });

  it('refuses a pilot that is really a free trial', () => {
    const trial = { ...PLAN, endDate: '2027-12-31', conversionDate: null, annualPriceAgreed: false, executiveSponsor: null };
    expect(pilotReadiness(trial)).toEqual(expect.arrayContaining(['duration', 'no_conversion_date', 'no_price', 'no_sponsor']));
  });

  it('needs three to five metrics, each with a baseline', () => {
    expect(pilotReadiness({ ...PLAN, metrics: PLAN.metrics.slice(0, 2) })).toContain('metric_count');
    expect(pilotReadiness({ ...PLAN, metrics: [...PLAN.metrics.slice(0, 2), { name: 'x', target: 'y', baseline: null }] })).toContain('metric_baseline');
  });

  it('keeps the conversion decision close to the end of the pilot', () => {
    expect(pilotReadiness({ ...PLAN, conversionDate: '2027-09-01' })).toContain('conversion_outside_window');
  });

  it('runs in sandbox until production data is approved', () => {
    expect(pilotDataMode(PLAN)).toBe('sandbox');
    expect(pilotDataMode({ productionDataApproved: true })).toBe('production');
  });

  it('is not finished without a signed decision, and cannot convert over an open high-severity issue', () => {
    expect(pilotVerdict({ decision: 'convert', signedBy: null, signedAt: null, unresolvedHighSeverity: 0 }).final).toBe(false);
    expect(pilotVerdict({ decision: 'convert', signedBy: 'VP', signedAt: '2027-05-15', unresolvedHighSeverity: 1 }).final).toBe(false);
    expect(pilotVerdict({ decision: 'stop', signedBy: 'VP', signedAt: '2027-05-15', unresolvedHighSeverity: 1 }).final).toBe(true);
  });
});

describe('committee and decision log', () => {
  const entry = (over: Partial<DecisionLogEntry>): DecisionLogEntry => ({
    accountId: 'a', stakeholderId: 's', committeeRole: 'ciso_privacy', question: 'HECVAT', category: 'security', status: 'open',
    owner: 'sam', requestedDate: '2026-09-01', targetDate: '2026-09-20', resolutionDate: null, evidenceLinks: [], riskLevel: 'low', ...over,
  });

  it('lists the review functions nobody has mapped yet', () => {
    expect(unmappedRoles(['executive_sponsor', 'cio'])).toContain('accessibility');
    expect(unmappedRoles(['executive_sponsor', 'cio'])).not.toContain('cio');
  });

  it('puts overdue high-risk items first and ignores resolved ones', () => {
    const now = new Date('2026-10-01');
    const list = overdue([entry({ riskLevel: 'low' }), entry({ riskLevel: 'high', targetDate: '2026-09-25' }), entry({ status: 'approved' })], now);
    expect(list.map((e) => e.riskLevel)).toEqual(['high', 'low']);
  });

  it('needs evidence and a date to close an approval', () => {
    expect(entryProblems(entry({ status: 'approved' }))).toHaveLength(2);
  });
});

describe('portfolio scorecard', () => {
  const all = (n: number) => Object.fromEntries(SCORE_CRITERIA.map((c) => [c, n])) as Record<ScoreCriterion, number>;

  it('maps totals onto the four outcomes at the plan’s thresholds', () => {
    expect(portfolioDecision(all(3))).toEqual({ total: 33, outcome: 'core_platform' });
    expect(portfolioDecision({ ...all(2), reusability: 3, security: 3, privacy: 3, accessibility: 3, auditability: 3 }).outcome).toBe('core_platform'); // 27
    expect(portfolioDecision(all(2)).outcome).toBe('configurable_module'); // 22
    expect(portfolioDecision({ ...all(2), reusability: 1, security: 1 }).outcome).toBe('time_bounded_pilot'); // 20
    expect(portfolioDecision({ ...all(1), reusability: 2, security: 2, privacy: 2 }).outcome).toBe('partner_defer_or_decline'); // 14
  });

  it('refuses a score outside 0–3', () => {
    expect(() => portfolioDecision({ ...all(2), cost_margin: 4 })).toThrow(/0–3/);
  });
});
