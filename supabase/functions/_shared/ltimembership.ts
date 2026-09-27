/**
 * What `public.lti_launch_membership` said about one launch, read without I/O.
 *
 * The database does the join (`20260927220000_lti_launch_membership.sql`):
 * registration → school, `linked` identity → account, account and school →
 * membership. This file only turns its row into a decision the function shell
 * can log, and it is here rather than in the shell so `ltimembership.test.ts`
 * can walk every answer.
 *
 * Two rules, both about what this must never do:
 *
 *  - **Reading never fails a launch; only `sessionDecision` may.** A student
 *    with no membership is still a student in a course. What limits the
 *    session is a membership the school has made inactive, and that rule is
 *    written once, below, where it can be tested.
 *  - **It never grants.** `joined` carries the membership's current roles,
 *    read from `institution_membership`. Nothing here reads a role from the
 *    LMS, and anything not `joined` carries no roles and no membership id a
 *    caller could mistake for one.
 */

export type MembershipJoin =
  | { joined: true; outcome: 'joined'; tenantId: string; membershipId: string; roles: string[] }
  | { joined: false; outcome: string; tenantId: string | null };

/** The function not deployed yet: the migration lands before any caller needs it. */
const MISSING = /does not exist|schema cache|could not find the function/i;

const WORD = /^[a-z-]{1,60}$/;

export function membershipJoin(data: unknown, error: { message?: string } | null): MembershipJoin {
  if (error) {
    return { joined: false, outcome: MISSING.test(error.message ?? '') ? 'unavailable' : 'lookup-failed', tenantId: null };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return { joined: false, outcome: 'unreadable', tenantId: null };
  const r = row as Record<string, unknown>;
  const outcome = typeof r.outcome === 'string' && WORD.test(r.outcome) ? r.outcome : 'unreadable';
  const tenantId = typeof r.tenant_id === 'string' && r.tenant_id ? r.tenant_id : null;

  if (outcome === 'joined') {
    const roles = Array.isArray(r.roles) ? r.roles.filter((x): x is string => typeof x === 'string') : [];
    // A join must name all three. One that does not is not trusted as a join.
    if (tenantId && typeof r.membership_id === 'string' && r.membership_id && roles.length) {
      return { joined: true, outcome, tenantId, membershipId: r.membership_id, roles };
    }
    return { joined: false, outcome: 'unreadable', tenantId: null };
  }
  return { joined: false, outcome, tenantId };
}

/** The log line. Ids and words only: no name, email or subject beyond what the launch line already logs. */
export function membershipLogLine(join: MembershipJoin): string {
  return join.joined
    ? `lti membership: joined tenant=${join.tenantId} membership=${join.membershipId} roles=${join.roles.join(',')}`
    : `lti membership: ${join.outcome}${join.tenantId ? ` tenant=${join.tenantId}` : ''}`;
}

export type SessionDecision = { allow: true } | { allow: false; reason: string };

/**
 * Whether a launch may open a session, given its membership join.
 *
 * The rule: **a school that has an opinion about this person decides.** When
 * the join reaches a membership in the registration's school and that
 * membership is not active (`membership-suspended`, `-deprovisioned`,
 * `-pending`), the LMS is not a way around it, and no session is minted.
 *
 * Everything that never reached a membership is allowed, as before. That
 * covers a registration with no school (`unbound`, which was decided as
 * "allowed, with a warning"), a person who never linked their campus account,
 * and a linked person with no membership in this school. None of those is a
 * school withdrawing access; they are a school that has not said anything.
 *
 * Two failures are handled differently, on purpose:
 *
 *  - `unavailable` (the function is not deployed yet) is allowed. The migration
 *    and the function deploy separately, and this must not break every launch
 *    in the gap between them.
 *  - `lookup-failed` and `unreadable` refuse. The database answered and the
 *    answer could not be trusted, and this is now a gate. A gate that opens
 *    when it cannot read is not one. The launch already depends on the same
 *    database for its nonce and registration, so this costs no availability a
 *    launch had.
 */
export function sessionDecision(join: MembershipJoin): SessionDecision {
  if (join.joined) return { allow: true };
  if (join.outcome.startsWith('membership-')) return { allow: false, reason: join.outcome };
  if (join.outcome === 'lookup-failed' || join.outcome === 'unreadable') {
    return { allow: false, reason: `membership-${join.outcome}` };
  }
  return { allow: true };
}
