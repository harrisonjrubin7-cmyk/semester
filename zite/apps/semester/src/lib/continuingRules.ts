// Continuing education (S-76 E02). Pure rules mirrored by lib/cneMigration.ts (the database is the authority).
// Enrollment, payment, completion and refund are separate dimensions; these helpers keep the UI's labels and previews consistent
// with the database rules.
export type Enr = { state: 'enrolled' | 'withdrawn' | 'cancelled_by_institution'; payment: 'unpaid' | 'paid' | 'sponsored' | 'waived' | 'not_required'; completion: 'in_progress' | 'completed' | 'not_completed'; refund: 'none' | 'requested' | 'approved' | 'denied' | 'issued' };

export function attendancePct(sessions: number, present: number): number {
  return sessions <= 0 ? 0 : Math.floor((100 * present) / sessions);
}

/** Why completion cannot be granted yet, or null. */
export function completionBlocker(p: { e: Enr; sessionsAhead: number; pct: number; min: number }): string | null {
  if (p.e.state !== 'enrolled') return 'This enrollment is not active.';
  if (p.e.completion !== 'in_progress') return 'Completion is already decided.';
  if (p.e.payment === 'unpaid') return 'Payment is not settled.';
  if (p.sessionsAhead > 0) return 'Sessions are still to come.';
  if (p.pct < p.min) return `Attendance is ${p.pct}%; this offering requires ${p.min}%.`;
  return null;
}

/** A learner who withdraws before any session has started gets a full refund request automatically. */
export const autoRefundOnWithdraw = (paidCents: number, anySessionStarted: boolean) => paidCents > 0 && !anySessionStarted;

export const refundAllowed = (e: Enr, paidCents: number) => paidCents > 0 && e.completion !== 'completed' && (e.refund === 'none' || e.refund === 'denied');

export function summary(e: Enr): string {
  const st = { enrolled: 'Enrolled', withdrawn: 'Withdrawn', cancelled_by_institution: 'Cancelled by the institution' }[e.state];
  const pay = { unpaid: 'payment due', paid: 'paid', sponsored: 'sponsored', waived: 'fee waived', not_required: 'no fee' }[e.payment];
  const done = { in_progress: '', completed: ' · completed', not_completed: ' · not completed' }[e.completion];
  const ref = { none: '', requested: ' · refund requested', approved: ' · refund approved', denied: ' · refund denied', issued: ' · refund issued' }[e.refund];
  return `${st} · ${pay}${done}${ref}`;
}

export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
