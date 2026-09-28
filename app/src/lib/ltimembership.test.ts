import { describe, expect, it } from 'vitest';
import { membershipJoin, membershipLogLine, placementDecision, sessionDecision } from '../../../supabase/functions/_shared/ltimembership';

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
  // An empty roles array is not a missing part (see the next test); a roles
  // value that is not an array of strings is.
  it.each([
    { ...joined, tenant_id: null },
    { ...joined, membership_id: '' },
    { ...joined, roles: 'student' },
    { ...joined, roles: null },
    { ...joined, roles: ['student', 42] },
  ])('refuses a partial join %j', (row) => {
    expect(membershipJoin([row], null)).toEqual({ joined: false, outcome: 'unreadable', tenantId: null });
  });

  // SCIM creates an active membership with roles '{}' and group mappings add
  // roles later, so active-with-no-roles is an ordinary state, not a broken row.
  it('reads an active membership with no roles yet as joined, with no roles', () => {
    expect(membershipJoin([{ ...joined, roles: [] }], null)).toEqual({
      joined: true, outcome: 'joined', tenantId: 'north', membershipId: 'm-1', roles: [],
    });
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

describe('limiting the LTI session to the membership', () => {
  const decide = (outcome: string) => sessionDecision(membershipJoin([{ outcome, tenant_id: 'north' }], null));

  it('opens a session for a joined, active membership', () => {
    expect(sessionDecision(membershipJoin([{ outcome: 'joined', tenant_id: 'north', membership_id: 'm-1', roles: ['student'] }], null)))
      .toEqual({ allow: true });
  });

  it.each(['membership-suspended', 'membership-deprovisioned', 'membership-pending'])(
    'refuses when the school made the membership inactive: %s',
    (outcome) => expect(decide(outcome)).toEqual({ allow: false, reason: outcome }),
  );

  // A school that has said nothing is not a school withdrawing access.
  it.each(['unbound', 'no-registration', 'no-identity', 'identity-not-linked', 'no-membership'])(
    'still allows a launch that never reached a membership: %s',
    (outcome) => expect(decide(outcome)).toEqual({ allow: true }),
  );

  it('allows while the join function is not deployed, and refuses when its answer cannot be trusted', () => {
    expect(sessionDecision(membershipJoin(null, { message: 'Could not find the function public.lti_launch_membership' })))
      .toEqual({ allow: true });
    expect(sessionDecision(membershipJoin(null, { message: 'connection reset' })))
      .toEqual({ allow: false, reason: 'membership-lookup-failed' });
    expect(sessionDecision(membershipJoin([{ outcome: 'joined', tenant_id: null }], null)))
      .toEqual({ allow: false, reason: 'membership-unreadable' });
  });
});

describe('placing an activity, scoped by the joined roles', () => {
  const joinedAs = (...roles: string[]) =>
    membershipJoin([{ outcome: 'joined', tenant_id: 'north', membership_id: 'm-1', roles }], null);

  it.each([['faculty'], ['teaching_assistant'], ['student', 'teaching_assistant']])(
    'allows a joined membership holding %j',
    (...roles) => expect(placementDecision(joinedAs(...roles))).toEqual({ allow: true }),
  );

  // The LMS said instructor to get this far; the school says otherwise.
  it.each([['student'], ['advisor'], ['admin'], ['staff', 'alumni']])(
    'refuses a joined membership holding only %j',
    (...roles) => expect(placementDecision(joinedAs(...roles)))
      .toEqual({ allow: false, reason: 'membership-not-instructor' }),
  );

  // Active but no roles yet: the student may enter (the session gate is about
  // whether access is active), but nothing makes them an instructor.
  it('lets an active membership with no roles in, and does not let it place', () => {
    const noRoles = joinedAs();
    expect(sessionDecision(noRoles)).toEqual({ allow: true });
    expect(placementDecision(noRoles)).toEqual({ allow: false, reason: 'membership-not-instructor' });
  });

  it('refuses where the session gate would, before looking at roles', () => {
    const suspended = membershipJoin([{ outcome: 'membership-suspended', tenant_id: 'north' }], null);
    expect(placementDecision(suspended)).toEqual({ allow: false, reason: 'membership-suspended' });
    expect(placementDecision(membershipJoin(null, { message: 'connection reset' })))
      .toEqual({ allow: false, reason: 'membership-lookup-failed' });
  });

  it.each(['unbound', 'no-identity', 'identity-not-linked', 'no-membership'])(
    'leaves the LMS rule alone when no membership was reached: %s',
    (outcome) => expect(placementDecision(membershipJoin([{ outcome, tenant_id: 'north' }], null)))
      .toEqual({ allow: true }),
  );
});
