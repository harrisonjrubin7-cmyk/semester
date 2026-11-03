import { describe, expect, it } from 'vitest';
import { readPilot } from './client';

const base = {
  pilot_id: 'p-1', account_id: 'a-1', account_public_id: 'acct_x', account_name: 'X', account_status: 'pilot',
  segment: 'research', tenant_id: null, tenant_name: null, is_demo: false, workflow: 'W', status: 'proposed',
  start_date: '2026-11-01', end_date: '2027-05-02', midpoint_review_date: null, conversion_date: null,
  has_sponsor: false, has_champion: true, annual_price_agreed: false, production_data_approved: false,
  metric_count: 2, readiness_problems: ['no_price'], outcome_decision: null, outcome_signed_at: null,
  unresolved_high_severity: null, updated_at: null, provenance: 'p', limitation: 'l',
};

describe('pilot portfolio rows', () => {
  it('keeps unknowns as null rather than inventing values', () => {
    const p = readPilot(base);
    expect(p).toMatchObject({ tenantId: null, conversionDate: null, outcomeDecision: null, unresolvedHighSeverity: null, hasSponsor: false, hasChampion: true, metricCount: 2, readinessProblems: ['no_price'] });
  });

  it('refuses a status or decision the console does not know', () => {
    expect(() => readPilot({ ...base, status: 'paused' })).toThrow(/unknown pilot status/);
    expect(() => readPilot({ ...base, status: 'decided', outcome_decision: 'maybe' })).toThrow(/unknown outcome decision/);
  });
});
