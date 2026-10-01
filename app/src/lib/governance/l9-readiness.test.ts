import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cell, controlLine, renderedFrom, table } from '../ops/render';
import { CAPABILITY_DEFINITIONS, capabilityDefinition } from './capability-governance';
import {
  L9_EVIDENCE_KINDS, evaluateL9Readiness, repositoryL4Evidence, type L9Evidence,
} from './l9-readiness';

const root = join(import.meta.dirname, '../../../..');
const DOC = 'docs/L9-CAPABILITY-READINESS.md';
const CAP = capabilityDefinition('CAP-001')!;
const L4_KINDS = L9_EVIDENCE_KINDS.slice(0, 10);
const item = (kind: L9Evidence['kind'], tenantId?: string, cycle?: string): L9Evidence => ({
  capabilityId: CAP.id, kind, status: 'current', reference: `evidence/${kind}`, tenantId, cycle,
});
const AS_OF = '2026-09-30';

describe('L9 evidence ladder', () => {
  it('does not turn repository verification into institution readiness', () => {
    expect(evaluateL9Readiness(CAP, [])).toMatchObject({ achieved: 'L3', target: 'L9' });
    expect(evaluateL9Readiness(CAP, []).missing).toContain('tenant-approval');
  });

  it('requires every definition-of-done class for L4 and ignores failed evidence', () => {
    const almost = L4_KINDS.slice(0, -1).map((kind) => item(kind));
    expect(evaluateL9Readiness(CAP, almost).achieved).toBe('L3');
    expect(evaluateL9Readiness(CAP, [...almost, { ...item('claim-review'), status: 'failed' }]).achieved).toBe('L3');
    expect(evaluateL9Readiness(CAP, L4_KINDS.map((kind) => item(kind))).achieved).toBe('L4');
  });

  it('expires repository evidence instead of preserving a stale readiness claim', () => {
    const expiring = L4_KINDS.map((kind) => ({ ...item(kind), expiresAt: '2026-10-30' }));
    expect(evaluateL9Readiness(CAP, expiring, '2026-10-30').achieved).toBe('L4');
    expect(evaluateL9Readiness(CAP, expiring, '2026-10-31').achieved).toBe('L3');
  });

  it('requires one continuous tenant chain through approval, parallel run, bounded live use and GA', () => {
    const base = L4_KINDS.map((kind) => item(kind));
    const throughGa = [...base, item('tenant-approval', 'tenant-a'), item('parallel-run', 'tenant-a'),
      item('bounded-live-operation', 'tenant-a'), item('tenant-ga', 'tenant-a')];
    expect(evaluateL9Readiness(CAP, throughGa).achieved).toBe('L8');
    expect(evaluateL9Readiness(CAP, [...base, item('tenant-approval', 'tenant-a'), item('parallel-run', 'tenant-b')]).achieved).toBe('L5');
  });

  it('awards L9 only after repeatable evidence across two tenants and two cycles', () => {
    const base = [...L4_KINDS.map((kind) => item(kind)), item('tenant-approval', 'tenant-a'),
      item('parallel-run', 'tenant-a'), item('bounded-live-operation', 'tenant-a'), item('tenant-ga', 'tenant-a')];
    expect(evaluateL9Readiness(CAP, [...base, item('repeatable-operation', 'tenant-a', '2027-fall')]).achieved).toBe('L8');
    expect(evaluateL9Readiness(CAP, [...base, item('repeatable-operation', 'tenant-a', '2027-fall'),
      item('repeatable-operation', 'tenant-b', '2028-spring')]).achieved).toBe('L9');
  });

  it('promotes only source-verified capabilities to repository L4', () => {
    const evidence = repositoryL4Evidence(CAPABILITY_DEFINITIONS);
    const rows = CAPABILITY_DEFINITIONS.map((capability) => evaluateL9Readiness(capability, evidence, AS_OF));
    expect(rows).toHaveLength(60);
    expect(rows.filter((row) => row.achieved === 'L4')).toHaveLength(
      CAPABILITY_DEFINITIONS.filter((capability) => capability.maturity === 'L3').length,
    );
    expect(rows.every((row) => !['L5', 'L6', 'L7', 'L8', 'L9'].includes(row.achieved))).toBe(true);
    expect(rows.filter((row) => row.achieved === 'L4')).toHaveLength(60);
    expect(rows.find((row) => row.capabilityId === 'CAP-018')?.achieved).toBe('L4');
    for (const row of rows.filter((item) => item.achieved !== 'L4')) {
      const capability = capabilityDefinition(row.capabilityId)!;
      expect(capability.dependencies.some((dependency) => dependency.startsWith('external:')), row.capabilityId).toBe(true);
    }
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(readFileSync(join(root, DOC), 'utf8'), `${DOC} is stale; run npm run registers from app/`).toBe(rendered);
  });
});

