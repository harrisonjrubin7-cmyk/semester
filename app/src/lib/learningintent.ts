/**
 * "Take me to the feedback inbox, for this assignment."
 *
 * The assignment planner and the Learning panels are different screens, and the
 * Learning row is closed and loads its panels on first open. So a link from one
 * to the other has to carry where it is going and what it is about — the
 * assignment's title and course — across a navigation and a lazy load, without a
 * route for every panel.
 *
 * It is one pending request, in memory only: nothing is written to storage and
 * nothing survives a reload. Reading it is pure (`peek`), because React may
 * call an initializer twice; it is cleared by an effect (`clear`) once the
 * panel has used it. It expires after a minute so a request that nobody
 * collected cannot open the row by surprise later.
 */

export interface Intent {
  panel: 'feedback';
  /** The piece of work, in the student's words. */
  work: string;
  /** The course's code, as the assignment carries it. */
  courseCode: string;
  at: number;
}

export const FRESH_MS = 60_000;

let pending: Intent | null = null;

export function askToOpen(intent: Omit<Intent, 'at'>, now = Date.now()): void {
  pending = { ...intent, at: now };
}

/** The request for this panel, if there is a fresh one. Does not consume it. */
export function peek(panel: Intent['panel'], now = Date.now()): Intent | null {
  return pending && pending.panel === panel && now - pending.at <= FRESH_MS ? pending : null;
}

export function clear(): void {
  pending = null;
}
