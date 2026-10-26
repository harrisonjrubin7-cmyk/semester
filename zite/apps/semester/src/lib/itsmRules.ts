// IT Service Management (S-76 E15). Pure; mirrors lib/itsMigration.ts and is unit-tested in tests/itsm.test.ts.
// Rules: IT agents, service owners and security staff are granted by an administrator, never themselves. Tickets go
// open → assigned → fulfilled → closed; only the requester can confirm a fulfilled ticket, and a ticket an agent closes
// without that confirmation says so. Closing a ticket never changes a linked change's outcome. Security incidents are seen
// only by their reporter and security staff. Changes are approved by the service's owner (never the person who raised
// them), approval is pinned to the exact plan, and editing the plan withdraws the approval. An emergency change may be
// implemented before approval, but then it stays open until the owner records a retrospective review.
export type Kind = 'request' | 'incident' | 'security_incident';
export type TicketState = 'open' | 'assigned' | 'fulfilled' | 'closed' | 'cancelled';
export type TicketStep = 'assign' | 'fulfill' | 'review' | 'confirm' | 'reopen' | 'close' | 'cancel';
export type Role = 'requester' | 'agent';

const T: Record<TicketStep, { who: Role; from: TicketState[]; to: TicketState }> = {
  assign: { who: 'agent', from: ['open', 'assigned'], to: 'assigned' },
  fulfill: { who: 'agent', from: ['assigned'], to: 'fulfilled' },
  review: { who: 'agent', from: ['fulfilled'], to: 'fulfilled' },
  confirm: { who: 'requester', from: ['fulfilled'], to: 'closed' },
  reopen: { who: 'requester', from: ['fulfilled'], to: 'assigned' },
  close: { who: 'agent', from: ['fulfilled'], to: 'closed' },
  cancel: { who: 'requester', from: ['open', 'assigned'], to: 'cancelled' },
};

export function nextTicket(state: TicketState, step: TicketStep, role: Role): TicketState | null {
  const m = T[step];
  return m && m.who === role && m.from.includes(state) ? m.to : null;
}
/** Steps open to this role; the problem review exists only for incidents, and an incident is confirmed only after it. */
export const ticketSteps = (state: TicketState, role: Role, kind: Kind = 'request', reviewed = false) =>
  (Object.keys(T) as TicketStep[]).filter((s) => nextTicket(state, s, role) && !(s === 'review' && kind === 'request') && !(s === 'confirm' && kind !== 'request' && !reviewed));

/** Why a ticket step is refused beyond the state machine, or null. */
export function ticketBlocker(kind: Kind, step: TicketStep, note: string): string | null {
  if (step === 'fulfill' && note.trim().length < 10) return kind === 'request' ? 'Say what was done (at least 10 characters).' : 'Say how service was restored (at least 10 characters).';
  if ((step === 'close' || step === 'review') && kind !== 'request' && note.trim().length < 20) return 'Closing an incident needs a problem review: the cause and what prevents it again (at least 20 characters).';
  if (step === 'close' && kind === 'request' && note.trim().length < 5) return 'Give a reason for closing without the requester’s confirmation.';
  if (step === 'reopen' && note.trim().length < 5) return 'Say what is still wrong.';
  return null;
}

/** Who may see a ticket. */
export const canSeeTicket = (kind: Kind, isRequester: boolean, staff: { agent: boolean; security: boolean }) =>
  isRequester || (kind === 'security_incident' ? staff.security : staff.agent || staff.security);

export type ChangeState = 'submitted' | 'approved' | 'rejected' | 'implemented' | 'verified' | 'rolled_back' | 'reviewed';
export type ChangeStep = 'edit' | 'approve' | 'reject' | 'implement' | 'verify' | 'roll_back' | 'review';

/** The next change state, or null. `owner` = the service owner; `raiser` = who raised the change. */
export function nextChange(c: { state: ChangeState; emergency: boolean; approved: boolean }, step: ChangeStep, who: { owner: boolean; raiser: boolean }): ChangeState | null {
  switch (step) {
    case 'edit': return who.raiser && ['submitted', 'approved', 'rejected'].includes(c.state) ? 'submitted' : null;
    case 'approve': return who.owner && !who.raiser && c.state === 'submitted' ? 'approved' : null;
    case 'reject': return who.owner && !who.raiser && ['submitted', 'approved'].includes(c.state) ? 'rejected' : null;
    case 'implement': return who.raiser && (c.state === 'approved' || (c.emergency && c.state === 'submitted')) ? 'implemented' : null;
    case 'verify': return (who.raiser || who.owner) && c.state === 'implemented' ? 'verified' : null;
    case 'roll_back': return (who.raiser || who.owner) && c.state === 'implemented' ? 'rolled_back' : null;
    case 'review': return who.owner && !who.raiser && c.emergency && !c.approved && ['verified', 'rolled_back'].includes(c.state) ? 'reviewed' : null;
  }
}

/** Is the change finished? An emergency change made without approval is not finished until it has been reviewed. */
export const changeDone = (c: { state: ChangeState; emergency: boolean; approved: boolean }) =>
  c.state === 'rejected' || c.state === 'reviewed' || (['verified', 'rolled_back'].includes(c.state) && (!c.emergency || c.approved));

/** Plain words for what a linked change has actually achieved — a closed ticket is not evidence of this. */
export function changeOutcome(state: ChangeState): string {
  return ({ submitted: 'Awaiting approval', approved: 'Approved, not yet made', rejected: 'Rejected', implemented: 'Made, not yet verified',
    verified: 'Verified as working', rolled_back: 'Rolled back', reviewed: 'Reviewed after emergency' } as Record<ChangeState, string>)[state];
}

/** Hours since opening beyond which an open/assigned ticket is overdue, by kind. */
export const TARGET_HOURS: Record<Kind, number> = { security_incident: 4, incident: 8, request: 72 };
export const overdue = (kind: Kind, state: TicketState, openedAt: Date, now: Date) =>
  (state === 'open' || state === 'assigned') && (now.getTime() - openedAt.getTime()) / 3_600_000 > TARGET_HOURS[kind];