function render(): string {
  const evidence = repositoryL4Evidence(CAPABILITY_DEFINITIONS);
  const rows = CAPABILITY_DEFINITIONS.map((capability) => evaluateL9Readiness(capability, evidence, AS_OF));
  const counts = Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`L${index}`, rows.filter((row) => row.achieved === `L${index}`).length]));
  return [
    '# L9 capability readiness', '',
    renderedFrom('app/src/lib/governance/l9-readiness.ts', 'l9-readiness.test.ts'), '', controlLine(DOC), '',
    'This is an evidence ledger, not a maturity declaration. Code and repository tests can establish at most L4.',
    'Repository L4 packets are reviewed as of 2026-09-30 and expire after 2026-10-30. L5-L9 require tenant approval',
    'and observed operation. Empty evidence remains empty; no synthetic tenant, approval,',
    'parallel run, deployment, operating cycle, or institution is created to improve a score.', '',
    `**Current repository ceiling:** ${Object.entries(counts).map(([level, count]) => `${level}: ${count}`).join(' · ')}`, '',
    '## Gate meanings', '',
    ...table(['Level', 'Required proof'], [
      ['L0', 'Vision'], ['L1', 'Designed capability in the canonical catalog'], ['L2', 'Implementation is partial or complete'],
      ['L3', 'Canonical repository verification'], ['L4', 'Complete definition-of-done evidence across product, authorization, accessibility, security, support, monitoring, rollback, lifecycle, and claims'],
      ['L5', 'A named tenant approved the capability'], ['L6', 'The same tenant completed a parallel run'], ['L7', 'The same tenant completed bounded live operation'],
      ['L8', 'The same tenant reached GA'], ['L9', 'Repeatable current evidence across at least two tenants and two operating cycles'],
    ]), '',
    '## Capability ledger', '',
    ...table(['ID', 'Capability', 'Current', 'Target', 'Class', 'Missing evidence'], CAPABILITY_DEFINITIONS.map((capability) => {
      const readiness = rows.find((row) => row.capabilityId === capability.id)!;
      return [capability.id, cell(capability.name), readiness.achieved, readiness.target, capability.activationClass, cell(readiness.missing.join(', '))];
    })), '',
    '## Below-L4 closure queue', '',
    'No capability remains below L4 in the repository evidence ledger. Provider credentials, authoritative data,',
    'institution agreements and tenant approvals remain explicit L5 activation gates; controlled simulators establish',
    'repository readiness only and cannot establish tenant approval or live operation.', '',
    '## L5 activation gates', '',
    ...table(['ID', 'Capability', 'Current', 'External gate'], CAPABILITY_DEFINITIONS.flatMap((capability) => {
      const readiness = rows.find((row) => row.capabilityId === capability.id)!;
      const external = capability.dependencies.filter((dependency) => dependency.startsWith('external:'))
        .map((dependency) => dependency.slice('external:'.length));
      if (!external.length) return [];
      return [[capability.id, cell(capability.name), readiness.achieved, cell(external.join('; ') || 'No external gate recorded')]];
    })), '',
    '## Non-negotiable operating boundary', '',
    'L9 is achieved only from current evidence. Repository implementation, a generated document, a green test suite,',
    'a preview, a deployment, or one institution cannot independently establish repeatable operation.', '',
  ].join('\n');
}
