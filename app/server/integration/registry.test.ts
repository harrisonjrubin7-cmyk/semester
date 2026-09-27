import { describe, expect, it } from 'vitest';
import { validateDeclaration } from '../../src/lib/integration/adapter.ts';
import { MOCK_SIS } from '../../src/lib/integration/mock-sis.ts';
import { ADAPTERS } from './registry.ts';
import { adapterFor, type RegisteredAdapter } from './tick.ts';

/** The rules every registered adapter is held to, as one function so the control can use it too. */
function faults(adapters: readonly RegisteredAdapter[]): string[] {
  const out: string[] = [];
  for (const { declaration: d } of adapters) {
    if (d.mock) out.push(`${d.id} is a mock`);
    for (const p of validateDeclaration(d)) out.push(`${d.id}: ${p}`);
    const claim = { provider_domain: d.domain, provider_name: d.provider, provider_product: d.product };
    if (adapterFor(adapters, claim) === null) out.push(`${d.id} shares its connection with another adapter`);
  }
  return out;
}

describe('the live adapter registry', () => {
  it('holds no mock, nothing invalid, and no two adapters for one connection', () => {
    expect(faults(ADAPTERS)).toEqual([]);
  });

  it('and those rules catch a mock and a double claim (the control)', () => {
    const mock = { declaration: MOCK_SIS, pull: async () => { throw new Error('unused'); } };
    expect(faults([mock])).toContain(`${MOCK_SIS.id} is a mock`);
    const twice = faults([mock, { ...mock }]);
    expect(twice.filter((f) => f.endsWith('another adapter'))).toHaveLength(2);
  });
});
