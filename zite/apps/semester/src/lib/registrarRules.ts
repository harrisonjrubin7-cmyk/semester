// Pure registrar rules (no zitejs imports) so they can be tested in isolation.

export type Replay = 'new' | 'replay' | 'conflict' | 'forbidden';

/** Same key + same sections → replay; same key + different sections → conflict; someone else's key → forbidden. */
export function replayDecision(prior: { studentIds: string[]; sectionId: string }[], uid: string, sectionIds: string[]): Replay {
  if (!prior.length) return 'new';
  if (!prior.every((p) => p.studentIds.includes(uid))) return 'forbidden';
  const a = [...new Set(prior.map((p) => p.sectionId))].sort().join(',');
  const b = [...new Set(sectionIds)].sort().join(',');
  return a === b ? 'replay' : 'conflict';
}

export type DecideInput = {
  decider: { id: string; institutionId: string };
  request: { studentId: string; institutionId: string; state: string; sectionInTenant: boolean };
  section: { version: number; state?: string; capacity?: number | null; enrolled: number };
  expectedVersion: number;
  decision: 'commit' | 'reject';
};

export type DecideOutcome =
  | { kind: 'deny'; message: string }
  | { kind: 'noop' }
  | { kind: 'stale' }
  | { kind: 'reject'; code: 'POLICY_RESTRICTION' | 'CAPACITY_UNAVAILABLE'; message: string }
  | { kind: 'commit' };

export function decideRegistration(i: DecideInput): DecideOutcome {
  if (i.request.institutionId !== i.decider.institutionId || !i.request.sectionInTenant) return { kind: 'deny', message: 'That request is not in your institution.' };
  if (i.request.studentId === i.decider.id) return { kind: 'deny', message: 'You cannot decide your own registration.' };
  if (i.request.state === 'Committed' || i.request.state === 'Rejected') return { kind: 'noop' };
  if (i.decision === 'reject') return { kind: 'reject', code: 'POLICY_RESTRICTION', message: 'The Registrar did not approve this request.' };
  if (i.section.version !== i.expectedVersion) return { kind: 'stale' };
  if (i.section.state && i.section.state !== 'Open') return { kind: 'reject', code: 'CAPACITY_UNAVAILABLE', message: 'This section is not open.' };
  if (i.section.capacity != null && i.section.enrolled >= i.section.capacity) return { kind: 'reject', code: 'CAPACITY_UNAVAILABLE', message: 'No seats remain in this section.' };
  return { kind: 'commit' };
}

/**
 * Re-check at commit time: conditions can change between a student's submit and the registrar's decision
 * (a hold is placed, another section is confirmed, an override is withdrawn). Returns the first blocker, or null.
 * The request is left as Submitted when blocked, so the registrar can resolve or reject it.
 */
export type CommitCheck = {
  holds: string[];                      // active holds that block registration, student-facing text
  missingPrereqs: string[];             // course codes not completed
  overrideApproved: boolean;            // an approved prerequisite override for this section
  enrolledCredits: number;              // credits already confirmed this term, excluding this section
  sectionCredits: number;
  maxCredits: number | null;
  clashesWith: string[];                // codes of confirmed sections this term that meet at the same time
};
export function commitBlocker(c: CommitCheck): string | null {
  if (c.holds.length) return `A hold now blocks registration: ${c.holds[0]}`;
  if (c.missingPrereqs.length && !c.overrideApproved) return `Prerequisite not met: ${c.missingPrereqs.join(', ')}. Approve an override first or reject.`;
  if (c.clashesWith.length) return `Time conflict with confirmed ${c.clashesWith.join(', ')}.`;
  if (c.maxCredits != null && c.enrolledCredits + c.sectionCredits > c.maxCredits)
    return `This would put the student at ${c.enrolledCredits + c.sectionCredits} credits; the limit is ${c.maxCredits}.`;
  return null;
}

/**
 * Submit idempotency (lib/subMigration.ts). A key reserves the exact sections of one submit.
 * Retrying a half-finished submit resumes it; retrying a finished one replays it; reusing the key for other
 * sections is refused. `planned` is what is still in the draft now, which shrinks as a partial run progresses.
 */
export function submitOutcome(existing: { sections: string[]; state: 'reserved' | 'done' } | null, planned: string[]): 'new' | 'resume' | 'replay' | 'conflict' {
  if (!existing) return 'new';
  if (!planned.every((p) => existing.sections.includes(p))) return 'conflict';
  return existing.state === 'done' ? 'replay' : 'resume';
}
