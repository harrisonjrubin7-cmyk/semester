/** Pure preflight checks for a proposed live adapter registry. */
import { validateDeclaration } from '../../src/lib/integration/adapter.ts';
import type { RegisteredAdapter } from './tick.ts';

export type AdapterRegistryFaultCode =
  | 'invalid_declaration'
  | 'mock_adapter'
  | 'duplicate_id'
  | 'duplicate_connection_claim';

export interface AdapterRegistryFault {
  code: AdapterRegistryFaultCode;
  adapterId: string;
  adapterIndex: number;
  message: string;
}

const FAULT_ORDER: Readonly<Record<AdapterRegistryFaultCode, number>> = {
  invalid_declaration: 0,
  mock_adapter: 1,
  duplicate_id: 2,
  duplicate_connection_claim: 3,
};

const normalizedName = (value: string) => value.trim().toLowerCase();
const compareText = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

/**
 * Validate without registering or running any adapter.
 *
 * Every member of a duplicate group gets its own fault so callers can point
 * at each declaration. Domain is deliberately not normalized: it is already
 * a closed catalog value and is part of the runtime connection claim. Product
 * is deliberately excluded from the claim: runtime connections may omit it,
 * in which case `adapterFor` matches every product for the provider. Allowing
 * two products here would therefore create an ambiguous, unrunnable registry.
 */
export function validateAdapterRegistry(adapters: readonly RegisteredAdapter[]): AdapterRegistryFault[] {
  const faults: AdapterRegistryFault[] = [];
  const byId = new Map<string, number[]>();
  const byClaim = new Map<string, number[]>();

  adapters.forEach(({ declaration }, adapterIndex) => {
    for (const problem of validateDeclaration(declaration)) {
      faults.push({
        code: 'invalid_declaration',
        adapterId: declaration.id,
        adapterIndex,
        message: problem,
      });
    }
    if (declaration.mock) {
      faults.push({
        code: 'mock_adapter',
        adapterId: declaration.id,
        adapterIndex,
        message: 'mock adapters cannot be registered for live connections',
      });
    }

    const idMembers = byId.get(declaration.id) ?? [];
    idMembers.push(adapterIndex);
    byId.set(declaration.id, idMembers);

    const claim = JSON.stringify([
      declaration.domain,
      normalizedName(declaration.provider),
    ]);
    const claimMembers = byClaim.get(claim) ?? [];
    claimMembers.push(adapterIndex);
    byClaim.set(claim, claimMembers);
  });

  const addDuplicateFaults = (
    groups: ReadonlyMap<string, readonly number[]>,
    code: Extract<AdapterRegistryFaultCode, 'duplicate_id' | 'duplicate_connection_claim'>,
    message: string,
  ) => {
    for (const members of groups.values()) {
      if (members.length < 2) continue;
      for (const adapterIndex of members) {
        faults.push({
          code,
          adapterId: adapters[adapterIndex].declaration.id,
          adapterIndex,
          message,
        });
      }
    }
  };

  addDuplicateFaults(byId, 'duplicate_id', 'adapter id must be unique');
  addDuplicateFaults(byClaim, 'duplicate_connection_claim', 'provider connection claim must be unique');

  return faults.sort((left, right) => compareText(left.adapterId, right.adapterId)
    || FAULT_ORDER[left.code] - FAULT_ORDER[right.code]
    || left.adapterIndex - right.adapterIndex
    || compareText(left.message, right.message));
}
