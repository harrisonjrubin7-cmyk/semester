import { describe, expect, it } from 'vitest';
import type { ConfigVersion } from '../config/studio';
import { capabilityDefinition, type CapabilityDefinition } from './capability-governance';
import {
  ACTIVATION_REQUIREMENT_KEYS,
  evaluateActivation,
  requiredFor,
  type ActivationContext,
  type ActivationRequest,
  type RequirementState,
  type RequirementStatus,
} from './activation';

const standard = capabilityDefinition('CAP-001')!;
const controlled = capabilityDefinition('CAP-027')!;
const highRisk = capabilityDefinition('CAP-050')!;

const configuration = (over: Partial<ConfigVersion> = {}): ConfigVersion => ({
  id: 'config-7', tenant_id: 'tenant-a', domain: 'features', state: 'published', version: 7,
  settings: {}, note: 'Activation fixture', based_on: 6, created_by: 'drafter', published_by: 'publisher',
  created_at: '2026-09-29T00:00:00.000Z', updated_at: '2026-09-30T00:00:00.000Z', published_at: '2026-09-30T00:00:00.000Z',
  ...over,
});

const request = (capability: CapabilityDefinition, over: Partial<ActivationRequest> = {}): ActivationRequest => ({
  requestId: 'request-1', tenantId: 'tenant-a', actorId: 'actor-1', purpose: 'approved pilot',
  capabilityId: capability.id, operation: `open:${capability.id}`, ...over,
});

const states = (capability: CapabilityDefinition, status: RequirementStatus = 'satisfied', tenantId = 'tenant-a'): RequirementState[] =>
  requiredFor(capability)
    .filter((key) => key !== 'tenant_configuration')
    .map((key) => ({ key, status, tenantId, references: [`evidence://${key}`] }));

const context = (capability: CapabilityDefinition, over: Partial<ActivationContext> = {}): ActivationContext => ({
  now: '2026-09-30T18:00:00.000Z', policyVersion: 'policy-3', configuration: configuration(),
  requirements: states(capability), killSwitchEngaged: false, existingWorkflow: false, ...over,
});

