import { describe, expect, it } from 'vitest';
import { PlatformError } from '../gateway/errors.ts';
import {
  activateContext,
  switchActiveContext,
  type ContextDirectory,
} from './active-context.ts';

const NOW = Date.parse('2026-10-09T12:00:00Z');

const directory = (over: Partial<ContextDirectory> = {}): ContextDirectory => ({
  personId: 'person-1',
  sessionExpiresAt: '2026-10-09T14:00:00Z',
  memberships: [
    {
      id: 'membership-student',
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
      personId: 'person-1',
      status: 'active',
      expiresAt: '2026-12-31T23:59:59Z',
      workspaces: ['student'],
      roleGrantIds: ['grant-student'],
    },
    {
      id: 'membership-staff',
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
      personId: 'person-1',
      status: 'active',
      expiresAt: '2026-10-09T13:00:00Z',
      workspaces: ['staff', 'institution'],
      roleGrantIds: ['grant-advisor', 'grant-support'],
    },
  ],
  ...over,
});

const errorCode = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (error) {
    return error instanceof PlatformError ? error.code : 'not-a-platform-error';
  }
  return undefined;
};

describe('active context', () => {
  it('derives identity and scope from the verified membership and caps expiry at the earliest boundary', () => {
    const context = activateContext(directory(), { membershipId: 'membership-staff', workspace: 'staff' }, NOW);

    expect(context).toEqual({
      tenantId: 'tenant-a',
      institutionId: 'institution-a',
      personId: 'person-1',
      membershipId: 'membership-staff',
      roleGrantIds: ['grant-advisor', 'grant-support'],
      workspace: 'staff',
      expiresAt: '2026-10-09T13:00:00.000Z',
    });
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.roleGrantIds)).toBe(true);
  });

  it('refuses a membership that is not in the server-verified directory', () => {
    expect(errorCode(() => activateContext(directory(), { membershipId: 'membership-elsewhere', workspace: 'student' }, NOW))).toBe('forbidden');
  });

  it('refuses a workspace the selected membership does not grant', () => {
    expect(errorCode(() => activateContext(directory(), { membershipId: 'membership-student', workspace: 'operations' }, NOW))).toBe('forbidden');
  });

  it('refuses inactive, expired, cross-person, and expired-session contexts', () => {
    const base = directory().memberships[0];
    for (const membership of [
      { ...base, status: 'suspended' as const },
      { ...base, expiresAt: '2026-10-09T12:00:00Z' },
      { ...base, personId: 'person-2' },
    ]) {
      expect(errorCode(() => activateContext(directory({ memberships: [membership] }), { membershipId: membership.id, workspace: 'student' }, NOW))).toBe('expired');
    }
    expect(errorCode(() => activateContext(directory({ sessionExpiresAt: '2026-10-09T12:00:00Z' }), { membershipId: 'membership-student', workspace: 'student' }, NOW))).toBe('expired');
  });

  it('requires deliberate confirmation before changing membership or workspace', () => {
    const current = activateContext(directory(), { membershipId: 'membership-student', workspace: 'student' }, NOW);

    expect(errorCode(() => switchActiveContext(current, directory(), { membershipId: 'membership-staff', workspace: 'staff', confirmed: false }, NOW))).toBe('conflict');
    expect(errorCode(() => switchActiveContext(current, directory(), { membershipId: 'membership-student', workspace: 'staff', confirmed: false }, NOW))).toBe('conflict');
    expect(switchActiveContext(current, directory(), { membershipId: 'membership-staff', workspace: 'staff', confirmed: true }, NOW).workspace).toBe('staff');
  });

  it('allows an unconfirmed refresh only when the selected context is unchanged', () => {
    const current = activateContext(directory(), { membershipId: 'membership-student', workspace: 'student' }, NOW);
    const refreshed = switchActiveContext(current, directory(), { membershipId: 'membership-student', workspace: 'student', confirmed: false }, NOW + 60_000);

    expect(refreshed.membershipId).toBe(current.membershipId);
    expect(refreshed.workspace).toBe(current.workspace);
  });
});
