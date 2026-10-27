// Audit and Assurance (S-76 E32). Pure rules, mirrored by lib/audMigration.ts (the database is the authority).
// Audit access is purpose-bound: an administrator grants one person a stated purpose, a set of areas and an end date; there
// is no read-all auditor role. Evidence is a reference plus a SHA-256 the auditor recorded, never a copy of production data,
// and anyone holding a live grant can re-hash and compare (reproducibility / tamper detection). A finding is answered and
// remediated by its management owner and closed only by an auditor who is neither the owner nor the remediator.
export const AREAS = ['finance', 'admissions', 'registrar', 'financial_aid', 'it_security', 'facilities', 'research', 'privacy', 'hr'] as const;
export type Area = (typeof AREAS)[number];
export const AREA_LABEL: Record<Area, string> = { finance: 'Finance', admissions: 'Admissions', registrar: 'Registrar', financial_aid: 'Financial aid', it_security: 'IT security', facilities: 'Facilities', research: 'Research', privacy: 'Privacy', hr: 'Human resources' };
export const MAX_GRANT_DAYS = 180;
export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export type FindingState = 'issued' | 'responded' | 'awaiting_verification' | 'closed';

export type Grant = { auditorId: string; areas: string[]; expiresAt: Date; revokedAt: Date | null };

export function grantLive(g: Grant, area: string, now: Date): boolean {
  return !g.revokedAt && g.expiresAt.getTime() > now.getTime() && g.areas.includes(area);
}

export function grantBlocker(p: { adminId: string; userId: string; purpose: string; areas: string[]; days: number }): string | null {
  if (p.adminId === p.userId) return 'Ask another administrator to grant you audit access.';
  if (p.purpose.trim().length < 10) return 'State the purpose of the audit (at least 10 characters).';
  if (p.areas.length === 0 || p.areas.some((a) => !(AREAS as readonly string[]).includes(a)) || new Set(p.areas).size !== p.areas.length) return 'Choose the areas this audit covers.';
  if (!Number.isInteger(p.days) || p.days < 1 || p.days > MAX_GRANT_DAYS) return `Audit access lasts between 1 and ${MAX_GRANT_DAYS} days.`;
  return null;
}

export const isSha256 = (s: string) => /^[0-9a-f]{64}$/.test(s);

/** Which finding steps are allowed, and for whom. */
export function findingStep(p: { state: FindingState; step: 'respond' | 'remediate' | 'verify_accept' | 'verify_reject'; actor: string; owner: string; remediator: string | null; auditorLive: boolean }): string | null {
  const { state, step, actor, owner, remediator, auditorLive } = p;
  if (state === 'closed') return 'This finding is closed.';
  if (step === 'respond') {
    if (actor !== owner) return 'Only the management owner responds to a finding.';
    return state === 'issued' || state === 'responded' ? null : 'The response is already recorded; remediation is under way.';
  }
  if (step === 'remediate') {
    if (actor !== owner) return 'Only the management owner records remediation.';
    return state === 'responded' ? null : state === 'issued' ? 'Record a management response first.' : 'Remediation is already awaiting verification.';
  }
  if (!auditorLive) return 'You need live audit access to this area.';
  if (actor === owner) return 'The management owner cannot verify their own finding.';
  if (actor === remediator) return 'Someone other than the person who remediated verifies closure.';
  return state === 'awaiting_verification' ? null : 'Nothing is awaiting verification yet.';
}

export function nextFindingState(step: 'respond' | 'remediate' | 'verify_accept' | 'verify_reject'): FindingState {
  return step === 'respond' ? 'responded' : step === 'remediate' ? 'awaiting_verification' : step === 'verify_accept' ? 'closed' : 'responded';
}

export const FINDING_LABEL: Record<FindingState, string> = { issued: 'Issued — awaiting management response', responded: 'Responded — remediation in progress', awaiting_verification: 'Remediated — awaiting independent verification', closed: 'Closed — independently verified' };
