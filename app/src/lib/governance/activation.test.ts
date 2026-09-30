import { describe, expect, it } from 'vitest';
import type { ConfigVersion } from '../config/studio';
import { evidenceState } from '../ops/evidence';
import { CAPABILITY_DEFINITIONS, CAPABILITY_PROFILES, capabilityDefinition, type CapabilityDefinition } from './capability-governance';
import { evaluateActivation, type ActivationContext, type ActivationRequest, type ActivationRequirementKey, type RequirementState } from './activation';

const keys: readonly ActivationRequirementKey[] = [
  'tenant_configuration', 'authorization', 'entitlement', 'consent', 'current_evidence',
  'accountable_approval', 'integration_health', 'support_ready', 'monitoring_ready',
  'rollback_ready', 'parallel_run', 'uat', 'go_live_authorization', 'audit_available',
];
// Product-floor fixtures are hypothetical; they do not promote the registry.
const standard: CapabilityDefinition = { ...capabilityDefinition('CAP-001')!, maturity: 'L2' };
const controlled: CapabilityDefinition = { ...capabilityDefinition('CAP-027')!, maturity: 'L3' };
const highRisk: CapabilityDefinition = { ...capabilityDefinition('CAP-041')!, maturity: 'L4' };
const requestFor = (capability = highRisk): ActivationRequest => ({
  requestId: 'request-1', tenantId: 'tenant-1', actorId: 'actor-1', purpose: 'approved purpose',
  capabilityId: capability.id, operation: 'activate',
});
const configuration = (): ConfigVersion => ({
  id: 'config-1', tenant_id: 'tenant-1', domain: 'features', state: 'published', version: 1,
  settings: { default_release_stage: 'on' }, note: 'private configuration text', based_on: null,
  created_by: 'author-1', published_by: 'approver-1', created_at: '2026-09-29T00:00:00Z',
  updated_at: '2026-09-30T00:00:00Z', published_at: '2026-09-30T00:00:00Z',
});
const ready = (): ActivationContext => ({
  now: '2026-09-30T23:59:59Z', policyVersion: 'policy-1', configuration: configuration(),
  requirements: keys.map((key): RequirementState => ({ key, status: 'satisfied', tenantId: 'tenant-1', references: [`ref:${key}`] })),
  killSwitchEngaged: false, existingWorkflow: false,
});
const without = (key: ActivationRequirementKey): ActivationContext => ({ ...ready(), requirements: ready().requirements.filter((r) => r.key !== key) });
const decision = (capability = highRisk, context = ready(), request = requestFor(capability)) => evaluateActivation(request, capability, context);

