import { describe, expect, it } from 'vitest';
import { ROLES } from '../../lib/role';
import { PRINCIPAL_ROLES, isPrincipalRole, principalFromLegacy, principalOf } from './index';

describe('identity', () => {
  it('knows exactly the roles the legacy app does, so a new one cannot quietly become an applicant', () => {
    expect([...PRINCIPAL_ROLES].sort()).toEqual(ROLES.map((r) => r.id).sort());
    for (const { id } of ROLES) {
      expect(principalFromLegacy({ accountId: null, role: id, schoolId: '' }).role).toBe(id);
    }
  });

  it('treats a signed-out device as a person, not an error', () => {
    const p = principalOf({ accountId: null, role: 'student', schoolId: '' });
    expect(p).toEqual({ accountId: null, role: 'student', schoolId: null, mode: 'device' });
  });

  it('is signed in when there is an account id, and blank ids are no id', () => {
    expect(principalOf({ accountId: 'u1', role: 'student' }).mode).toBe('signed_in');
    expect(principalOf({ accountId: '   ', role: 'student' }).mode).toBe('device');
    expect(principalOf({ accountId: 'u1', schoolId: ' ' }).schoolId).toBeNull();
  });

  it('reads an unknown role as the least-offered one, and never throws', () => {
    for (const role of ['wizard', '', null, undefined, 'STUDENT']) {
      expect(principalOf({ accountId: 'u', role }).role).toBe('applicant');
    }
    expect(isPrincipalRole('student')).toBe(true);
    expect(isPrincipalRole('wizard')).toBe(false);
  });
});
