import { describe, expect, it } from 'vitest';
import { evidenceDateLabel, metricState, TRUST_METRICS, trustScorecard } from './institutional-trust-scorecard';

describe('institutional trust scorecard', () => {
  it('uses metric states instead of combining unrelated controls into a score', () => {
    expect(TRUST_METRICS).toHaveLength(15);
    expect(trustScorecard([]).every((metric) => metric.state === 'gray')).toBe(true);
    expect(trustScorecard([]).every((metric) => metric.hasMeasurement === false)).toBe(true);
    expect(trustScorecard([]).every((metric) => metric.value === 'Baseline not recorded')).toBe(true);
    expect(trustScorecard([]).every((metric) => /^2026-\d{2}-\d{2}$/.test(metric.targetInstrumentationDate))).toBe(true);
    expect(trustScorecard([]).every((metric) => metric.target && metric.knownLimitations && metric.correctiveAction)).toBe(true);
  });

  it('fails controls red and stale, missed, or worsening measurements yellow', () => {
    const critical = TRUST_METRICS.find((metric) => metric.critical)!;
    const advisory = TRUST_METRICS.find((metric) => !metric.critical)!;
    expect(metricState(critical, { id: critical.id, targetMet: true, evidenceCurrent: true, controlFailure: true, value: 'failed', evidenceAt: 1 }).state).toBe('red');
    expect(metricState(critical, { id: critical.id, targetMet: false, evidenceCurrent: true, value: 'below target', evidenceAt: 1 }).state).toBe('yellow');
    expect(metricState(advisory, { id: advisory.id, targetMet: false, evidenceCurrent: true, value: 'below target', evidenceAt: 1 }).state).toBe('yellow');
    expect(metricState(critical, { id: critical.id, targetMet: true, evidenceCurrent: false, value: 'stale', evidenceAt: 1 }).state).toBe('yellow');
    expect(metricState(critical, { id: critical.id, targetMet: true, evidenceCurrent: true, trendWorsening: true, value: 'falling', evidenceAt: 1 }).state).toBe('yellow');
    expect(metricState(critical, { id: critical.id, targetMet: true, evidenceCurrent: true, materialLimitation: true, value: 'limited', evidenceAt: 1 }).state).toBe('yellow');
  });

  it('marks only current target-meeting evidence green', () => {
    const definition = TRUST_METRICS[0];
    expect(metricState(definition, { id: definition.id, targetMet: true, evidenceCurrent: true, value: 'met', evidenceAt: 100 }, 200).state).toBe('green');
  });

  it('carries current limitations and corrective action into the rendered scorecard model', () => {
    const definition = TRUST_METRICS[0];
    const scored = trustScorecard([{ id: definition.id, targetMet: false, evidenceCurrent: true, value: 'missed', evidenceAt: 1, knownLimitations: 'Pilot gap', correctiveAction: 'Owner action' }])[0];
    expect(scored).toMatchObject({ state: 'yellow', knownLimitations: 'Pilot gap', correctiveAction: 'Owner action' });
  });

  it('formats valid evidence dates without allowing malformed timestamps to crash rendering', () => {
    expect(evidenceDateLabel(Date.UTC(2026, 9, 1))).toBe('2026-10-01');
    expect(evidenceDateLabel(Number.NaN)).toBeNull();
    expect(evidenceDateLabel(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('never scores malformed evidence dates green', () => {
    const definition = TRUST_METRICS[0];
    expect(metricState(definition, { id: definition.id, targetMet: true, evidenceCurrent: true, value: 'met', evidenceAt: Number.NaN }).state).toBe('yellow');
    expect(metricState(definition, { id: definition.id, targetMet: true, evidenceCurrent: true, value: 'met', evidenceAt: Number.POSITIVE_INFINITY }).state).toBe('yellow');
  });

  it('keeps a measurement with missing evidence distinct from an uninstrumented metric', () => {
    const definition = TRUST_METRICS[0];
    const scored = trustScorecard([{
      id: definition.id, targetMet: true, evidenceCurrent: false, value: 'measured', evidenceAt: null,
    } as unknown as Parameters<typeof trustScorecard>[0][number]])[0];
    expect(scored).toMatchObject({ state: 'yellow', hasMeasurement: true, evidenceAt: null });
  });

  it('never scores future evidence or a blank measured value green', () => {
    const definition = TRUST_METRICS[0];
    expect(metricState(definition, { id: definition.id, targetMet: true, evidenceCurrent: true, value: 'met', evidenceAt: 201 }, 200).state).toBe('yellow');
    expect(metricState(definition, { id: definition.id, targetMet: true, evidenceCurrent: true, value: '   ', evidenceAt: 100 }, 200).state).toBe('yellow');
  });

  it('expires evidence by cadence and rejects non-boolean state flags', () => {
    const monthly = TRUST_METRICS.find((metric) => metric.cadence === 'monthly')!;
    const old = Date.UTC(2026, 0, 1);
    const now = Date.UTC(2026, 9, 1);
    expect(metricState(monthly, { id: monthly.id, targetMet: true, evidenceCurrent: true, value: 'met', evidenceAt: old }, now).state).toBe('yellow');
    expect(metricState(monthly, { id: monthly.id, targetMet: 'false', evidenceCurrent: 'false', value: 'met', evidenceAt: now } as unknown as Parameters<typeof metricState>[1], now).state).toBe('yellow');
    expect(metricState(monthly, { id: monthly.id, targetMet: true, evidenceCurrent: true, controlFailure: 'false', value: 'met', evidenceAt: now } as unknown as Parameters<typeof metricState>[1], now).state).toBe('yellow');
  });

  it('falls back to catalog guidance when measurement overrides are blank', () => {
    const definition = TRUST_METRICS[0];
    const scored = trustScorecard([{ id: definition.id, targetMet: true, evidenceCurrent: true, value: 'met', evidenceAt: Date.now(), knownLimitations: ' ', correctiveAction: '' }])[0];
    expect(scored.knownLimitations).toBe(definition.knownLimitations);
    expect(scored.correctiveAction).toBe(definition.correctiveAction);
  });

  it('falls back to catalog guidance when imported overrides are not strings', () => {
    const definition = TRUST_METRICS[0];
    const scored = trustScorecard([{
      id: definition.id, targetMet: true, evidenceCurrent: true, value: 'met', evidenceAt: Date.now(),
      knownLimitations: { unsafe: true }, correctiveAction: ['unsafe'],
    } as unknown as Parameters<typeof trustScorecard>[0][number]])[0];
    expect(scored.knownLimitations).toBe(definition.knownLimitations);
    expect(scored.correctiveAction).toBe(definition.correctiveAction);
  });

  it('keeps an explicit control failure red even when auxiliary fields are malformed', () => {
    const definition = TRUST_METRICS[0];
    const state = metricState(definition, {
      id: definition.id, controlFailure: true, targetMet: 'unknown', evidenceCurrent: null,
      trendWorsening: 'unknown', value: 'failed', evidenceAt: Number.NaN,
    } as unknown as Parameters<typeof metricState>[1]);
    expect(state.state).toBe('red');
  });

  it('normalizes malformed measurement values before rendering', () => {
    const definition = TRUST_METRICS[0];
    const scored = trustScorecard([{ id: definition.id, targetMet: true, evidenceCurrent: true, value: { unsafe: true }, evidenceAt: Date.now() } as unknown as Parameters<typeof trustScorecard>[0][number]])[0];
    expect(scored.value).toBe('Invalid measurement value');
    expect(scored.state).toBe('yellow');
  });

  it('ignores null imported entries instead of taking down the scorecard', () => {
    const scored = trustScorecard([null] as unknown as Parameters<typeof trustScorecard>[0]);
    expect(scored).toHaveLength(TRUST_METRICS.length);
    expect(scored.every((metric) => metric.state === 'gray')).toBe(true);
  });
});
