import { describe, expect, it } from 'vitest';
import { membershipJoin, membershipLogLine } from '../../../supabase/functions/_shared/ltimembership';

/**
 * The reader for `public.lti_launch_membership`. The join itself is proved in
 * `supabase/lti-membership.check.sql`; this proves the function shell cannot
 * turn anything short of a whole, well-formed join into one.
 */
describe('reading an LTI launch membership join', () => {
  const joined = { outcome: 'joined', tenant_id: 'north', membership_id: 'm-1', roles: ['student'] };

  it('reads a join, as the RPC returns it (an array of one row)', () => {
    expect(membershipJoin([joined], null)).toEqual({
      joined: true, outcome: 'joined', tenantId: 'north', membershipId: 'm-1', roles: ['student'],
    });
  });

  it.each(['unbound', 'no-registration', 'no-identity', 'identity-not-linked', 'no-membership', 'membership-suspended'])(
    'reads %s as not joined, with no roles or membership id',
    (outcome) => {
      const join = membershipJoin([{ outcome, tenant_id: 'north', membership_id: 'm-2', roles: ['admin'] }], null);
      expect(join).toEqual({ joined: false, outcome, tenantId: 'north' });
      expect(join).not.toHaveProperty('roles');
      expect(join).not.toHaveProperty('membershipId');
    },
  );

  // A row that says joined but is missing a part is not trusted as a join.
  it.each([
    { ...joined, tenant_id: null },
    { ...joined, membership_id: '' },
    { ...joined, roles: [] },
    { ...joined, roles: 'student' },
  ])('refuses a partial join %j', (row) => {
    expect(membershipJoin([row], null)).toEqual({ joined: false, outcome: 'unreadable', tenantId: null });
  });

  it('never fails a launch on an error, and tells a missing function from a broken one', () => {
    expect(membershipJoin(null, { message: 'Could not find the function public.lti_launch_membership' }))
      .toEqual({ joined: false, outcome: 'unavailable', tenantId: null });
    expect(membershipJoin(null, { message: 'connection reset' }))
      .toEqual({ joined: false, outcome: 'lookup-failed', tenantId: null });
  });

  it('reads nothing and odd words as unreadable', () => {
    expect(membershipJoin([], null).outcome).toBe('unreadable');
    expect(membershipJoin([{ outcome: 'JOINED; drop table' }], null).outcome).toBe('unreadable');
  });

  it('logs ids and words only', () => {
    expect(membershipLogLine(membershipJoin([joined], null)))
      .toBe('lti membership: joined tenant=north membership=m-1 roles=student');
    expect(membershipLogLine(membershipJoin([{ outcome: 'unbound', tenant_id: null }], null)))
      .toBe('lti membership: unbound');
  });
});
