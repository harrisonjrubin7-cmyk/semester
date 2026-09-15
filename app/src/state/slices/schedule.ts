/**
 * Which day, week or month the calendar is looking at.
 *
 * Nothing here is persisted. Where the calendar is pointing is a question
 * about this session, and a phone that opens on last Tuesday because that is
 * where the laptop was left is a phone that is wrong.
 *
 * Returns null for an action that is not this slice's, so `reducer` can try
 * the next one. See `state/reducer.ts`.
 */

import { dateToIso, isoToDate } from '../../lib/date';
import type { Action, State } from '../shape';

export function schedule(state: State, action: Action): State | null {
  switch (action.type) {
    case 'setCalView':
      return { ...state, calView: action.view };

    case 'setReport':
      return { ...state, report: action.grain };

    case 'setChanges':
      return { ...state, changes: action.source };

    case 'setCalSource':
      return { ...state, calSource: action.source };

    case 'setCalDay':
      return { ...state, calDay: action.date };

    case 'stepDay': {
      const base = state.calDay ? isoToDate(state.calDay) : new Date();
      base.setDate(base.getDate() + action.delta);
      return { ...state, calDay: dateToIso(base) };
    }

    /*
     * The same step, a month at a time, and now on the same field.
     *
     * It used to move `calMonth`/`calYear` and clear `selDate`, because the
     * month view had a position of its own. It has not since M1: the month on
     * screen is the month of `calDay`, so stepping it is stepping the date —
     * which makes this `stepDay`'s sibling rather than a separate mechanism.
     *
     * The day is clamped rather than left to `setMonth`, which overflows: the
     * 31st of January plus one month is the 3rd of March, and a calendar that
     * skips February when you press the arrow is worse than one that lands on
     * the 28th.
     */
    case 'stepMonth': {
      const base = state.calDay ? isoToDate(state.calDay) : new Date();
      const day = base.getDate();
      const target = new Date(base.getFullYear(), base.getMonth() + action.delta, 1);
      const lastOfTarget = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
      target.setDate(Math.min(day, lastOfTarget));
      return { ...state, calDay: dateToIso(target) };
    }

    default:
      return null;
  }
}
