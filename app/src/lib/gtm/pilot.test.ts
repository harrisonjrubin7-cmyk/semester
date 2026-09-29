import { describe, expect, it } from 'vitest';
import {
  PILOT_DAYS, PILOT_WEEKS, entryProblems, overdue, pilotDataMode, pilotReadiness, pilotVerdict, unmappedRoles,
  type DecisionLogEntry, type PilotPlan,
} from './pilot';

const PLAN: PilotPlan = {
  startDate: '2027-01-11', endDate: '2027-07-12', workflow: 'Orientation next-action checklist', cohort: 'Fall 2027 transfer students',
  baseline: 'Checklist completion 54% by week 2 (fall 2026)', executiveSponsor: 'VP Student Affairs', operationalChampion: 'Director, Transfer Center',
  dataPlan: { minimumNecessary: true, readOnlyFirst: true, sourceLabelled: true },
  metrics: [
    { name: 'Activation rate', target: '≥ 60%', baseline: 'n/a (new)' },
    { name: 'Checklist completion by week 2', target: '≥ 70%', baseline: '54%' },
    { name: 'Student-reported usefulness', target: '≥ 4/5', baseline: 'survey at kickoff' },
  ],
  conversionDate: '2027-07-20', annualPriceAgreed: true, midpointReviewDate: '2027-04-12', productionDataApproved: false,
};

describe('pilot readiness', () => {
  it('accepts a plan with every §6.2 element', () => {
    expect(pilotReadiness(PLAN)).toEqual([]);
  });

  it('runs every pilot for exactly 26 weeks', () => {
    expect(PILOT_WEEKS).toBe(26);
    expect(PILOT_DAYS).toBe(182);
    expect(pilotReadiness(PLAN)).not.toContain('duration');
    for (const endDate of ['2027-07-11', '2027-07-13', '2027-04-30']) {
      expect(pilotReadiness({ ...PLAN, endDate, conversionDate: endDate }), endDate).toContain('duration');
    }
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
    expect(pilotReadiness({ ...PLAN, conversionDate: '2027-10-01' })).toContain('conversion_outside_window');
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
