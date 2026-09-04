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
import { readSettings as readGeocode } from '../../lib/geocode';
import { toggle as toggleStarted } from '../../lib/underway';

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

    case 'addSchool': {
      const rest = state.mySchools.filter((s) => s.id !== action.school.id);
      return { ...state, mySchools: [...rest, action.school], schoolId: action.school.id };
    }

    case 'forgetSchool': {
      const mySchools = state.mySchools.filter((s) => s.id !== action.id);
      // Selecting a school that no longer exists would resolve to nothing and
      // silently hide screens, so the selection falls back with it.
      const schoolId = state.schoolId === action.id ? '' : state.schoolId;
      return { ...state, mySchools, schoolId };
    }

    case 'setCutoffs': {
      const next = { ...state.gradeSystems };
      if (action.system) next[action.courseId] = action.system;
      else delete next[action.courseId];
      return { ...state, gradeSystems: next };
    }

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

    case 'setDayBudget':
      return { ...state, dayBudget: Math.max(1, Math.min(16, Math.round(action.hours * 2) / 2)) };

    // Address lookup. Read back through `readSettings` on the way in so the
    // rule that reverse cannot be on while the whole thing is off is enforced
    // in one place rather than trusted to every caller.
    case 'setGeocode':
      return { ...state, geocode: readGeocode({ ...state.geocode, ...action.patch }) };

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

    /*
     * Marking something as started, or unmarking it.
     *
     * Not folded into `toggleDone` as a three-position enum: started and
     * finished are independent facts, and collapsing them means un-ticking a
     * finished thing loses that it was ever begun. The mark is a moment rather
     * than a boolean so the list can say how long it has been open, which is
     * the part that is actually useful. See `lib/underway.ts`.
     */
    /*
     * Which university. An id, never a name.
     *
     * Changing it changes which screens exist — a school with no meal plan
     * has no meal plan screen. It does not touch a single row of anybody's
     * coursework, which is the point of gating on capabilities rather than
     * forking the app per school.
     */
    /*
     * The only path in the app that deliberately drops local coursework.
     *
     * Reached from one button, on a dialogue that states what it replaces and
     * saves a backup file first. Settings survive: somebody choosing their
     * account's semester has not asked to have their accent colour changed.
     */
    case 'wipeLocalForAdopt':
      return {
        ...state,
        courses: [],
        notes: [],
        tasks: [],
        appointments: [],
        sittings: [],
        done: {},
        tickedAt: {},
        started: {},
        reviews: {},
      };

    /*
     * Show the whole directory, or reveal it as the semester fills in.
     *
     * One tap, permanent, and it only ever adds. Nothing is un-revealed by
     * switching it back off — `visited` sees to that.
     */
    case 'showEverything':
      return state.showAll === action.on ? state : { ...state, showAll: action.on };

    case 'setSchool':
      return state.schoolId === action.id ? state : { ...state, schoolId: action.id };

    case 'toggleStarted':
      return { ...state, started: toggleStarted(action.id, state.started, Date.now()) };

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
        action.guess,
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
