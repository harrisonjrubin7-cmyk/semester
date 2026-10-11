import { describe, expect, it } from 'vitest';
import type { AdapterDeclaration } from '../../src/lib/integration/adapter.ts';
import { MOCK_SIS } from '../../src/lib/integration/mock-sis.ts';
import { validateAdapterRegistry } from './registry-preflight.ts';
import { ADAPTERS } from './registry.ts';
import type { RegisteredAdapter } from './tick.ts';
import { CANVAS_READ_ADAPTER } from '../../../packages/platform/src/canvas-read-adapter.ts';

const live = (patch: Partial<AdapterDeclaration> = {}): RegisteredAdapter => ({
  declaration: { ...MOCK_SIS, id: 'live_sis', mock: false, ...patch },
  pull: async () => { throw new Error('unused'); },
});

describe('the live adapter registry', () => {
  it('holds no mock, nothing invalid, and no two adapters for one connection', () => {
    expect(validateAdapterRegistry(ADAPTERS)).toEqual([]);
    expect(ADAPTERS).toEqual([CANVAS_READ_ADAPTER]);
    expect(ADAPTERS.every(({ declaration }) => declaration.direction === 'read')).toBe(true);
  });

  it('accepts distinct valid live claims without changing the input', () => {
    const adapters = Object.freeze([
      Object.freeze(live()),
      Object.freeze(live({ id: 'live_sis_two', provider: 'Other Provider', product: 'Fixture 2.0' })),
      Object.freeze(live({ id: 'live_lms', domain: 'lms' })),
    ]);
    const before = JSON.stringify(adapters.map(({ declaration }) => declaration));
    expect(validateAdapterRegistry(adapters)).toEqual([]);
    expect(JSON.stringify(adapters.map(({ declaration }) => declaration))).toBe(before);
  });

  it('reports multiple simultaneous faults in deterministic order without collapsing domains', () => {
    const adapters = [
      live({ id: 'BAD', mock: true, provider: 'Bad Provider' }),
      live({ id: 'duplicate_id', provider: 'Duplicate One', product: 'One' }),
      live({ id: 'duplicate_id', provider: 'Duplicate Two', product: 'Two' }),
      live({ id: 'claim_a', provider: ' Example Provider ', product: ' Product ' }),
      live({ id: 'claim_b', provider: 'example provider', product: 'product' }),
      live({ id: 'claim_c', provider: 'example provider', product: 'different product' }),
      live({ id: 'other_domain', domain: 'lms', provider: 'example provider', product: 'product' }),
    ];
    const before = JSON.stringify(adapters.map(({ declaration }) => declaration));
    const faults = validateAdapterRegistry(adapters);
    expect(faults.map(({ adapterId, code }) => `${adapterId}:${code}`)).toEqual([
      'BAD:invalid_declaration',
      'BAD:mock_adapter',
      'claim_a:duplicate_connection_claim',
      'claim_b:duplicate_connection_claim',
      'claim_c:duplicate_connection_claim',
      'duplicate_id:duplicate_id',
      'duplicate_id:duplicate_id',
    ]);
    expect(faults.filter(({ code }) => code === 'duplicate_connection_claim')).toHaveLength(3);
    expect(faults.some(({ adapterId }) => adapterId === 'other_domain')).toBe(false);
    expect(JSON.stringify(adapters.map(({ declaration }) => declaration))).toBe(before);
  });
});
