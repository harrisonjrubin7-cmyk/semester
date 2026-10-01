import { describe, expect, it } from 'vitest';
import { evidenceDateLabel, metricState, TRUST_METRICS, trustScorecard } from './institutional-trust-scorecard';

describe('institutional trust scorecard', () => {
  it('uses metric states instead of combining unrelated controls into a score', () => {
    expect(TRUST_METRICS).toHaveLength(15);
    expect(trustScorecard([]).every((metric) => metric.state === 'gray')).toBe(true);
    expect(trustScorecard([]).every((metric) => metric.value === 'Baseline not recorded')).toBe(true);
    expect(trustScorecard([]).every((metric) => /^2026-\d{2}-\d{2}$/.test(metric.targetInstrumentationDate))).toBe(true);
    expect(trustScorecard([]).every((metric) => metric.target && metric.knownLimitations && metric.correctiveAction)).toBe(true);
  });

  it('fails controls red and stale, missed, or worsening measurements yellow', () => {
    const critical = TRUST_METRICS.find((metric) => metric.critical)!;
    const advisory = TRUST_METRICS.find((metric) => !metric.critical)!;
    expect(metricState(critical, { id: critical.id, targetMet: true, evidenceCurrent: true, controlFailure: true, value: 'failed', evidenceAt: 1 }).state).toBe('red');
    expect(metricState(critical, { id: critical.id, targetMet: false, evidenceCurrent: true, value: 'below target', evidenceAt: 1 }).state).toBe('red');
    expect(metricState(advisory, { id: advisory.id, targetMet: false, evidenceCurrent: true, value: 'below target', evidenceAt: 1 }).state).toBe('yellow');
    expect(metricState(critical, { id: critical.id, targetMet: true, evidenceCurrent: false, value: 'stale', evidenceAt: 1 }).state).toBe('yellow');
    expect(metricState(critical, { id: critical.id, targetMet: true, evidenceCurrent: true, trendWorsening: true, value: 'falling', evidenceAt: 1 }).state).toBe('yellow');
    expect(metricState(critical, { id: critical.id, targetMet: true, evidenceCurrent: true, materialLimitation: true, value: 'limited', evidenceAt: 1 }).state).toBe('yellow');
  });

  it('marks only current target-meeting evidence green', () => {
    const definition = TRUST_METRICS[0];
    expect(metricState(definition, { id: definition.id, targetMet: true, evidenceCurrent: true, value: 'met', evidenceAt: 1 }).state).toBe('green');
  });

  it('carries current limitations and corrective action into the rendered scorecard model', () => {
    const definition = TRUST_METRICS[0];
    const scored = trustScorecard([{ id: definition.id, targetMet: false, evidenceCurrent: true, value: 'missed', evidenceAt: 1, knownLimitations: 'Pilot gap', correctiveAction: 'Owner action' }])[0];
    expect(scored).toMatchObject({ state: 'red', knownLimitations: 'Pilot gap', correctiveAction: 'Owner action' });
  });

  it('formats valid evidence dates without allowing malformed timestamps to crash rendering', () => {
    expect(evidenceDateLabel(Date.UTC(2026, 9, 1))).toBe('2026-10-01');
    expect(evidenceDateLabel(Number.NaN)).toBeNull();
    expect(evidenceDateLabel(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
