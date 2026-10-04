import { rank, type Choice } from '../../../lib/actions';
import { officeActionToAction, type OfficeAction } from '../../../lib/office-actions';
import type { CatalogCourse } from '../../../lib/registration';
import { registrationActions } from '../../../lib/registration-actions';
import type { RegistrationDayData } from '../../../lib/registration-day';
import { todayActions, type TodayActionInput } from '../../../lib/today-actions';
import type { NextAction, Ranking } from '../domain/next';

/** What the legacy ranking reads: the candidates' inputs, and what the student has snoozed or dismissed. */
export interface LegacyRankingInput {
  readonly input: TodayActionInput;
  readonly choices: Record<string, Choice>;
  /**
   * Registration Day Mode, when it is surfaced. Absent or `active: false`
   * proposes nothing; the mode's own clock rule (`modeActive`) is applied
   * by `registrationActions`, as it is for the Action Center.
   */
  readonly registration?: {
    readonly active: boolean;
    readonly data: RegistrationDayData;
    readonly cart: CatalogCourse[];
    readonly catalog: CatalogCourse[];
  };
  /** The campus office feed, as fetched; `null` while loading, signed out or failed. */
  readonly office?: readonly OfficeAction[] | null;
}

/**
 * Today's ranker, over the legacy one.
 *
 * `todayActions` proposes candidates and `rank` orders them by a scored model
 * the Action Center already uses. Both are borrowed whole: re-deriving the
 * score in the domain would be a second ranking, and two rankings disagree
 * the first week one of them is tuned. The same goes for where the candidates
 * come from: registration readiness and campus office actions are proposed by
 * their own legacy functions, and this only collects them. What this adds is the translation —
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
    const { input, choices, registration, office } = read();
    // Candidates in the Action Center's own order — the ranker sorts by score,
    // due date and title, so order is not what matters, but "the same list" is
    // the claim and is easiest to keep by building it the same way.
    const candidates = [
      ...todayActions(input),
      ...(registration?.active ? registrationActions(registration.data, registration.cart, registration.catalog, new Date(now)) : []),
      ...(office ?? []).filter((a) => a.doneAt === null).map((a) => officeActionToAction(a, now)),
    ];
    const ranked = rank(candidates, choices, now);
    return {
      mostImportant: ranked.mostImportant ? next(ranked.mostImportant.action) : null,
      next: ranked.next.map((s) => next(s.action)),
    };
  };
}
