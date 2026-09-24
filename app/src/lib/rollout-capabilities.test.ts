import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from './nav';
import {
  CAPABILITIES,
  NON_DESTINATION_FLOWS,
  capabilityIds,
  dispositionCounts,
} from './rollout-capabilities';

describe('rollout capability registry', () => {
  it('contains the approved sixty unique capabilities', () => {
    expect(CAPABILITIES).toHaveLength(60);
    expect(new Set(capabilityIds()).size).toBe(60);
  });

  it('gives every capability evidence, a disposition, an owner, and acceptance tests', () => {
    for (const capability of CAPABILITIES) {
      expect(capability.sources.length).toBeGreaterThan(0);
      expect(capability.acceptance.length).toBeGreaterThan(0);
      expect(capability.owner).not.toBe('');
      expect(['preserve', 'extend', 'build', 'external-gate']).toContain(capability.disposition);
    }
    expect(Object.values(dispositionCounts()).reduce((a, b) => a + b, 0)).toBe(60);
  });

  it('maps every capability to a real destination or named embedded flow', () => {
    const known = new Set([
      ...DESTINATIONS.map((destination) => destination.screen as string),
      ...NON_DESTINATION_FLOWS,
    ]);
    const unknown = CAPABILITIES.flatMap((capability) =>
      capability.destinations
        .filter((destination) => !known.has(destination))
        .map((destination) => `${capability.id}:${destination}`),
    );

    expect(unknown).toEqual([]);
  });

  it('names implementation dependencies and every external authorization gate', () => {
    for (const capability of CAPABILITIES) {
      if (capability.disposition === 'build' || capability.disposition === 'extend') {
        expect(capability.dependencies, capability.id).not.toEqual([]);
      }
      if (capability.disposition === 'external-gate') {
        expect(
          capability.dependencies.some((dependency) => dependency.startsWith('external:')),
          capability.id,
        ).toBe(true);
      }
    }
  });
});
