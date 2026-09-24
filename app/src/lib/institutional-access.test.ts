import { describe, expect, it } from 'vitest';
import { resolveWorkspaceAccess, type VerifiedGrant } from './institutional-access';

const live: VerifiedGrant = {
  role: 'academic_advisor',
  scopeKind: 'institution',
  scopeId: 'northstar',
  capabilities: ['student-plan:read', 'appointment:manage'],
  expiresAt: '2027-01-01T00:00:00.000Z',
};

describe('institutional access presentation', () => {
  it('never promotes a client-selected role into authorization', () => {
    const access = resolveWorkspaceAccess({ selectedRole: 'university_admin', grants: [] });

    expect(access.authorizedCapabilities).toEqual([]);
    expect(access.presentationRole).toBe('university_admin');
  });

  it('uses only live verified grants and returns unique sorted capabilities and scopes', () => {
    const expired: VerifiedGrant = {
      ...live,
      role: 'university_admin',
      scopeId: 'cedar-coast',
      capabilities: ['platform:configure'],
      expiresAt: '2025-01-01T00:00:00.000Z',
    };
    const second: VerifiedGrant = {
      ...live,
      scopeKind: 'course',
      scopeId: 'econ-101',
      capabilities: ['appointment:manage', 'course:read'],
      expiresAt: null,
    };

    const access = resolveWorkspaceAccess({
      selectedRole: 'student',
      grants: [expired, second, live],
      now: '2026-09-23T12:00:00.000Z',
    });

    expect(access.authorizedCapabilities).toEqual([
      'appointment:manage',
      'course:read',
      'student-plan:read',
    ]);
    expect(access.scopes).toEqual([
      { kind: 'course', id: 'econ-101' },
      { kind: 'institution', id: 'northstar' },
    ]);
  });

  it('treats malformed expiration values as expired instead of widening access', () => {
    const access = resolveWorkspaceAccess({
      selectedRole: 'faculty',
      grants: [{ ...live, expiresAt: 'not-a-date' }],
      now: '2026-09-23T12:00:00.000Z',
    });

    expect(access.authorizedCapabilities).toEqual([]);
    expect(access.scopes).toEqual([]);
  });
});
