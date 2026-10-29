// Action Center (role app "Student": Action Center). Pure: no I/O. Turns rows from the registers that can be waiting on a
// person into one ranked list, with fixed rules and no scoring:
//   1 holds (block registration)   2 a decision or reply waiting on you   3 overdue work   4 due soon / expiring
//   5 your own requests waiting on someone else.
// Every item names who can act, what they may do, and where; nothing here acts on anyone's behalf.
export type Action = { id: string; priority: 1 | 2 | 3 | 4 | 5; title: string; state: string; reason: string; source: string; handoff: boolean; permittedAction: string; link: string; recovery: string };

export type OvrRow = { id: number; kind: string; term: string; state: string; expires_at: string | null; student_id: string };
export type DplRow = { id: number; state: string; student_id: string; review_note?: string };
export type GasRow = { id: number; title: string; state: string };

const KIND: Record<string, string> = { prerequisite: 'Prerequisite override', credit_overload: 'Credit overload', late_registration: 'Late registration' };
const DAY = 86400e3;

/** A student's own overrides: approved ones to use before they expire, requests still with someone else. */
export function ownOverrideActions(rows: OvrRow[], now: number): Action[] {
  return rows.flatMap((r): Action[] => {
    const label = `${KIND[r.kind] ?? 'Override'} · ${r.term}`;
    if (r.state === 'approved' && r.expires_at) {
      const left = Date.parse(r.expires_at) - now;
      if (left <= 0) return [];
      return [{ id: `ovr:${r.id}`, priority: left < 7 * DAY ? 4 : 5, title: label, state: left < 7 * DAY ? 'Expiring' : 'Approved',
        reason: `Approved. Register using it within ${Math.max(1, Math.ceil(left / DAY))} day(s); it works once.`, source: 'Registrar', handoff: false,
        permittedAction: 'Register', link: '/plan/registration', recovery: 'If it expires, ask again from Registration.' }];
    }
    if (r.state === 'requested' || r.state === 'endorsed') return [{ id: `ovr:${r.id}`, priority: 5, title: label,
      state: r.state === 'requested' && r.kind !== 'prerequisite' ? 'Waiting on your advisor' : 'Waiting on the registrar',
      reason: 'Your request is not decided yet.', source: r.state === 'requested' && r.kind !== 'prerequisite' ? 'Advisor' : 'Registrar', handoff: true,
      permittedAction: 'Check status', link: '/plan/overrides', recovery: 'You can withdraw it while it is open.' }];
    return [];
  });
}

/** Requests waiting on this person as advisor (endorse) or registrar (decide). Never their own. */
export function deskOverrideActions(rows: OvrRow[], me: string, advisees: Set<string>, registrar: boolean): Action[] {
  return rows.filter((r) => r.student_id !== me).flatMap((r): Action[] => {
    const forAdvisor = r.state === 'requested' && r.kind !== 'prerequisite' && advisees.has(r.student_id);
    const forRegistrar = registrar && ((r.state === 'requested' && r.kind === 'prerequisite') || (r.state === 'endorsed' && r.kind !== 'prerequisite'));
    if (!forAdvisor && !forRegistrar) return [];
    return [{ id: `ovr:${r.id}`, priority: 2, title: `${KIND[r.kind] ?? 'Override'} · ${r.term}`, state: 'Waiting on you',
      reason: forAdvisor ? 'An advisee asked; endorse or decline before the registrar decides.' : 'Ready for a registrar decision.', source: 'Overrides', handoff: false,
      permittedAction: forAdvisor ? 'Endorse or decline' : 'Approve or deny', link: '/plan/overrides', recovery: 'Another registrar can decide if you endorsed it.' }];
  });
}

/** A student's degree plan, and advisees' plans waiting on this advisor. */
export function planActions(own: DplRow | null, advisee: DplRow[]): Action[] {
  const out: Action[] = [];
  if (own?.state === 'changes_requested') out.push({ id: `dpl:${own.id}`, priority: 2, title: 'Degree plan', state: 'Changes requested',
    reason: own.review_note ? `Your advisor: ${own.review_note}` : 'Your advisor asked for changes.', source: 'Advisor', handoff: false,
    permittedAction: 'Edit and resend', link: '/plan/degree-plan', recovery: 'Your last approved plan stays on record meanwhile.' });
  if (own?.state === 'submitted') out.push({ id: `dpl:${own.id}`, priority: 5, title: 'Degree plan', state: 'With your advisor', reason: 'Waiting for review.',
    source: 'Advisor', handoff: true, permittedAction: 'Check status', link: '/plan/degree-plan', recovery: 'Recall it to edit.' });
  for (const p of advisee) if (p.state === 'submitted') out.push({ id: `dpl:${p.id}`, priority: 2, title: 'Advisee degree plan', state: 'Waiting on you',
    reason: 'An advisee sent their plan for review.', source: 'Degree plans', handoff: false, permittedAction: 'Approve or ask for changes', link: '/plan/degree-plan',
    recovery: 'The student can recall it while you review.' });
  return out;
}

/** Assistantship offers waiting on the student's reply. */
export function offerActions(rows: GasRow[]): Action[] {
  return rows.filter((r) => r.state === 'offered').map((r) => ({ id: `gas:${r.id}`, priority: 2 as const, title: r.title, state: 'Offer waiting',
    reason: 'You have an assistantship offer to accept or decline.', source: 'Graduate office', handoff: false, permittedAction: 'Accept or decline',
    link: '/progress/assistantships', recovery: 'Nothing is paid until the graduate office confirms an accepted offer.' }));
}

/** One list: fixed priority, then title; the same item never appears twice (first, highest-priority copy wins). */
export function rankActions(items: Action[]): Action[] {
  const seen = new Set<string>();
  return [...items].sort((x, y) => x.priority - y.priority || x.title.localeCompare(y.title)).filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
}
