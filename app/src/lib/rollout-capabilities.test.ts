import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
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

  it('holds each promoted capability to focused executable evidence', () => {
    const promoted = [
      'CAP-003', 'CAP-010', 'CAP-011', 'CAP-014', 'CAP-015', 'CAP-016', 'CAP-019', 'CAP-021', 'CAP-025',
      'CAP-031', 'CAP-033', 'CAP-034', 'CAP-035', 'CAP-036', 'CAP-040',
      'CAP-042', 'CAP-049', 'CAP-052', 'CAP-053', 'CAP-054', 'CAP-055',
      'CAP-013', 'CAP-018', 'CAP-027', 'CAP-041', 'CAP-043', 'CAP-044', 'CAP-045', 'CAP-046',
      'CAP-047', 'CAP-048', 'CAP-050', 'CAP-051', 'CAP-057', 'CAP-058', 'CAP-059', 'CAP-060',
    ];
    for (const id of promoted) {
      const capability = CAPABILITIES.find((item) => item.id === id)!;
      expect(capability.currentState, id).toBe('verified');
      expect(capability.sources.filter((source) => source.startsWith('repo:app/')).length, id).toBeGreaterThanOrEqual(2);
      expect(capability.acceptance[0]?.length, id).toBeGreaterThan(70);
      for (const source of capability.sources.filter((item) => item.startsWith('repo:'))) {
        expect(existsSync(resolve(process.cwd(), '..', source.slice('repo:'.length))), `${id}: ${source}`).toBe(true);
      }
    }
  });
});
