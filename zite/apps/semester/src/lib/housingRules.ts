// Residence life: housing applications, room assignment, contracts, move-in/out and maintenance (role register:
// Residence Life Staff, Resident Assistant). Pure; mirrors lib/hsgMigration.ts and is unit-tested in tests/housing.test.ts.
// Rules: one live application per student per term; a room never holds more residents than its capacity; an offer stands only
// once the student accepts the exact contract terms shown (hash-pinned); staff never act on their own application; every
// staff step carries a reason; resident assistants see maintenance for their own building only and never see applications.
export type AppState = 'submitted' | 'offered' | 'accepted' | 'moved_in' | 'moved_out' | 'declined' | 'withdrawn' | 'cancelled';
export type AppStep = 'offer' | 'accept' | 'decline' | 'withdraw' | 'cancel' | 'move_in' | 'move_out';
export type Actor = 'student' | 'staff';
export const LIVE: AppState[] = ['submitted', 'offered', 'accepted', 'moved_in'];
export const HOLDS_BED: AppState[] = ['offered', 'accepted', 'moved_in'];

const MOVES: Record<AppStep, { who: Actor; from: AppState[]; to: AppState }> = {
  offer: { who: 'staff', from: ['submitted', 'declined'], to: 'offered' },
  accept: { who: 'student', from: ['offered'], to: 'accepted' },
  decline: { who: 'student', from: ['offered'], to: 'declined' },
  withdraw: { who: 'student', from: ['submitted', 'offered', 'accepted'], to: 'withdrawn' },
  cancel: { who: 'staff', from: ['submitted', 'offered', 'accepted'], to: 'cancelled' },
  move_in: { who: 'staff', from: ['accepted'], to: 'moved_in' },
  move_out: { who: 'staff', from: ['moved_in'], to: 'moved_out' },
};

/** The next state, or null when this actor may not take this step from this state. */
export function next(state: AppState, step: AppStep, actor: Actor): AppState | null {
  const m = MOVES[step];
  return m && m.who === actor && m.from.includes(state) ? m.to : null;
}

/** Steps open to this actor (the UI's buttons; the database decides). */
export const openSteps = (state: AppState, actor: Actor) => (Object.keys(MOVES) as AppStep[]).filter((s) => next(state, s, actor));

/** Staff steps need a reason; condition notes are the reason for move-in/out. */
export const needsReason = (step: AppStep) => ['cancel', 'move_in', 'move_out', 'offer'].includes(step);

/** Beds left in a room given the states of applications pointing at it. */
export function bedsLeft(capacity: number, occupantStates: AppState[]) {
  return capacity - occupantStates.filter((s) => HOLDS_BED.includes(s)).length;
}

/** Refusal text for an offer, or null. `self` = the staff member is the applicant. */
export function offerBlocker(p: { self: boolean; capacity: number; occupantStates: AppState[]; roomActive: boolean; termsLength: number }) {
  if (p.self) return 'Ask another housing staff member to act on your own application.';
  if (!p.roomActive) return 'That room is not available for assignment.';
  if (bedsLeft(p.capacity, p.occupantStates) <= 0) return 'That room is full.';
  if (p.termsLength < 40) return 'Write the contract terms the student will accept (40+ characters).';
  return null;
}

/** Contract acceptance must name the exact terms the student saw. */
export const acceptBlocker = (shownHash: string, storedHash: string) => (shownHash === storedHash ? null : 'The contract changed since you opened it. Reload and read it again.');

export type MaintState = 'open' | 'in_progress' | 'resolved' | 'closed';
export type MaintStep = 'start' | 'resolve' | 'reopen' | 'close';
const MAINT: Record<MaintStep, { who: 'reporter' | 'staff' | 'either'; from: MaintState[]; to: MaintState }> = {
  start: { who: 'staff', from: ['open'], to: 'in_progress' },
  resolve: { who: 'staff', from: ['open', 'in_progress'], to: 'resolved' },
  reopen: { who: 'reporter', from: ['resolved'], to: 'open' },
  close: { who: 'either', from: ['resolved'], to: 'closed' },
};
export function nextMaint(state: MaintState, step: MaintStep, actor: 'reporter' | 'staff'): MaintState | null {
  const m = MAINT[step];
  return m && (m.who === 'either' || m.who === actor) && m.from.includes(state) ? m.to : null;
}

/** A resident assistant sees maintenance only in their own building; housing staff see all. */
export function canSeeMaint(p: { kind: 'staff' | 'ra' | null; myBuilding: string | null; ticketBuilding: string; isReporter: boolean }) {
  if (p.isReporter || p.kind === 'staff') return true;
  return p.kind === 'ra' && !!p.myBuilding && p.myBuilding === p.ticketBuilding;
}
