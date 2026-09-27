import { describe, expect, it } from 'vitest';
import { DEFINITION_OF_DONE, gate, RELEASE_APPROVALS } from './quality-gates';

describe('quality gates', () => {
  it('passes only when every item is satisfied, and lists the rest in order', () => {
    const almost = new Set<string>(DEFINITION_OF_DONE.filter((i) => i !== 'Rollback tested' && i !== 'Monitoring added'));
    expect(gate('done', almost)).toEqual({ passed: false, open: ['Monitoring added', 'Rollback tested'] });
    expect(gate('done', new Set(DEFINITION_OF_DONE)).passed).toBe(true);
  });

  it('adds the tenant signature to release only where a tenant asked for it', () => {
    const signed = new Set<string>(RELEASE_APPROVALS);
    expect(gate('release', signed).passed).toBe(true);
    expect(gate('release', signed, { tenantApprovalRequired: true }).open).toEqual(['Tenant or pilot']);
  });
});
