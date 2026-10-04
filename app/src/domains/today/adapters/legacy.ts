import { rank, type Choice } from '../../../lib/actions';
import { todayActions, type TodayActionInput } from '../../../lib/today-actions';
import type { NextAction, Ranking } from '../domain/next';

/** What the legacy ranking reads: the candidates' inputs, and what the student has snoozed or dismissed. */
export interface LegacyRankingInput {
  readonly input: TodayActionInput;
  readonly choices: Record<string, Choice>;
}

/**
 * Today's ranker, over the legacy one.
 *
 * `todayActions` proposes candidates and `rank` orders them by a scored model
 * the Action Center already uses. Both are borrowed whole: re-deriving the
 * score in the domain would be a second ranking, and two rankings disagree
 * the first week one of them is tuned. What this adds is the translation —
 * an `Action` with its explanation sheet and source record becomes the six
 * fields Today draws.
 */
export function legacyRanking(read: () => LegacyRankingInput): (now: number) => Promise<Ranking> {
  const next = (a: { id: string; title: string; whyItMatters: string; priority: NextAction['priority']; dueAt?: number | null }): NextAction => ({
    id: a.id,
    title: a.title,
    why: a.whyItMatters,
    priority: a.priority,
    dueAt: a.dueAt ?? null,
  });
  return async (now) => {
    const { input, choices } = read();
    const ranked = rank(todayActions(input), choices, now);
    return {
      mostImportant: ranked.mostImportant ? next(ranked.mostImportant.action) : null,
      next: ranked.next.map((s) => next(s.action)),
    };
  };
}
