/**
 * The break reminder in Focused mode — when to suggest one, and nothing else.
 *
 * The brief asks for "an accessible pause/break reminder" in focus mode. The
 * rules are the whole of it and they are small, so they live here as plain
 * functions of a start time and the clock, which the Focus bar feeds and a
 * test can drive minute by minute.
 *
 *   - Every fifty minutes of focus, suggest a five-minute break. Fifty and
 *     ten is the common study rhythm; five is the shortest break worth the
 *     name and the one a student will actually take.
 *   - "Not now" snoozes it for ten minutes rather than an hour: someone
 *     finishing a paragraph wants a moment, not to be let off.
 *   - Time away counts. A tab hidden for at least the break's length was a
 *     break, whether or not the reminder asked for it, so the count starts
 *     again when the student comes back.
 *   - It can be switched off for the rest of the session, and it never
 *     appears outside Focused.
 *
 * Suggestion, not enforcement: nothing here locks, dims or times out the
 * work, and nothing is scored. It is one line in the Focus bar.
 */

export const FOCUS_MINUTES = 50;
export const BREAK_MINUTES = 5;
export const SNOOZE_MINUTES = 10;

const MIN = 60_000;

export interface BreakClock {
  /** When the current stretch of focus began, in ms. */
  since: number;
  /** A "Not now" pushes the next reminder to here. 0 when none. */
  snoozedUntil: number;
  /** Switched off for the rest of this focus session. */
  off: boolean;
}

export function startClock(now: number): BreakClock {
  return { since: now, snoozedUntil: 0, off: false };
}

/** Whole minutes of focus so far in this stretch. */
export function focusedFor(clock: BreakClock, now: number): number {
  return Math.max(0, Math.floor((now - clock.since) / MIN));
}

/** Whether to show the reminder now. */
export function breakDue(clock: BreakClock, now: number): boolean {
  if (clock.off) return false;
  if (now < clock.snoozedUntil) return false;
  return focusedFor(clock, now) >= FOCUS_MINUTES;
}

/** Taking the break: the next stretch starts when the break ends. */
export function takeBreak(clock: BreakClock, now: number): BreakClock {
  return { ...clock, since: now + BREAK_MINUTES * MIN, snoozedUntil: 0 };
}

export function snooze(clock: BreakClock, now: number): BreakClock {
  return { ...clock, snoozedUntil: now + SNOOZE_MINUTES * MIN };
}

export function switchOff(clock: BreakClock): BreakClock {
  return { ...clock, off: true };
}

/**
 * Coming back to the tab. Away for at least a break's length was a break:
 * the stretch starts again from now. A shorter absence changes nothing.
 */
export function cameBack(clock: BreakClock, hiddenAt: number, now: number): BreakClock {
  return now - hiddenAt >= BREAK_MINUTES * MIN ? { ...clock, since: now, snoozedUntil: 0 } : clock;
}
