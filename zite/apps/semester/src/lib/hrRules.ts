// Human resources (S-76 E05). Pure rules mirrored by lib/hrmMigration.ts. The membership role changes here are what an
// administrator's "execute access change" applies; they are pure so the student-stays-a-student rule is testable.
export const EMPLOYEE_ROLES = ['Staff', 'Faculty', 'Tutor', 'Advisor'] as const;

/** Add the position's role; nothing else changes. */
export function rolesAfterProvision(current: string[], grants: string): string[] {
  return current.includes(grants) ? [...current] : [...current, grants];
}

/** Remove only the role this employment granted, and only if no other live employment grants it. Learner roles and every
 *  other role stay, so a student whose job ends is still a student. Never returns an empty list. */
export function rolesAfterOffboard(current: string[], ended: string, stillGrantedByOtherJobs: string[]): string[] {
  if (stillGrantedByOtherJobs.includes(ended)) return [...current];
  const next = current.filter((r) => r !== ended);
  return next.length ? next : ['Student'];
}

/** Drift between HR facts and the membership: roles to add for live provisioned jobs, roles still present after removal. */
export function reconcile(roles: string[], jobs: { grants: string; access: string; state: string }[]) {
  const live = new Set(jobs.filter((j) => j.state === 'active' && j.access === 'provisioned').map((j) => j.grants));
  const missing = [...live].filter((r) => !roles.includes(r));
  const lingering = jobs.filter((j) => j.access === 'removed' && roles.includes(j.grants) && !live.has(j.grants)).map((j) => j.grants);
  return { missing, lingering: [...new Set(lingering)] };
}

export const onLeave = (leave: { state: string; from: string; to: string }[], day: string) => leave.some((l) => l.state === 'approved' && l.from <= day && day <= l.to);
