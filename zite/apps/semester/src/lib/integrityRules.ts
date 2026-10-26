// Academic integrity cases (Semester Faculty "academic integrity"; S-60 §5; D12 "integrity"; D37 conduct). Pure; mirrors the
// state machine in lib/intMigration.ts and is unit-tested in tests/integrity.test.ts.
// Rules: a case is visible only to the student, the reporting instructor and the integrity office; an outcome never changes a
// grade by itself (any grade change is a separate, audited instructor action); every decision has a reason.
export const CATEGORIES = ['plagiarism', 'unauthorized_collaboration', 'unauthorized_ai', 'exam_misconduct', 'fabrication', 'other'] as const;
export const SANCTIONS = ['warning', 'redo', 'grade_penalty', 'zero_on_work', 'course_failure_recommended', 'none'] as const;
export type State = 'reported' | 'responded' | 'proposed' | 'resolved_course' | 'referred' | 'decided' | 'appealed' | 'closed' | 'withdrawn';
export type Step = 'respond' | 'propose' | 'accept' | 'decline' | 'refer' | 'decide' | 'appeal' | 'decide_appeal' | 'withdraw' | 'close';
export type Actor = 'student' | 'reporter' | 'officer';

const MOVES: Record<Step, { who: Actor; from: State[]; to: State }> = {
  respond: { who: 'student', from: ['reported'], to: 'responded' },
  propose: { who: 'reporter', from: ['reported', 'responded'], to: 'proposed' },
  accept: { who: 'student', from: ['proposed'], to: 'resolved_course' },
  decline: { who: 'student', from: ['proposed'], to: 'referred' },
  refer: { who: 'reporter', from: ['reported', 'responded'], to: 'referred' },
  decide: { who: 'officer', from: ['referred'], to: 'decided' },
  appeal: { who: 'student', from: ['decided'], to: 'appealed' },
  decide_appeal: { who: 'officer', from: ['appealed'], to: 'closed' },
  withdraw: { who: 'reporter', from: ['reported', 'responded', 'proposed'], to: 'withdrawn' },
  close: { who: 'officer', from: ['decided'], to: 'closed' },
};
/** Next state, or null when this actor may not take this step now. */
export function next(state: State, step: Step, actor: Actor): State | null {
  const m = MOVES[step];
  return m.who === actor && m.from.includes(state) ? m.to : null;
}
/** Visibility: the three parties only. Other faculty, advisors and administrators get nothing. */
export const canSee = (c: { studentId: string; reporterId: string }, userId: string, isOfficer: boolean) =>
  userId === c.studentId || userId === c.reporterId || isOfficer;
/** Independence: an officer never decides a case they reported or are the subject of; an appeal needs a different officer. */
export function officerBlocker(c: { studentId: string; reporterId: string; decidedBy: string | null }, officer: string, step: 'decide' | 'decide_appeal'): string | null {
  if (officer === c.reporterId) return 'You reported this case, so another officer must decide it.';
  if (officer === c.studentId) return 'You cannot decide a case about yourself.';
  if (step === 'decide_appeal' && officer === c.decidedBy) return 'An appeal must be decided by a different officer.';
  return null;
}
