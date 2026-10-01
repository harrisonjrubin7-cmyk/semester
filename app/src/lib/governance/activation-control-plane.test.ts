import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FLAGS } from '../flags';
import { renderedFrom, table } from '../ops/render';
import {
  ACTIVATION_PRIMITIVES,
  CAPABILITY_REGISTRY,
  HIGH_RISK_CONTRACT,
  MATURITY,
  evaluateActivation,
  permittedClaim,
  validateRegistry,
  type ActivationContext,
  type ActivationRequest,
  type CapabilityDefinition,
  type EvidenceRecord,
} from './activation-control-plane';

const root = join(import.meta.dirname, '../../../..');
const DOC = 'docs/ACTIVATION-CONTROL-PLANE.md';
const highRiskBase = CAPABILITY_REGISTRY.find((item) => item.activationClass === 'high-risk')!;
const highRisk: CapabilityDefinition = { ...highRiskBase, productMaturity: MATURITY.institutionReady };
const registry = CAPABILITY_REGISTRY.map((item) => item.id === highRisk.id ? highRisk : item);

const request = (overrides: Partial<ActivationRequest> = {}): ActivationRequest => ({
  capabilityId: highRisk.id,
  tenantId: 'tenant-a',
  actorId: 'actor-a',
  purpose: 'approved-pilot-operation',
  operation: highRisk.flagKey,
  idempotencyKey: 'request-001',
  evaluatedAt: '2026-09-30T18:00:00.000Z',
  ...overrides,
});

const evidence = (kind: string, overrides: Partial<EvidenceRecord> = {}): EvidenceRecord => ({
  id: `evidence-${kind}`,
  kind,
  tenantId: 'tenant-a',
  capabilityId: highRisk.id,
  status: 'current',
  validFrom: '2026-09-01T00:00:00.000Z',
  validUntil: '2026-12-31T23:59:59.999Z',
  artifactRef: `trust-room://${kind}`,
  ...overrides,
});

const context = (overrides: Partial<ActivationContext> = {}): ActivationContext => ({
  featureEnabled: true,
  entitled: true,
  identityVerified: true,
  tenantMembershipVerified: true,
  actorAuthorized: true,
  purposeAllowed: true,
  consentSatisfied: true,
  killSwitchActive: false,
  auditSinkAvailable: true,
  configurationVersion: 'configuration-7',
  configurationSchemaVersion: highRisk.configurationSchemaVersion,
  policyVersion: 'policy-3',
  tenantMaturity: MATURITY.tenantApproved,
  supportReady: true,
  monitoringReady: true,
  rollbackReady: true,
  offboardingReady: true,
  separationOfDutySatisfied: true,
  highRiskRequirements: HIGH_RISK_CONTRACT,
  evidence: highRisk.requiredEvidence.map((kind) => evidence(kind)),
  approvals: [{
    id: 'approval-1',
    tenantId: 'tenant-a',
    capabilityId: highRisk.id,
    role: 'tenant-go-live-authority',
    status: 'approved',
    validUntil: '2026-12-31T23:59:59.999Z',
    configurationVersion: 'configuration-7',
  }],
  integrations: highRisk.requiredIntegrations.map((id) => ({ id, tenantId: 'tenant-a', status: 'healthy', checkedAt: '2026-09-30T17:55:00.000Z' })),
  ...overrides,
});

