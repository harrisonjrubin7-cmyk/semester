/**
 * The 90-day controlled launch program (launch-readiness Phase 6, Part 10).
 *
 * Three windows of thirty days, each task with an owner role, the evidence
 * that closes it, and the tasks it cannot start before. The plan is the
 * command's; what this file adds is the ordering, stated where a test can hold
 * it: the controlled cohort cannot launch before UAT, training, support,
 * a restore rehearsal and the communications are done, and `blocked` says
 * which are missing rather than letting a status column claim otherwise.
 *
 * `docs/90-DAY-LAUNCH-PROGRAM.md` is the operator's copy, and
 * `ninety-day.test.ts` fails when a task id is in one and not the other.
 */

export type Window = 1 | 2 | 3;

/** Who answers for a task. Company roles are Semester's; `champion` is the school's named sponsor. */
export type Owner = 'founder' | 'product' | 'engineering' | 'support' | 'customer_success' | 'champion' | 'privacy' | 'accessibility';

export interface Task {
  id: string;
  window: Window;
  title: string;
  owner: Owner;
  /** What closes it — a file, a signed document, a recorded result. Never "done". */
  evidence: string;
  /** Tasks that must be done before this one starts. */
  after: readonly string[];
}

export const TASKS: readonly Task[] = [
  // Days 1–30
  { id: 'icp-cohort', window: 1, title: 'Choose the ideal customer profile and the pilot cohort', owner: 'founder', evidence: 'The pilot charter names the institution, the cohort and its size', after: [] },
  { id: 'charter-drafts', window: 1, title: 'Finalize pilot charter, pricing and terms drafts', owner: 'founder', evidence: 'Draft charter and order form, reviewed by counsel', after: ['icp-cohort'] },
  { id: 'demo-pages', window: 1, title: 'Create the demo and the role pages', owner: 'product', evidence: 'A demo script that runs on synthetic data only', after: ['icp-cohort'] },
  { id: 'trust-outline', window: 1, title: 'Create the trust center outline', owner: 'privacy', evidence: 'docs/SUBPROCESSORS.md and the procurement checklist, with every claim backed', after: [] },
  { id: 'data-inventory', window: 1, title: 'Complete the data inventory and security baseline', owner: 'engineering', evidence: 'RETENTION.md names every table; the security baseline is recorded', after: [] },
  { id: 'recruit-beta', window: 1, title: 'Recruit beta students and institutional design partners', owner: 'customer_success', evidence: 'Invitations recorded in the private beta, each accepted by the person', after: ['icp-cohort'] },
  { id: 'launch-metrics', window: 1, title: 'Set the launch metrics', owner: 'product', evidence: 'docs/PRODUCT-ANALYTICS-DATA-ETHICS.md lists each metric and its floor', after: [] },
  { id: 'a11y-core', window: 1, title: 'Conduct core accessibility testing', owner: 'accessibility', evidence: 'A test report for the golden path with assistive technology, filed under docs/evidence/', after: [] },
  // Days 31–60
  { id: 'sign-pilot', window: 2, title: 'Sign the pilot or design-partner agreement', owner: 'founder', evidence: 'The signed agreement, with the data scope it approves', after: ['charter-drafts'] },
  { id: 'tenant-flags', window: 2, title: 'Configure the tenant and its flags', owner: 'engineering', evidence: 'The tenant row and a flag list in which every flag is justified', after: ['sign-pilot'] },
  { id: 'identity', window: 2, title: 'Complete SSO, or invite-only setup', owner: 'engineering', evidence: 'An identity acceptance run, or the invite list, recorded', after: ['tenant-flags'] },
  { id: 'content-loaded', window: 2, title: 'Load verified content and sources', owner: 'champion', evidence: 'docs/launch/CONTENT-READINESS-REGISTER.md with every item READY, or its gap accepted in writing', after: ['sign-pilot'] },
  { id: 'uat', window: 2, title: 'Run UAT with student and staff cohorts', owner: 'product', evidence: 'The golden-path test script run by real students, with results filed', after: ['identity', 'content-loaded'] },
  { id: 'training', window: 2, title: 'Train pilot users', owner: 'customer_success', evidence: 'Each role has had its first-day checklist and a live session', after: ['identity'] },
  { id: 'support-ready', window: 2, title: 'Set support, status, monitoring and incident response', owner: 'support', evidence: 'A named owner and hours for the support queue; the weekly monitoring look recorded', after: [] },
  { id: 'restore-rehearsal', window: 2, title: 'Run a backup restore and a launch rehearsal', owner: 'engineering', evidence: 'A restore into a disposable project, timed and filed per RESTORE.md', after: [] },
  { id: 'comms', window: 2, title: 'Prepare communications', owner: 'champion', evidence: 'The announcement templates filled in and approved by the school', after: ['content-loaded'] },
  // Days 61–90
  { id: 'launch-cohort', window: 3, title: 'Launch the controlled cohort', owner: 'founder', evidence: 'The go/no-go record signed, and the first invitations accepted', after: ['uat', 'training', 'support-ready', 'restore-rehearsal', 'comms', 'a11y-core'] },
  { id: 'hypercare', window: 3, title: 'Run hypercare', owner: 'support', evidence: 'Daily issue log for the first two weeks', after: ['launch-cohort'] },
  { id: 'weekly-ops', window: 3, title: 'Hold the weekly operations review', owner: 'founder', evidence: 'One line per week in CHANGELOG.md, including the fine weeks', after: ['launch-cohort'] },
  { id: 'track', window: 3, title: 'Track activation, actions, support, accessibility, cost and trust', owner: 'product', evidence: 'The three figures in ANALYTICS.md, with no cell under ten', after: ['launch-cohort', 'launch-metrics'] },
  { id: 'fix-friction', window: 3, title: 'Fix the top friction', owner: 'engineering', evidence: 'The three most-reported problems, each fixed or answered', after: ['hypercare'] },
  { id: 'midpoint-report', window: 3, title: 'Prepare the midpoint outcome report', owner: 'customer_success', evidence: 'A report against the charter’s outcome criteria, aggregate only', after: ['track'] },
  { id: 'annual-proposal', window: 3, title: 'Create the annual proposal and expansion path', owner: 'founder', evidence: 'A proposal that cites the midpoint report', after: ['midpoint-report'] },
  { id: 'quotes', window: 3, title: 'Capture approved quotes and case-study material', owner: 'customer_success', evidence: 'Each quote with the speaker’s written permission', after: ['launch-cohort'] },
];

