import { describe, expect, it } from 'vitest';
import { INSTITUTIONAL_PACKAGE, ROLLOUT_PHASES, nextRolloutPhase, rolloutReadiness } from './institutional-package';

describe('Semester Institutional', () => {
  it('is one package that keeps LMS and gradebook authority gated while including integrations and migration', () => {
    expect(INSTITUTIONAL_PACKAGE.name).toBe('Semester Institutional');
    const offer = INSTITUTIONAL_PACKAGE.includes.join(' ');
    expect(offer).toMatch(/gradebook capabilities/);
    expect(offer).toMatch(/off until separately approved/);
    expect(offer).not.toMatch(/Native LMS|gradebook of record/);
    expect(offer).toMatch(/Approved institutional connections/);
    expect(offer).not.toMatch(/OneRoster/);
    expect(offer).toMatch(/credential wallet/);
    expect(offer).toMatch(/institutional analytics/);
    expect(offer).toMatch(/official-system write workflows/);
    expect(offer).toMatch(/migration/);
    expect(offer).toMatch(/hypercare/);
  });

  it('runs from agreement through pilot, integration, parallel run, migration, cutover and expansion', () => {
    expect(ROLLOUT_PHASES.map((phase) => phase.id)).toEqual([
      'contract', 'pilot', 'integrate', 'parallel', 'migrate', 'cutover', 'expand',
    ]);
  });

  it('never advances a phase when required evidence is missing', () => {
    const first = ROLLOUT_PHASES[0];
    const partial = new Set(first.requiredEvidence.slice(0, -1));
    expect(rolloutReadiness(partial)[0]).toEqual({
      phase: first,
      ready: false,
      missing: [first.requiredEvidence.at(-1)],
    });
    expect(nextRolloutPhase(partial)?.id).toBe('contract');
  });

  it('finds the next unfinished phase and completes only with every gate', () => {
    const contract = new Set(ROLLOUT_PHASES[0].requiredEvidence);
    expect(nextRolloutPhase(contract)?.id).toBe('pilot');
    const all = new Set(ROLLOUT_PHASES.flatMap((phase) => phase.requiredEvidence));
    expect(nextRolloutPhase(all)).toBeNull();
  });
});