describe('the capability activation control plane', () => {
  it('maps every executable flag exactly once to a canonical capability', () => {
    expect(validateRegistry()).toEqual([]);
    expect(CAPABILITY_REGISTRY).toHaveLength(FLAGS.length);
    expect(new Set(CAPABILITY_REGISTRY.map((item) => item.id)).size).toBe(FLAGS.length);
    expect(new Set(CAPABILITY_REGISTRY.map((item) => item.flagKey))).toEqual(new Set(FLAGS.map((item) => item.key)));
    expect(ACTIVATION_PRIMITIVES).toHaveLength(8);
  });

  it('refuses an ordinary feature flag and entitlement as sufficient authority for high risk', () => {
    const incomplete = context({
      evidence: [],
      approvals: [],
      highRiskRequirements: [],
      supportReady: false,
      monitoringReady: false,
      rollbackReady: false,
      offboardingReady: false,
    });
    expect(evaluateActivation(request(), incomplete, registry)).toMatchObject({
      outcome: 'unmet-requirements',
      code: 'evidence-missing-or-stale',
    });
  });

  it('never lets one tenant reuse another tenant evidence, approval, or integration health', () => {
    const otherTenant = context({
      evidence: highRisk.requiredEvidence.map((kind) => evidence(kind, { tenantId: 'tenant-b' })),
      approvals: context().approvals.map((item) => ({ ...item, tenantId: 'tenant-b' })),
      integrations: context().integrations.map((item) => ({ ...item, tenantId: 'tenant-b' })),
    });
    expect(evaluateActivation(request(), otherTenant, registry).code).toBe('evidence-missing-or-stale');
  });

  it.each(['expired', 'revoked', 'superseded'] as const)('refuses %s evidence', (status) => {
    const records = highRisk.requiredEvidence.map((kind, index) => evidence(kind, index === 0 ? { status } : {}));
    expect(evaluateActivation(request(), context({ evidence: records }), registry)).toMatchObject({
      outcome: 'unmet-requirements',
      code: 'evidence-missing-or-stale',
    });
  });

  it('makes repeated evaluations idempotent for the same request and governing versions', () => {
    const first = evaluateActivation(request(), context(), registry);
    const replay = evaluateActivation(request(), context(), registry);
    expect(first.outcome).toBe('allow');
    expect(first.receipt).toMatchObject({
      tenantId: 'tenant-a',
      capabilityId: highRisk.id,
      operation: highRisk.flagKey,
      configurationVersion: 'configuration-7',
    });
    expect(first.receipt?.expiresAt).toBe('2026-09-30T18:15:00.000Z');
    expect(replay).toEqual(first);
    expect(evaluateActivation(request({ idempotencyKey: 'request-002' }), context(), registry).decisionId).not.toBe(first.decisionId);
  });

  it('lets a kill switch override every otherwise positive input', () => {
    expect(evaluateActivation(request(), context({ killSwitchActive: true }), registry)).toMatchObject({
      outcome: 'deny',
      code: 'kill-switch-active',
    });
  });

  it('binds approval to the effective configuration version', () => {
    const prior = context({ configurationVersion: 'configuration-6' });
    expect(evaluateActivation(request(), prior, registry).code).toBe('approval-missing-or-stale');
    const restored = context({
      configurationVersion: 'configuration-6',
      approvals: context().approvals.map((item) => ({ ...item, configurationVersion: 'configuration-6' })),
    });
    expect(evaluateActivation(request(), restored, registry).outcome).toBe('allow');
  });

  it('caps every claim at the lower of product and tenant maturity', () => {
    expect(permittedClaim(highRisk, MATURITY.institutionReady)).toMatch(/not approved for a tenant/i);
    expect(permittedClaim(highRisk, MATURITY.repeatable, MATURITY.tenantApproved)).toMatch(/named tenant/i);
    expect(permittedClaim(highRisk, MATURITY.built, MATURITY.tenantGA)).toMatch(/not institution-ready/i);
  });

  it('returns safe denial explanations without evidence references or findings', () => {
    const secretRef = 'trust-room://critical-finding-42';
    const result = evaluateActivation(request(), context({
      evidence: context().evidence.map((item, index) => index === 0 ? { ...item, status: 'revoked', artifactRef: secretRef } : item),
    }), registry);
    expect(result.explanation).not.toContain(secretRef);
    expect(JSON.stringify(result)).not.toContain('critical-finding');
  });

  it('fails duplicate, conflicting, and unknown mappings', () => {
    const duplicate = { ...CAPABILITY_REGISTRY[0]! };
    const unknown = { ...CAPABILITY_REGISTRY[1]!, id: 'flag:not.real', flagKey: 'not.real' } as CapabilityDefinition;
    expect(validateRegistry([...CAPABILITY_REGISTRY, duplicate])).toEqual(expect.arrayContaining([
      expect.stringMatching(/duplicate capability id/),
      expect.stringMatching(/duplicate flag mapping/),
    ]));
    expect(validateRegistry([...CAPABILITY_REGISTRY, unknown])).toEqual(expect.arrayContaining([
      'unknown flag mapping: not.real',
    ]));
  });

  it(`is what ${DOC} says`, () => {
    const rendered = render();
    if (process.env.REGISTERS === 'write') writeFileSync(join(root, DOC), rendered);
    expect(existsSync(join(root, DOC))).toBe(true);
    expect(readFileSync(join(root, DOC), 'utf8'), `${DOC} is stale; run \`npm run registers\` from app/`).toBe(rendered);
  });
});

