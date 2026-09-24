import { describe, expect, it } from 'vitest';
import { effectiveIntegrityMode, scopeKey } from './contracts';

describe('intelligence policy contracts', () => {
  it('falls back from a forbidden Draft to the first permitted learning mode and says why', () => {
    expect(
      effectiveIntegrityMode('draft', { allowed: ['hint', 'review'], reason: 'Course policy' }),
    ).toEqual({
      requested: 'draft',
      effective: 'hint',
      restricted: true,
      reason: 'Course policy',
    });
  });

  it('keys context by tenant, role, person and resource', () => {
    expect(
      scopeKey({ tenantId: 'northstar', role: 'student', personId: 'nora', resourceId: 'econ' }),
    ).toBe('northstar:student:nora:econ');
  });
});