describe('tenant capability activation', () => {
  it('allows standard, controlled and high-risk capabilities only with their ordered requirements', () => {
    expect(evaluateActivation(request(standard), standard, context(standard)).outcome).toBe('allow');
    expect(evaluateActivation(request(controlled), controlled, context(controlled, {
      requirements: states(controlled).filter((item) => item.key !== 'current_evidence'),
    }))).toMatchObject({ outcome: 'unmet_requirements', missing: ['current_evidence'] });
    expect(evaluateActivation(request(highRisk), highRisk, context(highRisk, { requirements: [] }))).toMatchObject({
      outcome: 'unmet_requirements',
      missing: ACTIVATION_REQUIREMENT_KEYS.filter((key) => key !== 'tenant_configuration'),
    });
    expect(evaluateActivation(request(highRisk), highRisk, context(highRisk)).outcome).toBe('allow');
  });

  it('fails closed for an unknown capability or unscoped tenant', () => {
    expect(evaluateActivation(request(standard), undefined, context(standard)).reason).toBe('unknown_or_unscoped_capability');
    expect(evaluateActivation(request(standard, { tenantId: '' }), standard, context(standard)).outcome).toBe('deny');
  });

  it('rejects a draft, missing version, or another tenant configuration', () => {
    for (const bad of [
      configuration({ state: 'draft' }),
      configuration({ version: null }),
      configuration({ tenant_id: 'tenant-b' }),
    ]) {
      expect(evaluateActivation(request(standard), standard, context(standard, { configuration: bad })))
        .toMatchObject({ outcome: 'unmet_requirements', missing: ['tenant_configuration'] });
    }
  });

  it.each(['missing', 'expired', 'revoked', 'failed'] as const)('does not count %s requirement state', (status) => {
    const requirements = states(controlled).map((item, index) => index === 0 ? { ...item, status } : item);
    expect(evaluateActivation(request(controlled), controlled, context(controlled, { requirements })).outcome).toBe('unmet_requirements');
  });

  it('lets any non-satisfied duplicate win and never accepts another tenant state', () => {
    const base = states(controlled);
    const duplicate = { ...base[0]!, status: 'revoked' as const };
    expect(evaluateActivation(request(controlled), controlled, context(controlled, { requirements: [...base, duplicate] })).outcome).toBe('unmet_requirements');
    expect(evaluateActivation(request(controlled), controlled, context(controlled, { requirements: states(controlled, 'satisfied', 'tenant-b') })).outcome).toBe('unmet_requirements');
  });

  it('lets the kill switch override every positive requirement', () => {
    expect(evaluateActivation(request(highRisk), highRisk, context(highRisk, { killSwitchEngaged: true })))
      .toMatchObject({ outcome: 'deny', reason: 'kill_switch_engaged', receipt: null });
  });

  it('issues deterministic receipts bound to all non-secret decision fields', () => {
    const first = evaluateActivation(request(highRisk), highRisk, context(highRisk));
    const replay = evaluateActivation(request(highRisk), highRisk, context(highRisk));
    expect(first).toEqual(replay);
    expect(first.outcome).toBe('allow');
    if (first.outcome !== 'allow') throw new Error('fixture must allow');
    expect(first.receipt.expiresAt).toBe('2026-09-30T18:15:00.000Z');
    const changed = [
      [request(highRisk, { requestId: 'request-2' }), context(highRisk)],
      [request(highRisk, { tenantId: 'tenant-b' }), context(highRisk, { configuration: configuration({ tenant_id: 'tenant-b' }), requirements: states(highRisk, 'satisfied', 'tenant-b') })],
      [request(highRisk, { capabilityId: 'CAP-046' }), context(highRisk)],
      [request(highRisk, { operation: 'different' }), context(highRisk)],
      [request(highRisk), context(highRisk, { configuration: configuration({ version: 8 }) })],
      [request(highRisk), context(highRisk, { policyVersion: 'policy-4' })],
    ] as const;
    for (const [nextRequest, nextContext] of changed) {
      const next = evaluateActivation(nextRequest, nextRequest.capabilityId === highRisk.id ? highRisk : capabilityDefinition(nextRequest.capabilityId), nextContext);
      if (next.outcome === 'allow') expect(next.receipt.decisionKey).not.toBe(first.receipt.decisionKey);
      else expect(next.reason).not.toBe('all_requirements_satisfied');
    }
  });

  it('interprets an offset-less ISO instant as UTC in every host timezone', () => {
    const result = evaluateActivation(request(standard), standard, context(standard, { now: '2026-09-30T00:00:00' }));
    if (result.outcome !== 'allow') throw new Error('fixture must allow');
    expect(result.receipt.issuedAt).toBe('2026-09-30T00:00:00.000Z');
  });

  it('returns continuity-required without mutation when an active workflow loses a prerequisite', () => {
    const requirements = states(controlled).filter((item) => item.key !== 'integration_health');
    const before = structuredClone(requirements);
    const result = evaluateActivation(request(controlled), controlled, context(controlled, { requirements, existingWorkflow: true }));
    expect(result).toMatchObject({ outcome: 'deny', reason: 'continuity_required', missing: ['integration_health'] });
    expect(requirements).toEqual(before);
    expect(result.references.every((item) => item.startsWith('evidence://'))).toBe(true);
  });

  it('does not expose evidence bodies, security findings or another tenant in reasons', () => {
    const secret = 'critical finding: SECRET';
    const requirements = states(controlled).map((item, index) => index === 0 ? { ...item, status: 'revoked' as const, references: [secret] } : item);
    const result = evaluateActivation(request(controlled), controlled, context(controlled, { requirements }));
    expect(result.reason).not.toContain(secret);
    expect(result.reason).not.toContain('tenant-b');
    expect(JSON.stringify(result.missing)).not.toContain(secret);
  });
});