describe('fail-closed activation', () => {
  it('allows ready standard, controlled and high-risk requests', () => {
    for (const capability of [standard, controlled, highRisk]) {
      expect(decision(capability)).toMatchObject({ outcome: 'allow', reason: 'all_requirements_satisfied', missing: [], receipt: { configurationVersion: 1 } });
    }
  });

  it('requires current evidence for controlled actions', () => {
    expect(decision(controlled, without('current_evidence'))).toEqual({ outcome: 'unmet_requirements', reason: 'requirements_not_satisfied', missing: ['current_evidence'], receipt: null });
  });

  it('does not treat a feature-enabled configuration as high-risk authorization', () => {
    expect(decision(highRisk, { ...ready(), requirements: [] })).toMatchObject({ outcome: 'deny', receipt: null, missing: keys.slice(1) });
  });

  it.each(keys)('requires the high-risk prerequisite %s', (key) => {
    const context = without(key);
    if (key === 'tenant_configuration') context.configuration = null;
    expect(decision(highRisk, context)).toMatchObject({ receipt: null, missing: [key] });
  });

  it('declares safe defaults in canonical profiles, with class taking precedence', () => {
    expect(CAPABILITY_PROFILES.planning.safeDefaultEligible).toBe(true);
    expect(CAPABILITY_PROFILES.identity.safeDefaultEligible).toBe(false);
    expect(CAPABILITY_DEFINITIONS.every((c) => typeof c.safeDefaultEligible === 'boolean')).toBe(true);
    const context = { ...ready(), configuration: null, requirements: ready().requirements.filter((r) => r.key !== 'tenant_configuration') };
    expect(decision(standard, context)).toMatchObject({ outcome: 'allow', receipt: { configurationVersion: null } });
    expect(decision({ ...standard, safeDefaultEligible: false }, context)).toMatchObject({ outcome: 'deny', missing: ['tenant_configuration'] });
    for (const capability of [controlled, highRisk]) expect(decision({ ...capability, safeDefaultEligible: true }, context)).toMatchObject({ outcome: 'deny', receipt: null, missing: ['tenant_configuration'] });
  });

  it.each(['authorization', 'entitlement'] as const)('requires %s even with standard safe defaults', (key) => {
    expect(decision(standard, { ...without(key), configuration: null })).toMatchObject({ receipt: null, missing: [key] });
  });

  it.each([standard, controlled, highRisk])('rejects below-floor maturity for $activationClass despite satisfied prerequisites', (capability) => {
    const maturity = capability.activationClass === 'standard' ? 'L1' : capability.activationClass === 'controlled' ? 'L2' : 'L3';
    expect(decision({ ...capability, maturity })).toEqual({ outcome: 'deny', reason: 'product_maturity_insufficient', receipt: null, missing: [] });
  });

  it('fails closed for missing, unknown or mismatched capability definitions', () => {
    expect(evaluateActivation(requestFor(), undefined, ready())).toMatchObject({ outcome: 'deny', reason: 'unknown_capability', receipt: null });
    expect(decision({ ...highRisk, id: 'CAP-999' })).toMatchObject({ outcome: 'deny', reason: 'unknown_capability', receipt: null });
    expect(decision(highRisk, ready(), requestFor(standard))).toMatchObject({ outcome: 'deny', receipt: null });
  });

  it('rejects attempts to downgrade a canonical high-risk activation class', () => {
    expect(decision({ ...highRisk, activationClass: 'standard', safeDefaultEligible: true })).toMatchObject({ outcome: 'deny', reason: 'invalid_capability', receipt: null });
  });

  it('does not infer a safe default when profile metadata is absent', () => {
    const capability = { ...standard, safeDefaultEligible: undefined } as unknown as CapabilityDefinition;
    expect(decision(capability, { ...ready(), configuration: null })).toMatchObject({ outcome: 'deny', missing: ['tenant_configuration'], receipt: null });
  });

  it('fails closed on an unknown maturity level', () => {
    const capability = { ...highRisk, maturity: 'L99' } as unknown as CapabilityDefinition;
    expect(decision(capability)).toMatchObject({ outcome: 'deny', reason: 'product_maturity_insufficient', receipt: null });
  });

  it.each(['tenantId', 'requestId', 'actorId', 'purpose', 'operation'] as const)('rejects empty request %s', (field) => {
    expect(decision(highRisk, ready(), { ...requestFor(), [field]: ' ' })).toMatchObject({ outcome: 'deny', receipt: null });
  });

  it.each([
    { tenant_id: 'other-tenant-secret' }, { state: 'draft' as const }, { version: null },
    { version: NaN }, { version: Infinity }, { version: -1 }, { version: 1.5 },
  ])('rejects invalid tenant configurations %j', (change) => {
    for (const capability of [standard, controlled, highRisk]) {
      expect(decision(capability, { ...ready(), configuration: { ...configuration(), ...change } })).toMatchObject({ outcome: 'deny', receipt: null, missing: ['tenant_configuration'] });
    }
  });

  it.each(['missing', 'expired', 'revoked', 'failed'] as const)('does not count %s states as satisfied', (status) => {
    const context = ready();
    context.requirements = context.requirements.map((r) => r.key === 'current_evidence' ? { ...r, status } : r);
    expect(decision(highRisk, context)).toMatchObject({ receipt: null, missing: ['current_evidence'] });
  });

  it.each(keys)('rejects another tenant’s %s state', (key) => {
    const context = ready();
    context.requirements = context.requirements.map((r) => r.key === key ? { ...r, tenantId: 'other-tenant-secret' } : r);
    expect(decision(highRisk, context)).toMatchObject({ receipt: null, missing: [key] });
  });

  it('never lets duplicate entries widen authority, regardless of order', () => {
    for (const key of keys) {
      const failed: RequirementState = { key, status: 'revoked', tenantId: 'tenant-1', references: ['private revocation record'] };
      for (const requirements of [[failed, ...ready().requirements], [...ready().requirements, failed]]) {
        expect(decision(highRisk, { ...ready(), requirements })).toMatchObject({ receipt: null, missing: [key] });
      }
    }
  });

  it('does not let a second tenant’s satisfied duplicate widen authority', () => {
    const foreign: RequirementState = { key: 'authorization', status: 'satisfied', tenantId: 'other-tenant-secret', references: [] };
    expect(decision(highRisk, { ...ready(), requirements: [...ready().requirements, foreign] })).toMatchObject({ receipt: null, missing: ['authorization'] });
  });

  it('allows published configuration to prove configuration without a synthetic state', () => {
    expect(decision(highRisk, without('tenant_configuration')).outcome).toBe('allow');
  });

  it.each([standard, controlled, highRisk])('lets the kill switch override a ready $activationClass request', (capability) => {
    expect(decision(capability, { ...ready(), killSwitchEngaged: true })).toEqual({ outcome: 'deny', reason: 'kill_switch_engaged', receipt: null, missing: [] });
  });

  it.each([controlled, highRisk])('denies $activationClass actions without audit availability', (capability) => {
    expect(decision(capability, without('audit_available'))).toMatchObject({ outcome: 'deny', receipt: null, missing: ['audit_available'] });
  });

  it('produces deterministic versioned correlation material and a fifteen-minute UTC receipt', () => {
    const first = decision();
    expect(first).toEqual(decision());
    expect(first.receipt).toMatchObject({ decisionKey: expect.stringContaining('activation:v1'), requestId: 'request-1', tenantId: 'tenant-1', capabilityId: highRisk.id, operation: 'activate', policyVersion: 'policy-1', configurationVersion: 1, issuedAt: '2026-09-30T23:59:59.000Z', expiresAt: '2026-10-01T00:14:59.000Z' });
    expect(Object.keys(first.receipt!).sort()).toEqual(['decisionKey', 'requestId', 'tenantId', 'capabilityId', 'operation', 'policyVersion', 'configurationVersion', 'issuedAt', 'expiresAt'].sort());
    expect(decision(highRisk, { ...ready(), requirements: [...ready().requirements].reverse() })).toEqual(first);
  });

  it('binds the request ID, tenant, capability, operation, configuration and policy version', () => {
    const original = decision().receipt!.decisionKey;
    const otherTenant = { ...ready(), configuration: { ...configuration(), tenant_id: 'tenant-2' }, requirements: ready().requirements.map((r) => ({ ...r, tenantId: 'tenant-2' })) };
    const decisions = [
      decision(highRisk, ready(), { ...requestFor(), requestId: 'request-2' }),
      decision(highRisk, otherTenant, { ...requestFor(), tenantId: 'tenant-2' }),
      decision({ ...capabilityDefinition('CAP-046')!, maturity: 'L4' }),
      decision(highRisk, ready(), { ...requestFor(), operation: 'read' }),
      decision(highRisk, { ...ready(), configuration: { ...configuration(), version: 2 } }),
      decision(highRisk, { ...ready(), policyVersion: 'policy-2' }),
    ];
    for (const changed of decisions) { expect(changed.outcome).toBe('allow'); expect(changed.receipt!.decisionKey).not.toBe(original); }
    expect(new Set(decisions.map((d) => d.receipt!.decisionKey)).size).toBe(decisions.length);
  });

  it('escapes serialized fields without delimiter collisions', () => {
    const one = decision(highRisk, ready(), { ...requestFor(), requestId: 'a|b', operation: 'c' });
    const two = decision(highRisk, ready(), { ...requestFor(), requestId: 'a', operation: 'b|c' });
    expect(one.receipt!.decisionKey).not.toBe(two.receipt!.decisionKey);
  });

  it('preserves existing workflow inputs and references while requiring continuity', () => {
    const context = { ...without('current_evidence'), existingWorkflow: true };
    const before = structuredClone(context);
    const references = context.requirements.map((r) => r.references);
    context.requirements.forEach((r) => { Object.freeze(r.references); Object.freeze(r); });
    Object.freeze(context.requirements); Object.freeze(context.configuration!.settings); Object.freeze(context.configuration); Object.freeze(context);
    expect(decision(highRisk, context)).toEqual({ outcome: 'deny', reason: 'continuity_required', receipt: null, missing: ['current_evidence'] });
    expect(context).toEqual(before);
    context.requirements.forEach((r, i) => expect(r.references).toBe(references[i]));
  });

  it('returns only safe codes and requirement keys, never private evidence or findings', () => {
    const context = ready();
    context.configuration = { ...configuration(), tenant_id: 'other-tenant-secret', note: 'SECRET security finding' };
    context.requirements = context.requirements.map((r) => ({ ...r, status: 'failed', references: ['SECRET evidence body and token'] }));
    const result = decision(highRisk, context);
    expect(result.receipt).toBeNull();
    expect(result.missing).toEqual(keys);
    expect(JSON.stringify(result)).not.toMatch(/SECRET|other-tenant-secret|finding|token|body/);
  });

  it('uses the same UTC instant across midnight and equivalent timezone offsets', () => {
    const utc = decision(highRisk, { ...ready(), now: '2026-10-01T00:00:00Z' });
    expect(decision(highRisk, { ...ready(), now: '2026-09-30T19:00:00-05:00' })).toEqual(utc);
    expect(decision(highRisk, { ...ready(), now: '2026-10-01' })).toEqual(utc);
    const evidence = { produced: '2026-09-30', validFor: 1 };
    for (const now of ['2026-09-30T23:59:59Z', '2026-10-01T00:00:00Z']) {
      const expired = evidenceState(evidence, new Date(now).toISOString().slice(0, 10)).state === 'expired';
      const context = { ...ready(), now, requirements: ready().requirements.map((r) => r.key === 'current_evidence' ? { ...r, status: expired ? 'expired' as const : 'satisfied' as const } : r) };
      expect(decision(highRisk, context).outcome).toBe(expired ? 'unmet_requirements' : 'allow');
    }
  });

  it.each(['invalid', '2026-09-30T23:59:59', '2026-02-30', '2026-02-30T00:00:00Z'])('fails closed for invalid or timezone-ambiguous time %s', (now) => {
    expect(decision(highRisk, { ...ready(), now })).toMatchObject({ outcome: 'deny', receipt: null });
  });

  it('requires a nonempty policy version', () => {
    expect(decision(highRisk, { ...ready(), policyVersion: ' ' })).toMatchObject({ outcome: 'deny', receipt: null });
  });
});
