/**
 * How the app is set up, and what you have ticked.
 *
 * The look is read back through `readLook` on the way in, so an id the app
 * does not know cannot be stored and the fallback happens once here rather than
 * on every render. `toggleDone` records when as well as whether — the weekly
 * report cannot otherwise tell an early finish from a late one.
 *
 * Returns null for an action that is not this slice's, so `reducer` can try
 * the next one. See `state/reducer.ts`.
 */

import { readLook } from '../../lib/look';
import { currentLook, type Action, type State } from '../shape';

export function settings(state: State, action: Action): State | null {
  switch (action.type) {
    case 'setNav':
      return { ...state, nav: action.nav };

    case 'setLook':
      // Read back through readLook so an id the app does not know cannot be
      // stored — the fallback happens once, here, rather than on every render.
      return { ...state, ...readLook({ ...currentLook(state), ...action.look }) };

    case 'setGrade':
      return { ...state, grades: { ...state.grades, [action.key]: action.value } };

    case 'setFeedOrder':
      return { ...state, feedOrder: action.order };

    case 'toggleFeedSection':
      return {
        ...state,
        feedHidden: { ...state.feedHidden, [action.id]: !state.feedHidden[action.id] },
      };

    case 'toggleDone': {
      const nowDone = !state.done[action.id];
      // When, as well as whether. Without this the weekly report can only
      // attribute a deadline to the week it was due in, which is wrong for
      // anything finished early or late — and it is the one figure in that
      // report better arithmetic could not have fixed.
      const tickedAt = { ...state.tickedAt };
      if (nowDone) tickedAt[action.id] = Date.now();
      else delete tickedAt[action.id];
      return { ...state, done: { ...state.done, [action.id]: nowDone }, tickedAt };
    }

    case 'toggleSaved':
      return { ...state, saved: { ...state.saved, [action.id]: !state.saved[action.id] } };

    case 'toggleNotif':
      return { ...state, notifs: { ...state.notifs, [action.k]: !state.notifs[action.k] } };

    case 'togglePick':
      return { ...state, picked: { ...state.picked, [action.id]: !state.picked[action.id] } };

    case 'clearNotifs':
      return { ...state, cleared: true };

    default:
      return null;
  }
}
