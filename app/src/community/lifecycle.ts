/**
 * Who may move a student organization between its recognition states, and
 * what every move must record.
 *
 * The states and the legal moves are `ORGANIZATION_RECOGNITION` in
 * `packages/institution/src/workflow.ts`, where every consequential machine
 * lives (ADR-0009). That machine knows nothing about people. This file adds
 * the two things the blueprints require of each transition and the machine
 * cannot express: which seat may make it, and the record it leaves —
 * approver, reason, effective date, required follow-up, a status the
 * organization's members can read, and an audit event with a correction
 * route. `recordTransition` refuses a move without all of them, so a screen
 * cannot offer a button the record would not survive.
 *
 * The `organizations` table has no status column today; this is the rule
 * the column will be held to. `lifecycle.test.ts` walks every pair.
 */
import {
  ORGANIZATION_RECOGNITION,
  transition,
  type OrganizationRecognitionState,
} from '../../../packages/institution/src/workflow';

export type State = OrganizationRecognitionState;

/** The seats the blueprints name around an organization. */
export const SEATS = ['officer', 'president', 'advisor', 'campus_administrator'] as const;
export type Seat = (typeof SEATS)[number];

type Move = `${State}->${State}`;

/**
 * Which seats may make which move. Recognition, conditions and archiving are
 * the institution's; submitting, withdrawing and dissolving are the
 * organization's, through its president; an advisor may return a draft but
 * decides nothing else. A move absent here is legal in the machine and
 * allowed to nobody, which is a bug this file wants found.
 */
export const WHO_MAY: Readonly<Partial<Record<Move, readonly Seat[]>>> = {
  'draft->submitted': ['president'],
  'draft->archived': ['president', 'campus_administrator'],
  'submitted->under_review': ['campus_administrator'],
  'submitted->draft': ['president', 'campus_administrator'],
  'under_review->active': ['campus_administrator'],
  'under_review->active_with_conditions': ['campus_administrator'],
  'under_review->draft': ['campus_administrator', 'advisor'],
  'active->active_with_conditions': ['campus_administrator'],
  'active->inactive': ['campus_administrator'],
  'active->archived': ['campus_administrator'],
  'active->dissolved': ['president', 'campus_administrator'],
  'active_with_conditions->active': ['campus_administrator'],
  'active_with_conditions->inactive': ['campus_administrator'],
  'active_with_conditions->archived': ['campus_administrator'],
  'active_with_conditions->dissolved': ['president', 'campus_administrator'],
  'inactive->active': ['campus_administrator'],
  'inactive->archived': ['campus_administrator'],
  'inactive->dissolved': ['president', 'campus_administrator'],
  'archived->active': ['campus_administrator'],
  'archived->dissolved': ['campus_administrator'],
};

/** Moves that need a written follow-up as well as a reason. */
export const NEEDS_FOLLOW_UP: readonly Move[] = ['under_review->active_with_conditions', 'active->active_with_conditions', 'under_review->draft', 'submitted->draft'];

/** What members read on the organization's page in each state. Words, never a colour alone. */
export const STUDENT_VISIBLE: Record<State, string> = {
  draft: 'Being set up. Not yet submitted for recognition.',
  submitted: 'Submitted for recognition. Waiting for the institution to begin its review.',
  under_review: 'Under review by the institution.',
  active: 'Recognized and active.',
  active_with_conditions: 'Recognized, with conditions the officers are working through.',
  inactive: 'Inactive this term. It can be renewed.',
  archived: 'Archived. Its records are kept; it can be re-recognized.',
  dissolved: 'Dissolved. This organization no longer exists.',
};

export interface TransitionRequest {
  organization: string;
  from: State;
  to: State;
  actor: { id: string; seat: Seat };
  reason: string;
  /** ISO date the change takes effect. May be later than today; never earlier. */
  effectiveDate: string;
  today: string;
  followUp?: string;
}

export interface TransitionRecord {
  organization: string;
  from: State;
  to: State;
  approver: { id: string; seat: Seat };
  reason: string;
  effectiveDate: string;
  followUp: string | null;
  studentVisible: string;
  /** Where a member or officer who thinks this is wrong goes. Always the same route. */
  appealRoute: string;
  audit: { event: 'organization_recognition_changed'; at: string; from: State; to: State; actorId: string; seat: Seat; exceptional: boolean };
}

export type Verdict = { ok: true; record: TransitionRecord } | { ok: false; reason: string };

export const APPEAL_ROUTE = 'Ask the institution\'s recognition office for a review; the record and the reason are shown to it as they are shown here.';

const MIN_REASON = 12;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function recordTransition(r: TransitionRequest): Verdict {
  const legal = transition(ORGANIZATION_RECOGNITION, r.from, r.to);
  if (!legal.ok) return legal;
  const move = `${r.from}->${r.to}` as Move;
  const seats = WHO_MAY[move] ?? [];
  if (!seats.includes(r.actor.seat)) return { ok: false, reason: `a ${r.actor.seat.replace('_', ' ')} cannot move an organization from ${r.from} to ${r.to}` };
  if (r.reason.trim().length < MIN_REASON) return { ok: false, reason: 'a reason is required, written for the people it affects' };
  if (!ISO.test(r.effectiveDate) || !ISO.test(r.today)) return { ok: false, reason: 'dates are ISO calendar dates' };
  if (r.effectiveDate < r.today) return { ok: false, reason: 'a change cannot take effect in the past' };
  if (NEEDS_FOLLOW_UP.includes(move) && !(r.followUp?.trim())) return { ok: false, reason: 'this move names what the organization must do next' };
  return {
    ok: true,
    record: {
      organization: r.organization,
      from: r.from,
      to: r.to,
      approver: r.actor,
      reason: r.reason.trim(),
      effectiveDate: r.effectiveDate,
      followUp: r.followUp?.trim() || null,
      studentVisible: STUDENT_VISIBLE[r.to],
      appealRoute: APPEAL_ROUTE,
      audit: { event: 'organization_recognition_changed', at: r.today, from: r.from, to: r.to, actorId: r.actor.id, seat: r.actor.seat, exceptional: legal.exceptional },
    },
  };
}

/**
 * The end-of-term officer transition, as the checklist the blueprints give.
 * Order matters: access is not rotated before the incoming officers are
 * confirmed, and recognition is not renewed before the documents are safe.
 */
export const OFFICER_TRANSITION = [
  { id: 'confirm', step: 'Confirm the incoming officers' },
  { id: 'transfer', step: 'Transfer approved workspace ownership' },
  { id: 'rotate', step: 'Rotate access: remove outgoing officers\' capabilities' },
  { id: 'preserve', step: 'Preserve essential documents' },
  { id: 'archive', step: 'Archive old chats and files by policy' },
  { id: 'advisor', step: 'Update the advisor' },
  { id: 'renew', step: 'Renew recognition requirements' },
  { id: 'training', step: 'Complete required training' },
  { id: 'commitments', step: 'Review upcoming commitments' },
] as const;

export type TransitionStep = (typeof OFFICER_TRANSITION)[number]['id'];

/** The next step to do, given what is done; `null` when the handoff is complete. */
export function nextTransitionStep(done: readonly TransitionStep[]): TransitionStep | null {
  return OFFICER_TRANSITION.find((s) => !done.includes(s.id))?.id ?? null;
}

/** Access may rotate only once the incoming officers are confirmed and ownership has moved. */
export function mayRotateAccess(done: readonly TransitionStep[]): boolean {
  return done.includes('confirm') && done.includes('transfer');
}
