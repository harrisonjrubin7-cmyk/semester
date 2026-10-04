/**
 * Who is asking.
 *
 * A `Principal` is the one description of the person at the keyboard that every
 * other domain is allowed to read. It is deliberately small: an account id when
 * there is one, a role, and a school. Everything else the legacy code knows
 * about a person — their preferences, their plan, their courses — belongs to
 * the domain that uses it, not here.
 *
 * Signed out is a first-class state, not an error. The app is fully usable on
 * one device with no account (ADR 0001), so `accountId: null` is a person, and
 * `mode` says which of the two they are so nothing has to infer it from a null.
 *
 * None of this authorizes anything. Authorization is the database's job
 * (ADR 0002); this feeds the *policy* domain, which decides what to offer.
 */

export const PRINCIPAL_ROLES = [
  'student',
  'faculty',
  'teaching_assistant',
  'advisor',
  'admin',
  'staff',
  'applicant',
  'payer',
  'family',
  'alumni',
] as const;
export type PrincipalRole = (typeof PRINCIPAL_ROLES)[number];

export type PrincipalMode = 'device' | 'signed_in';

export interface Principal {
  /** The account's id, or null on a device with no account. */
  readonly accountId: string | null;
  readonly role: PrincipalRole;
  /** The campus this person studies at, or null when none is set. */
  readonly schoolId: string | null;
  readonly mode: PrincipalMode;
}

export const isPrincipalRole = (value: unknown): value is PrincipalRole =>
  typeof value === 'string' && (PRINCIPAL_ROLES as readonly string[]).includes(value);

/**
 * Build a principal from what a host knows. Anything unrecognised becomes the
 * least-privileged reading rather than an error: an unknown role is an
 * `applicant`, who is offered the least, so a bad value can only hide things.
 */
export function principalOf(input: {
  accountId?: string | null;
  role?: string | null;
  schoolId?: string | null;
}): Principal {
  const accountId = input.accountId && input.accountId.trim() !== '' ? input.accountId : null;
  const schoolId = input.schoolId && input.schoolId.trim() !== '' ? input.schoolId : null;
  return {
    accountId,
    role: isPrincipalRole(input.role) ? input.role : 'applicant',
    schoolId,
    mode: accountId === null ? 'device' : 'signed_in',
  };
}
