import { useMemo } from 'react';
import { todayFromLegacy } from '../domains/composition';
import { factsOfView, type TodayView } from '../domains/today';
import type { FeatureState } from '../intelligence/contracts';
import { EXPERIENCE_FLAGS } from '../lib/experience-flags';
import { READ_ONLY } from '../lib/readonly';
import { datedItems } from '../lib/select';
import type { DatedItem } from '../lib/types';
import { storeClock } from './domains';
import { useNow, useStore } from './store';

/**
 * Step 4: the screen reads the domain's Today.
 *
 * At `domainToday=production` the domain, not the selector, decides **which
 * deadlines are due today and in what order**. The legacy `DatedItem` is still
 * what gets drawn, because it carries the course, the quote, the page and the
 * rest of what a row shows; the domain holds ids, so the screen looks each one
 * up. That split is the strangler: the rule has moved, the rendering has not.
 *
 * Only one list is cut over, and it is the one the shadow showed to be the same
 * question. The others are not, and moving them as if they were would change
 * the screen:
 *
 * - "Yours today" lists tasks **including finished ones** (struck through); the
 *   domain's `dueToday` is open tasks only.
 * - The all-clear line names what is next, from `upcomingItems`, which has no
 *   horizon; the domain's `comingUp` stops at fourteen days.
 *
 * Both want a decision first (does the domain grow a "done today" and drop the
 * horizon, or does the screen change), so they stay on the legacy selectors.
 */

/** Whether the screen takes its Today from the domain. `preview` and `sandbox` only shadow it. */
export const cutOver = (flag: FeatureState): boolean => flag === 'production';

/**
 * The domain's Today for this render, or null when the flag is not at
 * `production` or the domain declines.
 *
 * The domain declines Today for any role but a student (`policy`), and the
 * legacy screen is drawn for all of them. Null sends those people down the
 * legacy path, so the cutover changes nothing for a role the domain does not
 * serve. Whether that stays so is a step-4 decision recorded in the plan.
 */
export function useTodayView(flag: FeatureState = EXPERIENCE_FLAGS.domainToday): TodayView | null {
  const { state, catalog, account } = useStore();
  const now = useNow();
  const on = cutOver(flag);
  return useMemo(() => {
    if (!on) return null;
    const result = todayFromLegacy(
      {
        person: { accountId: account?.id ?? null, role: state.role, schoolId: state.schoolId },
        readOnly: READ_ONLY,
        tasks: state.tasks,
        appointments: state.appointments,
        deadlines: datedItems(catalog, now),
      },
      storeClock(() => now),
    );
    return result.ok ? result.value : null;
  }, [on, account?.id, state.role, state.schoolId, state.tasks, state.appointments, catalog, now]);
}

/**
 * The deadlines due today, in the domain's order when there is a domain view.
 *
 * `legacy` is what the selector found; it is the lookup for what to draw and the
 * answer when there is no view. If the domain names an id the screen has nothing
 * to draw for, the whole list falls back rather than dropping a deadline silently.
 */
export function deadlinesToday(view: TodayView | null, legacy: DatedItem[]): DatedItem[] {
  if (!view) return legacy;
  const byId = new Map(legacy.map((item) => [item.id, item]));
  const picked = factsOfView(view).deadlinesToday.map((id) => byId.get(id));
  return picked.every((item): item is DatedItem => item !== undefined) ? picked : legacy;
}
