/**
 * Affiliations: how a person belongs to an organization, and for how long.
 *
 * A person is one identity across their whole life in Semester (applicant,
 * student, alumnus, sometimes staff). What changes is the *affiliation*: a
 * dated, sourced statement that this person stands in some relation to this
 * tenant. Roles are granted *because of* an affiliation and lapse with it, so
 * a student who graduates does not keep a student's grants and does not lose
 * their transcript — the second is a record, not an affiliation.
 */

export const AFFILIATION_KINDS = [
  'applicant',
  'student',
  'faculty',
  'staff',
  'teaching_assistant',
  'alumnus',
  'guardian_contact',
  'partner',
  'lifelong_learner',
] as const;
export type AffiliationKind = (typeof AFFILIATION_KINDS)[number];

export const AFFILIATION_STATUSES = ['pending', 'active', 'on_leave', 'ended'] as const;
export type AffiliationStatus = (typeof AFFILIATION_STATUSES)[number];

/** Where the claim came from; the order is precedence, strongest first (the audit's source-precedence column). */
export const AFFILIATION_SOURCES = ['institution_record', 'idp_attribute', 'scim', 'self_declared'] as const;
export type AffiliationSource = (typeof AFFILIATION_SOURCES)[number];

export interface Affiliation {
  id: string;
  tenantId: string;
  personId: string;
  kind: AffiliationKind;
  status: AffiliationStatus;
  /** The org node it attaches to (a program, a department), or null for the tenant as a whole. */
  nodeId: string | null;
  source: AffiliationSource;
  validFrom: string;
  validTo?: string;
}

/** Live means active (or on leave, which keeps access to records but is what policy rules read), and inside its dates. */
export function isLive(a: Affiliation, nowMs: number): boolean {
  if (a.status !== 'active' && a.status !== 'on_leave') return false;
  const from = Date.parse(a.validFrom);
  if (!Number.isFinite(from) || from > nowMs) return false;
  if (a.validTo === undefined) return true;
  const to = Date.parse(a.validTo);
  return Number.isFinite(to) && to > nowMs;
}

/** Live affiliations of one person in one tenant. Never returns another tenant's, whatever it was handed. */
export function liveAffiliations(all: readonly Affiliation[], tenantId: string, personId: string, nowMs: number): Affiliation[] {
  return all.filter((a) => a.tenantId === tenantId && a.personId === personId && isLive(a, nowMs));
}

/**
 * Whether a source may *assert* a kind. A self-declaration can say "applicant"
 * or "lifelong learner"; it cannot make anyone faculty. Institution-sourced
 * claims can say anything. This is the minimum rule; a tenant may tighten it.
 */
export function sourceMayAssert(source: AffiliationSource, kind: AffiliationKind): boolean {
  if (source !== 'self_declared') return true;
  return kind === 'applicant' || kind === 'lifelong_learner' || kind === 'student';
}

/** The stronger of two sources, for a conflict between claims about the same fact. */
export function strongerSource(a: AffiliationSource, b: AffiliationSource): AffiliationSource {
  return AFFILIATION_SOURCES.indexOf(a) <= AFFILIATION_SOURCES.indexOf(b) ? a : b;
}
