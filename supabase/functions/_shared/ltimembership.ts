/**
 * What `public.lti_launch_membership` said about one launch, read without I/O.
 *
 * The database does the join (`20260927235930_lti_launch_membership.sql`):
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
    // A join must name a school, a membership and an array of role names. The
    // array may be empty: SCIM creates an active membership with roles '{}'
    // and group mappings add roles later, so "active, no roles yet" is an
    // ordinary state. Refusing it would tell a student their access is not
    // active when it is. What is not trusted is a roles value that is not an
    // array of strings: that is a malformed row, not an empty one.
    const roles = Array.isArray(r.roles) && r.roles.every((x) => typeof x === 'string') ? (r.roles as string[]) : null;
    if (tenantId && typeof r.membership_id === 'string' && r.membership_id && roles) {
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

/** Membership roles that may place Semester activities into a course. */
export const PLACING_ROLES = ['faculty', 'teaching_assistant'] as const;

/**
 * Whether a Deep Linking request may place an activity, once the LMS's own
 * instructor check (`mayPlace` in `_shared/ltideeplink.ts`) has passed.
 *
 * Deep Linking was the one thing the LMS role claim still granted by itself.
 * This narrows it and never widens it: the caller runs `mayPlace` first, and
 * a pass here is only ever in addition to that.
 *
 *  - **Joined:** the school has an opinion, so it must agree. The membership
 *    must hold `faculty` or `teaching_assistant`. Both checks are required: a
 *    faculty member enrolled as a learner in someone else's course is not an
 *    instructor *there*, and the LMS is the one that knows the course.
 *  - **A membership the school made inactive, or an answer that cannot be
 *    trusted:** refused, exactly as `sessionDecision` refuses a session.
 *  - **Never reached a membership** (unbound, unlinked, none in this school,
 *    or the function not deployed yet): the LMS rule alone, as before. A school
 *    that has said nothing does not block.
 */
export function placementDecision(join: MembershipJoin): SessionDecision {
  const session = sessionDecision(join);
  if (!session.allow) return session;
  if (!join.joined) return { allow: true };
  return join.roles.some((role) => (PLACING_ROLES as readonly string[]).includes(role))
    ? { allow: true }
    : { allow: false, reason: 'membership-not-instructor' };
}
