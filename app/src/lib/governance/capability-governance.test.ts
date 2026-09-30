import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SEATS } from '../launchreadiness';
import { REGISTER } from '../masterregister';
import { CAPABILITIES } from '../rollout-capabilities';
import { cell, controlLine, renderedFrom, table } from '../ops/render';
import { PRIMITIVE_IDS } from './constitution';
import { capabilityReadiness, repositoryProjectionContext } from './projections';
import {
  ACTIVATION_CLASSES,
  CAPABILITY_DEFINITIONS,
  CAPABILITY_POLICIES,
  CAPABILITY_PROFILES,
  HIGH_RISK_REQUIREMENTS,
  MATURITY_LEVELS,
  capabilityDefinition,
  maturityForState,
} from './capability-governance';

const root = join(import.meta.dirname, '../../../..');
const DOC = 'docs/CAPABILITY-ACTIVATION-REGISTER.md';

describe('canonical capability governance', () => {
  it('keeps the approved maturity and activation vocabularies', () => {
    expect(MATURITY_LEVELS).toEqual(['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9']);
    expect(ACTIVATION_CLASSES).toEqual(['standard', 'controlled', 'high-risk']);
    expect(maturityForState('verified')).toBe('L3');
    expect(maturityForState('partial')).toBe('L2');
    expect(maturityForState('blocked')).toBe('L1');
  });

  it('preserves all sixty stable capability identities in source order', () => {
    expect(CAPABILITY_DEFINITIONS).toHaveLength(60);
    expect(new Set(CAPABILITY_DEFINITIONS.map((item) => item.id)).size).toBe(60);
    expect(CAPABILITY_DEFINITIONS.map((item) => item.id)).toEqual(CAPABILITIES.map((item) => item.id));
    expect(Object.keys(CAPABILITY_POLICIES).sort()).toEqual(CAPABILITIES.map((item) => item.id).sort());
  });

  it('makes every definition complete and resolvable', () => {
    const rows = new Set(REGISTER.map((row) => row.id));
    for (const capability of CAPABILITY_DEFINITIONS) {
      expect(capability.primitives.length, capability.id).toBeGreaterThan(0);
      for (const primitive of capability.primitives) expect(PRIMITIVE_IDS, capability.id).toContain(primitive);
      expect(capability.masterRows.length, capability.id).toBeGreaterThan(0);
      for (const row of capability.masterRows) expect(rows, capability.id).toContain(row);
      expect(capability.owner.length, capability.id).toBeGreaterThan(0);
      expect(capability.purpose.length, capability.id).toBeGreaterThan(20);
      expect(capability.accessibility.length, capability.id).toBeGreaterThan(40);
      expect(capability.fallback.length, capability.id).toBeGreaterThan(40);
      expect(SEATS, capability.id).toContain(capability.supportOwner);
      expect(capability.lifecycle.length, capability.id).toBeGreaterThan(40);
      expect(capability.requiredClaims.length, capability.id).toBeGreaterThan(30);
      expect(capability.data.length, capability.id).toBeGreaterThan(0);
      for (const rule of capability.data) {
        expect(rule.classification.length, capability.id).toBeGreaterThan(5);
        expect(rule.authority.length, capability.id).toBeGreaterThan(2);
        expect(rule.purpose.length, capability.id).toBeGreaterThan(15);
        expect(rule.retention.length, capability.id).toBeGreaterThan(10);
      }
      for (const dependency of capability.dependencies) {
        expect(dependency.startsWith('CAP-') || dependency.startsWith('external:'), `${capability.id}: ${dependency}`).toBe(true);
      }
      if (capability.activationClass === 'high-risk') expect(capability.highRiskRequirements).toEqual(HIGH_RISK_REQUIREMENTS);
      else expect(capability.highRiskRequirements).toEqual([]);
    }
  });

  it('classifies the consequential boundaries explicitly', () => {
    const risk = (id: string) => capabilityDefinition(id)!.activationClass;
    expect(risk('CAP-041')).toBe('high-risk');
    expect(risk('CAP-046')).toBe('high-risk');
    expect(risk('CAP-047')).toBe('high-risk');
    expect(risk('CAP-048')).toBe('high-risk');
    expect(risk('CAP-050')).toBe('high-risk');
    expect(risk('CAP-027')).toBe('controlled');
  });

  it('uses reusable profiles without erasing explicit capability policy', () => {
    expect(Object.keys(CAPABILITY_PROFILES).length).toBeGreaterThanOrEqual(8);
    expect(CAPABILITY_POLICIES['CAP-050']?.masterRows).toContain('INT-005');
    expect(CAPABILITY_POLICIES['CAP-027']?.masterRows).toContain('AI-004');
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(existsSync(join(root, DOC))).toBe(true);
    expect(readFileSync(join(root, DOC), 'utf8'), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

function render(): string {
  const count = (kind: 'standard' | 'controlled' | 'high-risk') => CAPABILITY_DEFINITIONS.filter((item) => item.activationClass === kind).length;
  return [
    '# Capability activation register',
    '',
    renderedFrom('app/src/lib/governance/capability-governance.ts', 'capability-governance.test.ts'),
    '',
    controlLine(DOC),
    '',
    'This register joins the sixty stable rollout capabilities to one governance',
    'profile, product maturity, activation class, data rule, fallback, lifecycle',
    'condition and permitted claim. Product maturity is repository evidence; it',
    'does not prove that any institution or tenant has approved activation.',
    '',
    `**60 capabilities: ${count('standard')} standard, ${count('controlled')} controlled, ${count('high-risk')} high-risk.**`,
    '',
    '## Maturity vocabulary',
    '',
    ...table(['Level', 'Meaning'], [
      ['L0', 'Vision'], ['L1', 'Designed'], ['L2', 'Built'], ['L3', 'Verified'], ['L4', 'Institution-ready'],
      ['L5', 'Tenant-approved'], ['L6', 'Parallel run'], ['L7', 'Bounded system of record'], ['L8', 'Tenant GA'], ['L9', 'Repeatable'],
    ]),
    '',
    '## Activation classes',
    '',
    ...table(['Class', 'Meaning'], [
      ['standard', 'Reversible, low-impact functionality with no official write or sensitive institutional decision.'],
      ['controlled', 'Institutional data, sensitive reads, consequential drafts, sharing, export or connected workflows.'],
      ['high-risk', 'Official writes, records, money, regulated services, broad access or other consequential authority.'],
    ]),
    '',
    '## Canonical capabilities',
    '',
    ...table(
      ['ID', 'Capability', 'Owner', 'Domain', 'Primitives', 'Maturity', 'Class', 'Evidence', 'Projected statuses', 'Master rows', 'Fallback', 'Permitted claim'],
      CAPABILITY_DEFINITIONS.map((item) => [
        item.id, cell(item.name), item.owner, item.domain, item.primitives.join(', '), item.maturity,
        item.activationClass, repositoryProjectionContext(item).evidence,
        capabilityReadiness(item, repositoryProjectionContext(item)).allowed.join(', '),
        item.masterRows.join(', '), cell(item.fallback), cell(item.requiredClaims),
      ]),
    ),
    '',
    '## High-risk activation profile',
    '',
    ...HIGH_RISK_REQUIREMENTS.map((item) => `- ${item}`),
    '',
  ].join('\n');
}
