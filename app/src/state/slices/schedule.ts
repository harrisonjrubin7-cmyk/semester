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
    case 'selectDate':
      return { ...state, selDate: action.date };

    case 'stepMonth': {
      const d = new Date(state.calYear, state.calMonth + action.delta, 1);
      return { ...state, calMonth: d.getMonth(), calYear: d.getFullYear(), selDate: null };
    }

    case 'setCalView':
      return { ...state, calView: action.view };

    case 'setCalSource':
      return { ...state, calSource: action.source };

    case 'setCalDay':
      return { ...state, calDay: action.date };

    case 'stepDay': {
      const base = state.calDay ? isoToDate(state.calDay) : new Date();
      base.setDate(base.getDate() + action.delta);
      return { ...state, calDay: dateToIso(base) };
    }

    default:
      return null;
  }
}
