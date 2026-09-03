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

export function reducer(state: State, action: Action): State {
  for (const slice of SLICES) {
    const next = slice(state, action);
    if (next !== null) return next;
  }
  return state;
}
