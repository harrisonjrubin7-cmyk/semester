import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAPABILITIES } from '../rollout-capabilities';
import { DOMAINS, REGISTER } from '../masterregister';
import { SEATS } from '../launchreadiness';
import { cell, controlLine, renderedFrom, table } from '../ops/render';
import { PRIMITIVES, PRIMITIVE_IDS } from './constitution';
import { CLAIMS } from '../ops/claims';
import { EVIDENCE } from '../ops/evidence';
import { capabilityReadiness, repositoryProjectionContext } from './projections';
import {
  ACTIVATION_CLASSES, ACTIVATION_MEANINGS, CAPABILITY_DEFINITIONS, CAPABILITY_POLICIES,
  CAPABILITY_PROFILES, HIGH_RISK_REQUIREMENTS, MATURITY_LEVELS, MATURITY_MEANINGS,
  buildCapabilityDefinitions, capabilityDefinition, maturityForState,
  type CapabilityPolicy, type CapabilityProfile,
} from './capability-governance';

const root = join(import.meta.dirname, '../../../..');
const DOC = 'docs/CAPABILITY-ACTIVATION-REGISTER.md';
const byId = (id: string) => capabilityDefinition(id)!;

describe('canonical capability governance', () => {
  it('preserves the maturity and activation vocabularies and all sixty source identities', () => {
    expect(MATURITY_LEVELS).toEqual(['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9']);
    expect(ACTIVATION_CLASSES).toEqual(['standard', 'controlled', 'high-risk']);
    expect(CAPABILITY_DEFINITIONS).toHaveLength(60);
    expect(new Set(CAPABILITY_DEFINITIONS.map((c) => c.id)).size).toBe(60);
    expect(CAPABILITY_DEFINITIONS.map((c) => c.id)).toEqual(CAPABILITIES.map((c) => c.id));
    expect(Object.keys(CAPABILITY_POLICIES)).toEqual(CAPABILITIES.map((c) => c.id));
    CAPABILITIES.forEach((source) => expect(byId(source.id)).toMatchObject(source));
    expect(capabilityDefinition('CAP-999')).toBeUndefined();
  });

  it.each(CAPABILITIES)('$id has complete governance, known dependencies and a retained source object', (source) => {
    const c = byId(source.id);
    expect(c.id).toBe(source.id);
    expect(c.primitives.length).toBeGreaterThan(0);
    c.primitives.forEach((p) => expect(PRIMITIVE_IDS).toContain(p));
    expect(Object.keys(DOMAINS)).toContain(c.domain);
    expect(SEATS).toContain(c.supportOwner);
    expect(c.masterRows.length).toBeGreaterThan(0);
    c.masterRows.forEach((r) => expect(REGISTER.some((row) => row.id === r)).toBe(true));
    for (const value of [c.owner, c.promise, c.accessibility, c.fallback, c.supportOwner, c.lifecycle, c.requiredClaims]) {
      expect(value.trim()).not.toBe('');
    }
    expect(c.data.length).toBeGreaterThan(0);
    c.data.forEach((rule) => {
      for (const value of [rule.classification, rule.authority, rule.purpose, rule.retention]) expect(value.trim()).not.toBe('');
      expect(['student', 'semester', 'institution', 'external-provider', 'shared']).toContain(rule.authority);
      expect(existsSync(join(root, rule.retention))).toBe(true);
    });
    c.dependencies.forEach((dep) => expect(dep.startsWith('external:') || Boolean(capabilityDefinition(dep))).toBe(true));
    expect(MATURITY_LEVELS.indexOf(c.maturity)).toBeLessThanOrEqual(MATURITY_LEVELS.indexOf(maturityForState(source.currentState)));
    if (c.activationClass === 'high-risk') {
      expect(Object.keys(c.highRiskRequirements!)).toEqual(HIGH_RISK_REQUIREMENTS);
      HIGH_RISK_REQUIREMENTS.forEach((key) => expect(c.highRiskRequirements![key].trim().length).toBeGreaterThan(30));
    }
  });

  it('keeps family, financial, dining, housing and official registration boundaries high-risk', () => {
    for (const id of ['CAP-041', 'CAP-046', 'CAP-047', 'CAP-048', 'CAP-050']) expect(byId(id).activationClass).toBe('high-risk');
    expect(byId('CAP-027').activationClass).toBe('controlled');
    for (const id of ['CAP-020', 'CAP-021', 'CAP-029', 'CAP-030']) expect(byId(id).activationClass).not.toBe('high-risk');
    const highRisk = CAPABILITY_DEFINITIONS.filter((c) => c.activationClass === 'high-risk');
    expect(new Set(highRisk.map((c) => JSON.stringify(c.highRiskRequirements))).size).toBe(highRisk.length);
    expect(byId('CAP-041').highRiskRequirements!.authorization).toContain('revocation');
    expect(byId('CAP-046').highRiskRequirements!.integration).toContain('ledger');
    expect(byId('CAP-047').highRiskRequirements!.integration).toContain('transaction');
    expect(byId('CAP-048').highRiskRequirements!.authorization).toContain('contract');
    expect(byId('CAP-050').highRiskRequirements!.integration).toContain('seat');
  });

  it.each([
    ['verified', 'L3'], ['partial', 'L2'], ['absent', 'L1'], ['blocked', 'L1'], ['conflict', 'L1'],
  ] as const)('maps %s conservatively to %s', (state, expected) => expect(maturityForState(state)).toBe(expected));

  const source = CAPABILITIES[0];
  const policy = () => ({ ...CAPABILITY_POLICIES['CAP-001'] });
  const joinPolicy = (p: CapabilityPolicy) => buildCapabilityDefinitions([source], { [source.id]: p });

  it('permits a downgrade but rejects every promotion above source maturity', () => {
    expect(joinPolicy({ ...policy(), maturity: 'L0' })[0].maturity).toBe('L0');
    expect(joinPolicy({ ...policy(), maturity: 'L3' })[0].maturity).toBe('L3');
    for (const maturity of MATURITY_LEVELS.slice(4)) expect(() => joinPolicy({ ...policy(), maturity })).toThrow(/promot/i);
  });

  it('rejects a missing policy, unknown profile, unknown master row and duplicate source ID', () => {
    expect(() => buildCapabilityDefinitions([source], {})).toThrow(/missing policy/i);
    expect(() => joinPolicy({ ...policy(), profile: 'missing' as CapabilityPolicy['profile'] })).toThrow(/unknown profile/i);
    expect(() => joinPolicy({ ...policy(), masterRows: ['STU-999'] })).toThrow(/unknown master row/i);
    expect(() => buildCapabilityDefinitions([source, source])).toThrow(/duplicate source/i);
  });

  it('rejects an incomplete high-risk profile rather than substituting a generic checklist', () => {
    const family = CAPABILITIES.find((c) => c.id === 'CAP-041')!;
    const profiles: Record<string, CapabilityProfile> = { ...CAPABILITY_PROFILES };
    const key = CAPABILITY_POLICIES['CAP-041'].profile;
    const full = profiles[key].highRiskRequirements!;
    for (const requirement of HIGH_RISK_REQUIREMENTS) {
      profiles[key] = { ...CAPABILITY_PROFILES[key], highRiskRequirements: { ...full, [requirement]: '' } };
      expect(() => buildCapabilityDefinitions([family], CAPABILITY_POLICIES, profiles)).toThrow(/high-risk/i);
    }
    profiles[key] = { ...CAPABILITY_PROFILES[key], highRiskRequirements: undefined };
    expect(() => buildCapabilityDefinitions([family], CAPABILITY_POLICIES, profiles)).toThrow(/high-risk/i);
  });

  it('holds the checked-in activation register to its canonical data', () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(readFileSync(join(root, DOC), 'utf8')).toBe(rendered);
  });
});

