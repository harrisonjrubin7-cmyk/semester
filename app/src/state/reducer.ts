/**
 * One reducer, ten slices.
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

import { idOf, strategyFor } from '../lib/merge';
import { DELETABLE } from '../lib/deletions';
import { SETTING_FIELDS, putRecord } from '../lib/conflicts';
import type { Action, State } from './shape';
import { changedSomething, snapshot, tookSomething, undoableFor } from '../lib/undo';
import { library } from './slices/library';
import { made } from './slices/made';
import { mailbox } from './slices/mailbox';
import { mine } from './slices/mine';
import { navigate } from './slices/navigate';
import { notes } from './slices/notes';
import { papers } from './slices/papers';
import { schedule } from './slices/schedule';
import { seen } from './slices/seen';
import { settings } from './slices/settings';
import { study } from './slices/study';

/**
 * In order of how often they fire, which is also roughly how much of the app
 * each one covers. The order is not load-bearing — no two slices claim the
 * same action, and the test above says so.
 */
const SLICES = [navigate, study, schedule, mine, notes, made, mailbox, papers, library, settings, seen];

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
    return { ...state, said: action.said, saidAt: action.at, saidTo: action.to ?? null };
  }
  // Five seconds later. The sentence goes rather than a flag being set: the
  // live region has long since announced it, and a sentence kept around after
  // its strip is down is a thing for somebody to wonder about later.
  if (action.type === 'forgetSaid') {
    return state.said ? { ...state, said: '', saidTo: null } : state;
  }
  // The sync banner, dismissed. Kept beside `say` because it is the same
  // shape of thing: a cross-cutting notice rather than one area's business.
  if (action.type === 'forgetSyncNote') {
    // Marked as told rather than emptied: the banner is a one-time
    // announcement, and the Account screen still has to be able to say what
    // the last sync did afterwards.
    return state.lastSync ? { ...state, lastSync: { ...state.lastSync, told: true } } : state;
  }

  // A version the student chose between two devices' edits. Here rather
  // than in a slice because it can land in any list the merge unions, which
  // is most of them. Only those: a field the merge does not treat as a list
  // of records has no second copy to have chosen.
  if (action.type === 'restoreRecord') {
    const rows = (state as unknown as Record<string, unknown>)[action.field];
    if (!Array.isArray(rows) || strategyFor(action.field) !== 'union') return state;
    return { ...state, [action.field]: putRecord(rows, action.record) } as State;
  }

  // The same, for a setting: the version the student chose, written back
  // field by field. Only the fields a group on the review list covers — this
  // is an action any code could dispatch, and a generic "set these fields"
  // must not become a way round every other action's rules.
  if (action.type === 'restoreSettings') {
    const allowed = Object.entries(action.values).filter(([field]) => SETTING_FIELDS.has(field));
    if (allowed.length === 0) return state;
    return { ...state, ...Object.fromEntries(allowed) } as State;
  }

  // And one key of a per-key map — a tick, a grade, a course's name. Only
  // maps the merge treats key by key; `undefined` is the key not being set
  // on the device the student chose, so it goes.
  if (action.type === 'restoreTick') {
    const map = (state as unknown as Record<string, unknown>)[action.field];
    if (strategyFor(action.field) !== 'ticks' || typeof map !== 'object' || map === null) return state;
    const next = { ...(map as Record<string, unknown>) };
    if (action.value === undefined) delete next[action.key];
    else next[action.key] = action.value;
    return { ...state, [action.field]: next } as State;
  }

  // Keys another device removed, removed here — the one thing the per-key
  // merge cannot do. Only per-key maps, and only the keys named.
  if (action.type === 'dropTicks') {
    let next: State | null = null;
    for (const [field, keys] of Object.entries(action.removals)) {
      const map = (state as unknown as Record<string, unknown>)[field];
      if (strategyFor(field) !== 'ticks' || typeof map !== 'object' || map === null) continue;
      const kept = { ...(map as Record<string, unknown>) };
      for (const k of keys) delete kept[k];
      next = { ...(next ?? state), [field]: kept } as State;
    }
    return next ?? state;
  }

  // Records another device deleted, deleted here — the one thing a union merge
  // cannot do for a list. Only the lists `lib/deletions.ts` allows, only the
  // ids named, and a course takes the updates filed against it, as removing
  // one on purpose does. Not undoable and not queued for the account: the
  // account already lacks them, which is how this device found out.
  if (action.type === 'dropRecords') {
    let next: State = state;
    for (const [field, ids] of Object.entries(action.removals)) {
      if (!(DELETABLE as readonly string[]).includes(field) || ids.length === 0) continue;
      const drop = new Set(ids);
      const rows = (next as unknown as Record<string, unknown>)[field];
      if (!Array.isArray(rows)) continue;
      next = {
        ...next,
        [field]: rows.filter((row) => !drop.has(idOf(row) ?? '')),
        ...(field === 'courses' ? { updates: next.updates.filter((u) => !drop.has(u.courseId ?? '')) } : {}),
      } as State;
    }
    return next;
  }

  const undoable = undoableFor(action.type);
  const before = undoable ? snapshot(state, undoable, Date.now()) : null;

  for (const slice of SLICES) {
    const next = slice(state, action);
    if (next === null) continue;
    // Only where the action actually did something. A Remove pressed on an id
    // that is already gone should not put a toast up offering to undo nothing,
    // and neither should a move that landed a thing back where it was.
    if (!before || !undoable) return next;
    const did = undoable.onChange
      ? changedSomething(before, state, next)
      : tookSomething(before, next);
    return did ? { ...next, undone: before } : next;
  }
  return state;
}
