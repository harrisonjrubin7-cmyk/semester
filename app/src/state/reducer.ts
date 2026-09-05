/**
 * One reducer, eight slices.
 *
 * This was a single 560-line `switch` inside `store.tsx`, which is a shape
 * that works right up until you want to change something in it. Ninety-four
 * cases in one statement means every reader scrolls past eighty they do not
 * care about, and every addition lands wherever the cursor happened to be —
 * the practice-paper cases ended up between the calendar and the mail draft,
 * which tells you nothing about either.
 *
 * Each slice is a plain function of the same shape, returning `null` for an
 * action that is not its own so the next one gets a turn. Nothing about the
 * store's behaviour changes: the slices are tried in order and the first to
 * claim an action answers it, which is what a single switch did already.
 *
 * The cost of splitting a switch this way is that TypeScript can no longer
 * tell you an action is handled nowhere — a dropped case would quietly return
 * the state unchanged. `reducer.test.ts` closes that hole by reading the
 * `Action` union out of `shape.ts` and the `case` labels out of the slices,
 * and failing when the two sets differ in either direction.
 */

import type { Action, State } from './shape';
import { snapshot, tookSomething, undoableFor } from '../lib/undo';
import { library } from './slices/library';
import { mine } from './slices/mine';
import { navigate } from './slices/navigate';
import { notes } from './slices/notes';
import { papers } from './slices/papers';
import { schedule } from './slices/schedule';
import { settings } from './slices/settings';
import { study } from './slices/study';

/**
 * In order of how often they fire, which is also roughly how much of the app
 * each one covers. The order is not load-bearing — no two slices claim the
 * same action, and the test above says so.
 */
const SLICES = [navigate, study, schedule, mine, notes, papers, library, settings];

/**
 * The slices, plus one thing they do not do.
 *
 * Undo is handled here rather than in a slice because it is a property of
 * *every* destructive action rather than of any one of them, and putting a
 * snapshot line in twenty-two cases is twenty-two places to forget it. See
 * `lib/undo.ts` — the fields an action can damage are named there, and only
 * those are kept, so undoing a deleted note does not also undo the box you
 * ticked in between.
 */
export function reducer(state: State, action: Action): State {
  if (action.type === 'undo') {
    if (!state.undone) return state;
    return { ...state, ...state.undone.was, undone: null };
  }
  if (action.type === 'forgetUndo') {
    return state.undone ? { ...state, undone: null } : state;
  }
  // Also here rather than in a slice, and for the same reason: what gets
  // announced is a property of outcomes across the whole app, not of any one
  // area of it. See `components/Said.tsx`.
  if (action.type === 'say') {
    return { ...state, said: action.said, saidAt: action.at };
  }

  const undoable = undoableFor(action.type);
  const before = undoable ? snapshot(state, undoable, Date.now()) : null;

  for (const slice of SLICES) {
    const next = slice(state, action);
    if (next === null) continue;
    // Only where the action actually took something. A Remove pressed on an id
    // that is already gone should not put a toast up offering to undo nothing.
    return before && tookSomething(before, next) ? { ...next, undone: before } : next;
  }
  return state;
}
