/**
 * Relationships: person-to-person ties that can *carry* access.
 *
 * An advisor advises, a guardian is a guardian, an instructor teaches a
 * section. None of these is a role (a role is "may do X within a scope") and
 * none grants access by existing: the audit's governance matrix is "Guardian:
 * no default access … consent and policy". So a relationship is a fact with a
 * verification state, and what it *enables* is the right to be *offered* a
 * consent — or, for instructor and advisor, to act within a node the
 * institution has given them.
 *
 * Age and legal basis are the institution's call and arrive as policy input;
 * this module does not decide when a guardian's standing ends. It does refuse
 * to treat an unverified, ended or self-declared guardian tie as live.
 */

export const RELATIONSHIP_KINDS = ['guardian_of', 'payer_for', 'advisor_of', 'instructor_of', 'mentor_of', 'emergency_contact_of'] as const;
export type RelationshipKind = (typeof RELATIONSHIP_KINDS)[number];

export const RELATIONSHIP_VERIFICATIONS = ['unverified', 'student_confirmed', 'institution_verified', 'document_verified'] as const;
export type RelationshipVerification = (typeof RELATIONSHIP_VERIFICATIONS)[number];

export interface Relationship {
  id: string;
  tenantId: string;
  /** The person acting (the guardian, the advisor). */
  fromPersonId: string;
  /** The person acted for (the student). */
  toPersonId: string;
  kind: RelationshipKind;
  verification: RelationshipVerification;
  validFrom: string;
  validTo?: string;
  endedAt?: string;
}

/**
 * The weakest verification at which each kind may be relied on. A guardian
 * tie a student merely typed in is a request for a consent prompt, never a
 * standing; an advisor or instructor tie must come from the institution.
 */
export const MIN_VERIFICATION: Record<RelationshipKind, RelationshipVerification> = {
  guardian_of: 'document_verified',
  payer_for: 'student_confirmed',
  advisor_of: 'institution_verified',
  instructor_of: 'institution_verified',
  mentor_of: 'student_confirmed',
  emergency_contact_of: 'student_confirmed',
};

export function relationshipIsLive(r: Relationship, nowMs: number): boolean {
  if (r.endedAt !== undefined) return false;
  if (r.fromPersonId === r.toPersonId) return false;
  const from = Date.parse(r.validFrom);
  if (!Number.isFinite(from) || from > nowMs) return false;
  if (r.validTo !== undefined) {
    const to = Date.parse(r.validTo);
    if (!Number.isFinite(to) || to <= nowMs) return false;
  }
  const have = RELATIONSHIP_VERIFICATIONS.indexOf(r.verification);
  const need = RELATIONSHIP_VERIFICATIONS.indexOf(MIN_VERIFICATION[r.kind]);
  return have >= need;
}

/** The live relationship, if any, by which `actor` may act for `subject` — in this tenant only. */
export function findLiveRelationship(
  all: readonly Relationship[],
  tenantId: string,
  actorId: string,
  subjectId: string,
  kind: RelationshipKind,
  nowMs: number,
): Relationship | undefined {
  return all.find(
    (r) => r.tenantId === tenantId && r.fromPersonId === actorId && r.toPersonId === subjectId && r.kind === kind && relationshipIsLive(r, nowMs),
  );
}
