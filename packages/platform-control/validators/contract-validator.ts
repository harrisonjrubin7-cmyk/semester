import type { RegistrySnapshot, ValidationIssue } from '../types.ts';

const contractKey = /^[a-z][a-z0-9]*(?:[._][a-z0-9]+)+$/;

export function validateContracts(snapshot: RegistrySnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const capability of snapshot.capabilities) {
    for (const [kind, values] of [['commands', capability.commands], ['events', capability.events]] as const) {
      const seen = new Set<string>();
      for (const value of values) {
        if (!contractKey.test(value)) issues.push({ code: 'invalid_contract_key', path: `capabilities.${capability.key}.${kind}`, message: `${value} is not a namespaced contract key.` });
        if (seen.has(value)) issues.push({ code: 'duplicate_contract_key', path: `capabilities.${capability.key}.${kind}`, message: `${value} is duplicated.` });
        seen.add(value);
      }
    }
  }
  return issues;
}
