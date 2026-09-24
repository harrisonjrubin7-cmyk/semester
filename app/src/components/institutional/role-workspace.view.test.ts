import { describe, expect, it } from 'vitest';
import {
  INSTITUTIONAL_FIXTURES,
  PREVIEW_ROLES,
  type PreviewRole,
} from '../../data/institutional-preview';
import type { VerifiedGrant } from '../../lib/institutional-access';
import {
  availableRoleFunctions,
  ROLE_DRAFT_ACTIONS,
  ROLE_WORKSPACE_FUNCTIONS,
  ROLE_WORKSPACE_TITLES,
} from './role-workspace';

const grant = (
  role: PreviewRole,
  capabilities: string[],
  expiresAt: string | null = '2027-06-30T23:59:59.000Z',
): VerifiedGrant => ({
  role,
  scopeKind: 'institution',
  scopeId: 'northstar',
  capabilities,
  expiresAt,
});

describe('role workspace capability exposure', () => {
  it('defines a titled function set for every representative role', () => {
    expect(Object.keys(ROLE_WORKSPACE_TITLES).sort()).toEqual([...PREVIEW_ROLES].sort());
    expect(Object.keys(ROLE_WORKSPACE_FUNCTIONS).sort()).toEqual([...PREVIEW_ROLES].sort());
    for (const role of PREVIEW_ROLES) {
      expect(ROLE_WORKSPACE_TITLES[role].length, role).toBeGreaterThan(8);
      expect(ROLE_WORKSPACE_FUNCTIONS[role].length, role).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps every fixture persona grant aligned with its complete visible function set', () => {
    for (const institution of INSTITUTIONAL_FIXTURES) {
      for (const person of institution.people) {
        expect(
          availableRoleFunctions(person.role, person.grants, '2026-09-24T12:00:00.000Z'),
          `${institution.id}:${person.role}`,
        ).toEqual(ROLE_WORKSPACE_FUNCTIONS[person.role]);
      }
    }
  });

  it('exposes only functions backed by a live grant for the exact role', () => {
    const functions = availableRoleFunctions('advisor', [
      grant('advisor', ['appointment:manage']),
      grant('university_admin', ['student-plan:read']),
      grant('advisor', ['student-plan:read'], '2025-01-01T00:00:00.000Z'),
    ], '2026-09-24T12:00:00.000Z');

    expect(functions.map((item) => item.label)).toEqual(['Prepare advising follow-up']);
  });

  it('fails closed for missing, malformed and expired grants', () => {
    expect(availableRoleFunctions('faculty', [], '2026-09-24T12:00:00.000Z')).toEqual([]);
    expect(availableRoleFunctions('faculty', [
      grant('faculty', ['course:manage'], 'not-a-date'),
    ], '2026-09-24T12:00:00.000Z')).toEqual([]);
  });

  it('requires every local preparation action to appear in that role function contract', () => {
    for (const role of PREVIEW_ROLES) {
      const action = ROLE_DRAFT_ACTIONS[role];
      if (!action) continue;
      expect(
        ROLE_WORKSPACE_FUNCTIONS[role].some((item) => item.capability === action.capability),
        role,
      ).toBe(true);
    }
  });
});
