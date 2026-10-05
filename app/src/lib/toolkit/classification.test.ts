import { describe, expect, it } from 'vitest';
import { gate } from './classification';

describe('data-classification gate', () => {
  it('treats unclassified material as an education record and keeps it away from AI', () => {
    const v = gate(undefined, 'ai', true);
    expect(v.allowed).toBe(false);
    expect(v.reason).toMatch(/not been classified/);
  });

  it('hard-blocks T4–T6 from every action, including storing it', () => {
    for (const tier of ['T4', 'T5', 'T6'] as const)
      for (const action of ['store', 'ai', 'share', 'export', 'external'] as const) expect(gate(tier, action, true).allowed).toBe(false);
  });

  it('keeps T3 on the device but out of AI, sharing and export', () => {
    expect(gate('T3', 'store', true).allowed).toBe(true);
    for (const action of ['ai', 'share', 'export', 'external'] as const) expect(gate('T3', action, true).allowed).toBe(false);
  });

  it('never widens a course policy: public material still cannot go to AI where the course forbids it', () => {
    expect(gate('T0', 'ai', false).allowed).toBe(false);
    expect(gate('T0', 'ai', true).allowed).toBe(true);
  });

  it('refuses every external action, since no connector is approved', () => {
    expect(gate('T0', 'external', true).allowed).toBe(false);
  });
});
