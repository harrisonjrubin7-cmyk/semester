import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cell, renderedFrom, table } from './render';
import {
  OPERATIONS_CONSOLE_READINESS,
  READINESS_GATES,
  READINESS_LAYERS,
  evaluateReadiness,
  type ReadinessLayer,
  type ReadinessObservation,
} from './readiness';

const root = join(import.meta.dirname, '../../../..');
const DOC = 'docs/OPS-READINESS-EVIDENCE-REGISTER.md';
const SUBJECT = 'operations-console-foundation';
const AS_OF = '2026-10-03';
const observation = (
  layer: ReadinessLayer,
  overrides: Partial<ReadinessObservation> = {},
): ReadinessObservation => ({
  subjectId: SUBJECT,
  layer,
  source: `evidence:${layer}`,
  observedAt: AS_OF,
  outcome: 'current',
  ...overrides,
});

describe('five-layer readiness evidence', () => {
  it('advances through every layer only when the complete prefix is current', () => {
    READINESS_LAYERS.forEach((layer, index) => {
      const evidence = READINESS_LAYERS.slice(0, index + 1).map((item) => observation(item));
      const result = evaluateReadiness(SUBJECT, evidence, AS_OF);
      expect(result.achieved).toBe(layer);
      expect(result.ready).toBe(layer === 'observed-operation');
    });
  });

  it('does not let repository evidence satisfy activation or observed operation', () => {
    const result = evaluateReadiness(SUBJECT, [observation('repository')], AS_OF);
    expect(result.achieved).toBe('repository');
    expect(result.layers.find(({ layer }) => layer === 'activation')?.freshness).toBe('missing');
    expect(result.layers.find(({ layer }) => layer === 'observed-operation')?.freshness).toBe('missing');
  });

  it('does not skip an absent earlier layer even when later evidence exists', () => {
    const result = evaluateReadiness(SUBJECT, [
      observation('repository'), observation('deployment'), observation('activation'), observation('observed-operation'),
    ], AS_OF);
    expect(result.achieved).toBe('repository');
    expect(result.ready).toBe(false);
  });

  it.each(['failed', 'revoked'] as const)('fails closed when the newest observation is %s', (outcome) => {
    const evidence = READINESS_LAYERS.map((layer) => observation(layer));
    evidence.push(observation('deployment', { observedAt: '2026-10-04', outcome }));
    const result = evaluateReadiness(SUBJECT, evidence, '2026-10-04');
    expect(result.achieved).toBe('configuration');
    expect(result.layers.find(({ layer }) => layer === 'deployment')?.freshness).toBe(outcome);
  });

  it('treats expired, future, absent, and wrong-subject evidence as non-current', () => {
    const stale = evaluateReadiness(SUBJECT, [observation('repository', { observedAt: '2026-09-01' })], AS_OF);
    expect(stale.layers[0]?.freshness).toBe('stale');
    expect(stale.achieved).toBe('none');
    const future = evaluateReadiness(SUBJECT, [observation('repository', { observedAt: '2026-10-04' })], AS_OF);
    expect(future.layers[0]?.freshness).toBe('invalid');
    const absent = evaluateReadiness(SUBJECT, [observation('repository', { subjectId: 'someone-else' })], AS_OF);
    expect(absent.layers.every(({ freshness }) => freshness === 'missing')).toBe(true);
  });

  it('exposes the full evidence contract and keeps the generated register current', () => {
    const result = evaluateReadiness(SUBJECT, OPERATIONS_CONSOLE_READINESS, AS_OF);
    expect(result.layers).toHaveLength(5);
    for (const layer of result.layers) {
      expect(layer).toEqual(expect.objectContaining({
        layer: expect.any(String), source: expect.any(String), owner: expect.any(String),
        freshness: expect.any(String), limitation: expect.any(String), blockingScope: expect.any(String),
      }));
    }
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(readFileSync(join(root, DOC), 'utf8'), `${DOC} is stale; run npm run registers from app/`).toBe(rendered);
  });
});

function render(): string {
  const result = evaluateReadiness(SUBJECT, OPERATIONS_CONSOLE_READINESS, AS_OF);
  return [
    '# Operations readiness evidence register', '',
    renderedFrom('app/src/lib/ops/readiness.ts', 'readiness.test.ts'), '',
    'Readiness is five separate evidence layers. Each layer must have current evidence in order;',
    'repository verification cannot stand in for configuration, deployment, activation, or observed operation.', '',
    `**Foundation state as of ${AS_OF}:** achieved ${result.achieved}; ready: ${result.ready ? 'yes' : 'no'}.`, '',
    '## Evidence contract', '',
    ...table(['Layer', 'Expected source', 'Owner', 'Freshness', 'Blocking scope', 'Limitation'], READINESS_GATES.map((gate) => [
      gate.label, cell(gate.source), gate.owner, `${gate.freshForDays} days`, gate.blockingScope, cell(gate.limitation),
    ])), '',
    '## Current foundation evidence', '',
    ...table(['Layer', 'State', 'Observed source', 'Observed', 'Expires'], result.layers.map((layer) => [
      layer.label, layer.freshness, cell(layer.observedSource ?? 'Missing'), layer.observedAt ?? '—', layer.expiresAt ?? '—',
    ])), '',
    'Missing, stale, failed, revoked, future-dated, or wrong-subject evidence is blocking. Later-layer evidence never skips an earlier gate.', '',
  ].join('\n');
}