export type Status = 'not_started' | 'in_progress' | 'done' | 'blocked';

/** Structural faults: an unknown dependency, one that runs backwards in time, or a cycle. */
export function planProblems(tasks: readonly Task[]): string[] {
  const out: string[] = [];
  const byId = new Map(tasks.map((t) => [t.id, t]));
  if (byId.size !== tasks.length) out.push('an id is used twice');
  for (const t of tasks) {
    if (!t.evidence.trim()) out.push(`${t.id}: no evidence named`);
    for (const d of t.after) {
      const dep = byId.get(d);
      if (!dep) out.push(`${t.id}: depends on unknown ${d}`);
      else if (dep.window > t.window) out.push(`${t.id}: depends on ${d}, which is in a later window`);
    }
  }
  const seen = new Set<string>();
  const stack = new Set<string>();
  const visit = (id: string): boolean => {
    if (stack.has(id)) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    stack.add(id);
    const cyclic = (byId.get(id)?.after ?? []).some(visit);
    stack.delete(id);
    return cyclic;
  };
  for (const t of tasks) if (visit(t.id)) { out.push(`cycle through ${t.id}`); break; }
  return out;
}

/** The unfinished tasks standing between `id` and a start. */
export function blockers(id: string, status: Readonly<Record<string, Status>>, tasks: readonly Task[] = TASKS): string[] {
  const task = tasks.find((t) => t.id === id);
  if (!task) return [];
  return task.after.filter((d) => status[d] !== 'done');
}

/** Tasks marked started or done while something before them is not done — a status column overclaiming. */
export function overclaims(status: Readonly<Record<string, Status>>, tasks: readonly Task[] = TASKS): string[] {
  return tasks
    .filter((t) => status[t.id] === 'done' || status[t.id] === 'in_progress')
    .filter((t) => blockers(t.id, status, tasks).length > 0)
    .map((t) => `${t.id}: ${status[t.id]} before ${blockers(t.id, status, tasks).join(', ')}`);
}
