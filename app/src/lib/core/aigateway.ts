export type DataClass = 'public' | 'course' | 'personal' | 'student-record';
export interface Policy { courseAllows: ('outline' | 'feedback' | 'practice' | 'write' | 'none')[]; institutionAiOn: boolean }
export interface Req { task: 'outline' | 'feedback' | 'practice' | 'write' | 'plan' | 'search'; scope: { id: string; cls: DataClass }[]; policy: Policy; budgetLeft: number }
export interface Decision { allowed: boolean; reason: string; sendScope: string[]; dropped: string[]; label: 'AI-assisted' }
/** Runs before every model call. Student records are never sent, whatever the scope says. */
export function gate(r: Req): Decision {
  const base = { label: 'AI-assisted' as const };
  if (!r.policy.institutionAiOn) return { ...base, allowed: false, reason: 'Your institution has turned AI off.', sendScope: [], dropped: r.scope.map((s) => s.id) };
  if (r.budgetLeft <= 0) return { ...base, allowed: false, reason: 'No requests left this week.', sendScope: [], dropped: r.scope.map((s) => s.id) };
  const courseTask = ['outline', 'feedback', 'practice', 'write'].includes(r.task);
  if (courseTask && !r.policy.courseAllows.includes(r.task as never)) return { ...base, allowed: false, reason: 'Your instructor doesn’t allow AI for ' + r.task + ' in this course.', sendScope: [], dropped: r.scope.map((s) => s.id) };
  const sendScope = r.scope.filter((s) => s.cls !== 'student-record').map((s) => s.id);
  const dropped = r.scope.filter((s) => s.cls === 'student-record').map((s) => s.id);
  return { ...base, allowed: true, reason: dropped.length ? 'Student records were left out.' : 'Allowed.', sendScope, dropped };
}
