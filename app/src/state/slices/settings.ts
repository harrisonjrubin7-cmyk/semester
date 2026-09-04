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
import { record } from '../../lib/pace';
import { currentLook, type Action, type State } from '../shape';
import { readTabs } from '../../lib/tabbar';
import { readRules } from '../../lib/myrules';
import { mark as markAttendance, readPolicy } from '../../lib/attend';
import { readDrop } from '../../lib/drop';

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

    // The arithmetic — what is allowed in, how many fit, what cannot be
    // removed — is in `lib/tabbar.ts` and tested there. The caller passes the
    // list it worked out; this re-reads it anyway, because the reducer is
    // the last place that can stop a bar with nothing in it being stored.
    case 'setTabs':
      return { ...state, tabs: readTabs(action.tabs) };

    // Both computed by `lib/yours.ts` and stored as given: unlike the tab
    // bar, a wrong value here costs a wrong colour, not a phone with no
    // navigation, and `arrange` already tolerates an order naming courses
    // that are gone.
    case 'setMyRules':
      return { ...state, myRules: readRules(action.rules) };

    case 'setMyName':
      // Trimmed and capped here rather than in the field, so a name pasted in
      // from somewhere else cannot arrive as a paragraph.
      return { ...state, myName: action.name.trim().slice(0, 40) };

    // Attendance is the one record here the app must never write on its own —
    // no inference from a phone that did not move, no default once a class
    // has ended. See `lib/attend.ts`.
    case 'markAttendance':
      return {
        ...state,
        attendance: markAttendance(state.attendance, action.courseId, action.date, action.mark),
      };

    case 'setAttendPolicy':
      return {
        ...state,
        attendPolicy: { ...state.attendPolicy, [action.courseId]: readPolicy(action.policy) },
      };

    case 'setPieces':
      return { ...state, pieces: { ...state.pieces, [action.key]: action.text } };

    case 'setDrop':
      return { ...state, drops: { ...state.drops, [action.key]: readDrop(action.drop) } };

    case 'setYours':
      return { ...state, yours: action.yours };

    case 'setCourseOrder':
      return { ...state, courseOrder: action.order };

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

    // How long a finished thing took. Recorded once per item — a second
    // report for the same id replaces the first rather than counting twice,
    // so tapping the wrong bucket is a fixable mistake.
    case 'timeSpent': {
      const row = record(
        action.id,
        action.courseId,
        action.kind,
        action.minutes ?? action.bucketId ?? '',
        Date.now(),
      );
      if (!row) return state;
      return { ...state, spent: [...state.spent.filter((s) => s.id !== action.id), row] };
    }

    case 'setAccessLead':
      return { ...state, accessLeadDays: Math.max(0, Math.min(30, Math.round(action.days))) };

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
