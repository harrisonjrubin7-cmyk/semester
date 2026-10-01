import { describe, expect, it } from 'vitest';
import { metricState, TRUST_METRICS, trustScorecard } from './institutional-trust-scorecard';

describe('institutional trust scorecard', () => {
  it('uses metric states instead of combining unrelated controls into a score', () => {
    expect(TRUST_METRICS).toHaveLength(15);
    expect(trustScorecard([]).every((metric) => metric.state === 'gray')).toBe(true);
    expect(trustScorecard([]).every((metric) => metric.value === 'Baseline not recorded')).toBe(true);
  });

  it('fails controls red and stale, missed, or worsening measurements yellow', () => {
    expect(metricState({ id: 'x', targetMet: true, evidenceCurrent: true, controlFailure: true, value: 'failed', evidenceAt: 1 }).state).toBe('red');
    expect(metricState({ id: 'x', targetMet: false, evidenceCurrent: true, value: 'below target', evidenceAt: 1 }).state).toBe('yellow');
    expect(metricState({ id: 'x', targetMet: true, evidenceCurrent: false, value: 'stale', evidenceAt: 1 }).state).toBe('yellow');
    expect(metricState({ id: 'x', targetMet: true, evidenceCurrent: true, trendWorsening: true, value: 'falling', evidenceAt: 1 }).state).toBe('yellow');
  });

  it('marks only current target-meeting evidence green', () => {
    expect(metricState({ id: 'x', targetMet: true, evidenceCurrent: true, value: 'met', evidenceAt: 1 }).state).toBe('green');
  });
});
