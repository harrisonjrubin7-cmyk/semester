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
