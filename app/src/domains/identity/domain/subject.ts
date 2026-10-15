/**
 * Who is asking.
 *
 * The one description of a person that every other domain is handed, so that
 * none of them has to know where it came from: a Supabase session, a stored
 * role on the device, a school's SSO claim, or nothing at all. Semester is
 * fully usable signed out (ADR 0001), so "nobody" is a valid subject, not an
 * error.
 *
 * A subject is a *claim the client holds*. It is what the interface uses to
 * decide what to offer; it is never what a record is protected by. That is
 * row-level security (ADR 0002), which does not trust this object.
 */
export interface Subject {
  /** The account id, or `null` on a device that is not signed in. */
  readonly id: string | null;
  readonly signedIn: boolean;
  readonly roleId: string;
  /** The school the capabilities below were granted over. */
  readonly schoolId: string | null;
  /** Capabilities held over exactly `schoolId`; sorted, no duplicates. Empty without a school. */
  readonly capabilities: readonly string[];
}

/** What a source of identity can say, before it is tidied. */
export interface IdentityFacts {
  readonly userId: string | null | undefined;
  readonly roleId: string;
  readonly schoolId: string | null | undefined;
  readonly capabilities: readonly string[];
}

const blank = (s: string | null | undefined): s is null | undefined => s == null || s.trim() === '';

/**
 * Tidy what a source said. A blank id is signed out; capabilities without a
 * school are dropped, because a capability is always *over* something and
 * `lib/capabilities.ts` already refuses the empty school for the same reason.
 */
export function makeSubject(facts: IdentityFacts): Subject {
  const id = blank(facts.userId) ? null : facts.userId.trim();
  const schoolId = blank(facts.schoolId) ? null : facts.schoolId.trim();
  return {
    id,
    signedIn: id !== null,
    roleId: facts.roleId,
    schoolId,
    capabilities: schoolId === null ? [] : [...new Set(facts.capabilities)].sort(),
  };
}

export const hasCapability = (subject: Subject, capability: string): boolean => subject.capabilities.includes(capability);
