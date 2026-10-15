import { describe, expect, it } from 'vitest';
import { FLAGS } from '../flags';
import { capabilityDefinition } from './capability-governance';
import { OPERATION_POLICIES, isFlagOperation, operationPolicy } from './operation-policy';

describe('canonical operation policy', () => {
  it('covers every flag exactly once, with the same risk and allowed capabilities', () => {
    expect(OPERATION_POLICIES.map((policy) => policy.operation).sort()).toEqual(FLAGS.map((flag) => flag.key).sort());
    expect(new Set(OPERATION_POLICIES.map((policy) => policy.operation)).size).toBe(OPERATION_POLICIES.length);
    for (const flag of FLAGS) {
      const policy = operationPolicy(flag.key)!;
      expect(isFlagOperation(flag.key), flag.key).toBe(true);
      expect(policy.activationClass === 'high-risk', flag.key).toBe(flag.highRisk);
      expect(policy.capabilityIds, flag.key).toEqual(flag.capabilityIds);
      expect(policy.capabilityIds.length, flag.key).toBeGreaterThan(0);
      expect(new Set(policy.capabilityIds).size, flag.key).toBe(policy.capabilityIds.length);
      for (const id of policy.capabilityIds) expect(capabilityDefinition(id), `${flag.key}: ${id}`).toBeDefined();
    }
  });

  it('keeps official grade writes high-risk even for standard course capabilities', () => {
    expect(operationPolicy('writeback.lms_grade_passback')).toEqual({
      operation: 'writeback.lms_grade_passback', activationClass: 'high-risk', capabilityIds: ['CAP-020', 'CAP-021', 'CAP-030'],
    });
    expect(capabilityDefinition('CAP-020')?.activationClass).toBe('standard');
    expect(operationPolicy('writeback.registration_submit')).toEqual({
      operation: 'writeback.registration_submit', activationClass: 'high-risk', capabilityIds: ['CAP-050'],
    });
  });

  it.each(['module', 'integration', 'scope', 'release', 'experiment', 'ops', 'safety', 'writeback'])('reserves unknown %s operations for explicit policy', (prefix) => {
    expect(isFlagOperation(`${prefix}.unregistered`)).toBe(true);
    expect(operationPolicy(`${prefix}.unregistered`)).toBeUndefined();
  });

  it('leaves ordinary capability operations outside the flag namespace', () => {
    expect(isFlagOperation('activate')).toBe(false);
    expect(isFlagOperation('read')).toBe(false);
    expect(operationPolicy('read')).toBeUndefined();
  });
});
