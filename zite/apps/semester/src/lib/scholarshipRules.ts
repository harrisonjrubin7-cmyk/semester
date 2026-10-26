// Scholarships (role register: Scholarship Provider; institution side: financial-aid scholarship office). Pure; mirrors
// lib/schMigration.ts and is unit-tested in tests/scholarship.test.ts.
// Rules: an external sponsor offers programs at an institution only after that institution's scholarship office verifies the
// sponsor there (the office never verifies a sponsor it owns); students apply with explicit consent naming the sponsor and
// what is shared (their name, email and statement — never institutional records); awards never exceed the program's number;
// a student accepts or declines an award; the office records a disbursement hand-off, which moves no money; renewals are
// requested by the student, decided by the sponsor and handed off again. Nobody acts on their own application.
export type LinkState = 'requested' | 'verified' | 'rejected' | 'suspended';
export type AppState = 'submitted' | 'shortlisted' | 'awarded' | 'not_selected' | 'withdrawn' | 'accepted' | 'declined_award' | 'handed_off';
export type AppStep = 'shortlist' | 'award' | 'not_select' | 'withdraw' | 'accept' | 'decline_award' | 'handoff';
export type Actor = 'student' | 'sponsor' | 'office';

const MOVES: Record<AppStep, { who: Actor; from: AppState[]; to: AppState }> = {
  shortlist: { who: 'sponsor', from: ['submitted'], to: 'shortlisted' },
  award: { who: 'sponsor', from: ['submitted', 'shortlisted'], to: 'awarded' },
  not_select: { who: 'sponsor', from: ['submitted', 'shortlisted'], to: 'not_selected' },
  withdraw: { who: 'student', from: ['submitted', 'shortlisted'], to: 'withdrawn' },
  accept: { who: 'student', from: ['awarded'], to: 'accepted' },
  decline_award: { who: 'student', from: ['awarded'], to: 'declined_award' },
  handoff: { who: 'office', from: ['accepted'], to: 'handed_off' },
};
export function next(state: AppState, step: AppStep, actor: Actor): AppState | null {
  const m = MOVES[step];
  return m && m.who === actor && m.from.includes(state) ? m.to : null;
}
export const openSteps = (state: AppState, actor: Actor) => (Object.keys(MOVES) as AppStep[]).filter((s) => next(state, s, actor));
/** Awards that count against the program's number. */
export const HOLDS_AWARD: AppState[] = ['awarded', 'accepted', 'handed_off'];
export const awardsLeft = (awards: number, states: AppState[]) => awards - states.filter((s) => HOLDS_AWARD.includes(s)).length;

export function linkNext(state: LinkState, decision: 'verify' | 'reject' | 'suspend'): LinkState | null {
  if (decision === 'verify' && ['requested', 'rejected', 'suspended'].includes(state)) return 'verified';
  if (decision === 'reject' && state === 'requested') return 'rejected';
  if (decision === 'suspend' && state === 'verified') return 'suspended';
  return null;
}

/** The consent sentence a student agrees to; its hash is stored with the application. */
export const consentText = (sponsor: string, program: string) =>
  `I agree to share my name, my email address and this statement with ${sponsor} for the scholarship "${program}". No grades or other institutional records are shared.`;

export function applyBlocker(p: { linkVerified: boolean; programOpen: boolean; pastDeadline: boolean; studentIsSponsor: boolean; statementLength: number; consented: boolean }) {
  if (!p.linkVerified || !p.programOpen) return 'This scholarship is not open.';
  if (p.pastDeadline) return 'The deadline for this scholarship has passed.';
  if (p.studentIsSponsor) return 'You cannot apply to your own scholarship.';
  if (p.statementLength < 50) return 'Write a statement (50+ characters).';
  if (!p.consented) return 'Agree to what is shared with the sponsor.';
  return null;
}
