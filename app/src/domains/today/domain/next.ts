/**
 * The thing Today says to do next, in the words Today needs.
 *
 * Today does not rank anything itself. What to put first is a judgement the
 * app has been refining — urgency, impact, how confident the source is, how
 * often it was snoozed — and it lives in `lib/actions.ts`. This is the shape
 * Today asks for it in, so that Today's tests, and the screen that will draw
 * it, never have to know what an `Action` looked like.
 */
export interface NextAction {
  readonly id: string;
  readonly title: string;
  /** Why it is here, in a sentence the student can read. */
  readonly why: string;
  readonly priority: 'critical' | 'high' | 'normal' | 'low';
  /** Epoch milliseconds, or `null` when it has no date. */
  readonly dueAt: number | null;
}

/** One most important, then the few that follow. Everything else is one tap away, not here. */
export interface Ranking {
  readonly mostImportant: NextAction | null;
  readonly next: readonly NextAction[];
}

/** Nothing to do, nothing on, nothing late: the day the screen should say is clear, rather than draw four empty headings. */
export const isQuiet = (parts: { schedule: readonly unknown[]; overdue: readonly unknown[]; dueToday: readonly unknown[]; ranking: Ranking }): boolean =>
  parts.schedule.length === 0 && parts.overdue.length === 0 && parts.dueToday.length === 0 && parts.ranking.mostImportant === null;