function render(): string {
  return [
    '# Capability activation register', '',
    renderedFrom('app/src/lib/governance/capability-governance.ts', 'capability-governance.test.ts'), '',
    controlLine(DOC), '',
    'Product maturity does not prove tenant activation. These levels are conservative projections of the rollout inventory, not new evidence or approvals. Verified maps to L3; partial to L2; absent, blocked and conflict to L1. Read the source state and its evidence before making a claim. No tenant is activated by this register.', '',
    '## Maturity vocabulary', '',
    ...table(['Level', 'Meaning'], MATURITY_LEVELS.map((m) => [m, cell(MATURITY_MEANINGS[m])])), '',
    '## Activation classes', '',
    ...table(['Class', 'Meaning'], ACTIVATION_CLASSES.map((a) => [a, cell(ACTIVATION_MEANINGS[a])])), '',
    '## Shared primitives', '',
    ...table(['ID', 'Primitive'], PRIMITIVES.map((p) => [p.id, cell(p.name)])), '',
    '## Capabilities', '',
    'Evidence and claim projections are evaluated as of 2026-09-30 from directly bound evidence records. Missing means no dated record is bound; expiring remains valid until UTC expiry. No general-availability declaration or tenant state is inferred from repository tests. These projections are repository evidence, not live tenant activation proof.', '',
    'Master rows are applicable requirements, not claims that Semester replaces those systems. Current courses, assignments and practice are student tools; official grade writes and system-of-record operations require separate high-risk activation.', '',
    ...table(['ID', 'Capability', 'Owner', 'Domain', 'Primitives', 'Source state', 'Product maturity', 'Activation class', 'Master rows', 'Fallback', 'Permitted claim', 'Evidence state', 'Permitted claim statuses'],
      CAPABILITY_DEFINITIONS.map((c) => {
        const readiness = capabilityReadiness(c, repositoryProjectionContext(c, EVIDENCE, '2026-09-30', CLAIMS));
        return [c.id, c.name, c.owner, c.domain, c.primitives.join(', '), c.currentState, c.maturity, c.activationClass, c.masterRows.join(', '), c.fallback, c.requiredClaims, readiness.evidence, readiness.allowed.join(', ')].map(cell);
      })), '',
    '## High-risk requirement profiles', '',
    'Every entry below is a requirement to satisfy with current tenant evidence, not an assertion that it is satisfied. Support seats identify accountable roles; they do not assert a named or staffed owner.', '',
    ...CAPABILITY_DEFINITIONS.filter((c) => c.activationClass === 'high-risk').flatMap((c) => [
      `### ${c.id}: ${c.name}`, '',
      ...table(['Category', 'Required evidence and control'], HIGH_RISK_REQUIREMENTS.map((r) => [r, cell(c.highRiskRequirements![r])])), '',
    ]),
  ].join('\n');
}
