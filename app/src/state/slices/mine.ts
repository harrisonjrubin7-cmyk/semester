/**
 * The things you added yourself.
 *
 * Tasks, appointments, commitments and places. They are kept apart from
 * anything a syllabus produced, because a syllabus can be re-imported and these
 * cannot be got back.
 *
 * Returns null for an action that is not this slice's, so `reducer` can try
 * the next one. See `state/reducer.ts`.
 */

import { newId } from '../../lib/files';
import { tidy } from '../../lib/windows';
import type { Action, State } from '../shape';

export function mine(state: State, action: Action): State | null {
  switch (action.type) {
    case 'addTask':
      return {
        ...state,
        tasks: [
          ...state.tasks,
          { ...action.task, id: newId(), created: Date.now(), done: false },
        ],
      };

    case 'toggleTask':
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t)),
      };

    case 'deleteTask':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };

    case 'addAppointment':
      return {
        ...state,
        appointments: [
          ...state.appointments,
          { ...action.appointment, id: newId(), created: Date.now() },
        ],
      };

    case 'setAppointmentKind':
      return {
        ...state,
        appointments: state.appointments.map((a) =>
          a.id === action.id ? { ...a, kind: action.kind } : a,
        ),
      };

    case 'deleteAppointment':
      return {
        ...state,
        appointments: state.appointments.filter((a) => a.id !== action.id),
      };

    case 'addCommitment':
      return {
        ...state,
        commitments: [
          ...state.commitments,
          { ...action.commitment, id: newId(), created: Date.now() },
        ],
      };

    case 'patchCommitment':
      return {
        ...state,
        commitments: state.commitments.map((c) =>
          c.id === action.id ? { ...c, ...action.patch } : c,
        ),
      };

    case 'removeCommitment':
      return { ...state, commitments: state.commitments.filter((c) => c.id !== action.id) };

    // The hours you actually work in. See `lib/windows.ts` — these make every
    // hour figure in the app true rather than nominal.
    case 'addWindow': {
      const w = tidy({ ...action.window, id: newId() });
      return w ? { ...state, windows: [...state.windows, w] } : state;
    }

    case 'patchWindow':
      return {
        ...state,
        windows: state.windows.map((w) => {
          if (w.id !== action.id) return w;
          // A half-edited window — no days yet, or an end before its start —
          // is kept as typed rather than snapped back, or the fields fight
          // the person filling them in. `freeOn` reads a backwards span as
          // nothing, which is the safe way to be briefly wrong.
          return { ...w, ...action.patch };
        }),
      };

    case 'dropWindow':
      return { ...state, windows: state.windows.filter((w) => w.id !== action.id) };

    // What the term cost. Yours, like everything else in this slice.
    case 'addCost':
      return {
        ...state,
        costs: [...state.costs, { ...action.cost, id: newId(), at: Date.now() }],
      };

    case 'patchCost':
      return {
        ...state,
        costs: state.costs.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)),
      };

    case 'dropCost':
      return { ...state, costs: state.costs.filter((c) => c.id !== action.id) };

    // Meal-plan readings. Logged rather than overwritten — see `lib/meals.ts`.
    case 'logBalance':
      return { ...state, balances: [...state.balances, { ...action.balance, id: newId() }] };

    case 'dropBalance':
      return { ...state, balances: state.balances.filter((b) => b.id !== action.id) };

    // Where you live, per term. Replaces rather than appends: a balance is a
    // reading and two of them are a rate, but a room is a fact and there is
    // only one of it at a time. Filing the old one away would leave the app
    // choosing between two rooms on a `created` stamp.
    case 'setResidence':
      return {
        ...state,
        residences: [
          ...state.residences.filter((r) => r.term !== action.residence.term),
          { ...action.residence, id: newId(), created: Date.now() },
        ],
      };

    case 'dropResidence':
      return { ...state, residences: state.residences.filter((r) => r.id !== action.id) };

    case 'addPlace':
      return {
        ...state,
        places: [...state.places, { ...action.place, id: newId(), created: Date.now() }],
      };

    case 'removePlace':
      return { ...state, places: state.places.filter((p) => p.id !== action.id) };

    default:
      return null;
  }
}
