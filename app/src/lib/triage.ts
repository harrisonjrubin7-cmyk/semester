/**
 * Assignment triage: what to do next, never how a student is doing.
 *
 * Seven states, each with the sentence a student reads. The state is derived
 * from what the student and their sources have actually said (a due date, an
 * effort estimate, a saved work block, a dependency), so it can always be
 * explained in plain words.
 *
 * `orderQueue` orders assignments with a private weighting of deadline proximity,
 * effort against time, what it blocks, source confidence, the student's own
 * priority, work already scheduled, and a fatigue setting. The weighting is
 * deliberately not exported and the result is an order, not a number: a score
 * on screen would read as a verdict. (`actions.ts` ranks Today's action
 * cards and shows its parts; this is for the assignment list and does not
 * replace it.)
 */

import { formatDateTime } from './locale';
import type { SourceLabel } from './source';

export const STATES = [
  'ready',
  'needs_time',
  'needs_review',
  'waiting',
  'blocked',
  'complete',
  'deferred',
] as const;
export type State = (typeof STATES)[number];

export const STATE_TEXT: Record<State, string> = {
  ready: 'You have enough time to begin this.',
  needs_time: 'This needs a place in your week.',
  needs_review: 'Confirm the details before planning.',
  waiting: 'Waiting on information before the next step.',
  blocked: 'Something is blocking this; here are options.',
  complete: 'Completed.',
  deferred: 'Deferred.',
};

export interface Assignment {
  id: string;
  course: string;
  title: string;
  /** Epoch ms, or null if unknown. */
  due: number | null;
  label: SourceLabel;
  /** When the source was last read. */
  sourceAt?: number | null;
  /** The student's own estimate, in minutes. */
  effortMin?: number | null;
  /** Minutes the student has saved for it before the due date. */
  blockMin?: number;
  /** Minutes free before the due date, if the calendar is connected. */
  freeMin?: number | null;
  done?: boolean;
  deferredUntil?: number | null;
  /** Something outside the student's hands: a source, a collaborator, an instructor. */
  waitingOn?: string;
  /** A known conflict, e.g. a prerequisite not done. */
  blockedBy?: string;
  /** The student's own priority, 0–2. */
  priority?: 0 | 1 | 2;
  /** How many other items wait on this one. */
  unlocks?: number;
}

export interface Triaged {
  state: State;
  /** Student-facing reasons, in the order they were found. */
  reasons: string[];
  /** Said outright, so the card never implies more certainty than there is. */
  unknowns: string[];
}

/** A source not read for this long is worth a second look before planning on it. */
export const STALE_DAYS = 14;
const DAY = 86_400_000;

const clock = (t: number) => formatDateTime(t, { weekday: 'short', hour: 'numeric', minute: '2-digit' });

export function stateOf(a: Assignment, now = Date.now()): Triaged {
  const reasons: string[] = [];
  const unknowns: string[] = [];
  const done = (state: State): Triaged => ({ state, reasons, unknowns });

  if (a.done) return done('complete');

  if (a.deferredUntil && a.deferredUntil > now) {
    reasons.push(`Deferred until ${clock(a.deferredUntil)}.`);
    return done('deferred');
  }
  if (a.blockedBy) {
    reasons.push(`Blocked by ${a.blockedBy}.`);
    return done('blocked');
  }
  if (a.waitingOn) {
    reasons.push(`Waiting on ${a.waitingOn}.`);
    return done('waiting');
  }

  const stale = typeof a.sourceAt === 'number' && now - a.sourceAt > STALE_DAYS * DAY;
  if (a.due === null) reasons.push('No due date is saved.');
  if (a.label === 'needs_review' || a.label === 'estimated') reasons.push('The due date has not been confirmed.');
  if (stale) reasons.push('The source was last read more than two weeks ago.');
  if (reasons.length) return done('needs_review');

  reasons.push(`Due ${clock(a.due as number)}.`);
  const effort = a.effortMin ?? null;
  if (effort === null) unknowns.push('How long this will take is not estimated.');
  unknowns.push('Whether the instructor will change the deadline.');

  const need = Math.max(0, (effort ?? 0) - (a.blockMin ?? 0));
  if (effort !== null) reasons.push(`You estimate ${effort} minutes of work.`);
  if ((a.blockMin ?? 0) > 0) reasons.push(`${a.blockMin} minutes are saved for it.`);
  else reasons.push('No work time is currently saved.');

  if (a.freeMin != null && effort !== null && a.freeMin < need) {
    reasons.push('There is not enough open time before it is due.');
    return done('needs_time');
  }
  return done('ready');
}

/** Private weights. Not exported: see the module comment. */
function weight(a: Assignment, now: number, fatigue: number): number {
  const days = a.due === null ? 30 : Math.max(0, (a.due - now) / DAY);
  const D = 10 / (1 + days);
  const free = a.freeMin ?? null;
  const E = a.effortMin && free !== null ? Math.min(3, a.effortMin / Math.max(30, free)) : 0;
  const B = Math.min(3, (a.unlocks ?? 0));
  const C = a.label === 'institution_verified' ? 1 : a.label === 'needs_review' ? -1 : 0;
  const G = (a.priority ?? 0) * 1.5;
  const W = a.effortMin && a.blockMin ? Math.min(3, (a.blockMin / a.effortMin) * 3) : 0;
  return D + E + B + C + G - W - fatigue;
}

/**
 * Open assignments in the order to offer them, most useful first. Only
 * states a student can act on are queued; waiting, blocked, complete and
 * deferred work is left out rather than sorted to the bottom.
 */
export function orderQueue(list: Assignment[], now = Date.now(), fatigue = 0): Assignment[] {
  const open: State[] = ['ready', 'needs_time', 'needs_review'];
  return list
    .filter((a) => open.includes(stateOf(a, now).state))
    .map((a) => [a, weight(a, now, fatigue)] as const)
    .sort((x, y) => y[1] - x[1])
    .map(([a]) => a);
}