function render(): string {
  const byRisk = (risk: CapabilityDefinition['activationClass']) => CAPABILITY_REGISTRY.filter((item) => item.activationClass === risk).length;
  return [
    '# Capability activation control plane',
    '',
    renderedFrom('app/src/lib/governance/activation-control-plane.ts', 'activation-control-plane.test.ts'),
    '',
    'This is the executable first slice of the Semester Platform Constitution.',
    'A feature flag and entitlement are rollout inputs, never sufficient authority',
    'for a controlled or high-risk capability. The evaluator also requires current',
    'tenant-bound evidence, approval, configuration, integration health and operating',
    'controls. It evaluates permission only; domain services must re-authorize and',
    'reconcile the actual action.',
    '',
    '## Current finding',
    '',
    `The registry maps all ${CAPABILITY_REGISTRY.length} executable flags: ${byRisk('standard')} standard, ${byRisk('controlled')} controlled and ${byRisk('high-risk')} high-risk.`,
    'Every definition is currently L2 (built) because repository code cannot by itself',
    'create independent verification, institutional readiness or tenant approval.',
    'Consequently, every controlled and high-risk capability remains denied until',
    'current external and operational inputs are supplied.',
    '',
    '## Eight activation primitives',
    '',
    ...ACTIVATION_PRIMITIVES.map((item, index) => `${index + 1}. ${item}`),
    '',
    '## Maturity',
    '',
    ...table(['Level', 'Meaning'], [
      ['L0', 'Vision'], ['L1', 'Designed'], ['L2', 'Built'], ['L3', 'Verified'], ['L4', 'Institution-ready'],
      ['L5', 'Tenant-approved'], ['L6', 'Parallel run'], ['L7', 'Bounded system of record'], ['L8', 'Tenant GA'], ['L9', 'Repeatable'],
    ]),
    '',
    '## High-risk activation contract',
    '',
    ...HIGH_RISK_CONTRACT.map((item) => `- ${item}`),
    '',
    '## Canonical capability projection',
    '',
    ...table(
      ['Capability ID', 'Owner', 'Class', 'Product maturity', 'Fallback'],
      CAPABILITY_REGISTRY.map((item) => [`\`${item.id}\``, item.owner, item.activationClass, `L${item.productMaturity}`, item.fallback.replaceAll('|', '\\|')]),
    ),
    '',
    '## Decision boundaries',
    '',
    '- This control plane does not deploy, migrate, activate a tenant, or execute a domain write.',
    '- Allow decisions issue a fifteen-minute receipt bound to the tenant, capability, operation, policy and configuration.',
    '- This first slice does not yet make `evaluateFlag` consume that receipt; the receipt is never server-side authorization.',
    '- Evidence and approvals are tenant-bound, dated and configuration-version-bound.',
    '- Kill switches and an unavailable audit sink fail closed.',
    '- Public wording is capped at the lower of product and tenant maturity.',
    '- Denial explanations omit evidence contents, security findings and other tenant data.',
    '',
  ].join('\n');
}
