/**
 * Taking it back.
 *
 * The app has a lot of Remove buttons and not one of them could be undone. The
 * usual answer is a confirmation dialogue, and a confirmation dialogue is the
 * wrong answer twice over: it interrupts the ninety-nine times somebody meant
 * it, and by the hundredth it has been clicked through so many times that it
 * does not stop the mistake either.
 *
 * An undo does the opposite. It costs nothing when you meant it and it is
 * there when you did not.
 *
 * ## One step, deliberately
 *
 * Not a history. A stack of undos in an app that also syncs to another device
 * is a way to restore something onto a copy that has moved on, and the second
 * step back is almost never the one anybody wanted. What this holds is the
 * last destructive thing, for as long as the toast is up.
 *
 * ## It snapshots the fields, not the state
 *
 * Keeping a whole previous state would double the app's memory and, worse,
 * would restore *everything* — undoing a deleted note would also undo the box
 * you ticked in between. Each undoable action names the fields it can damage
 * and only those are kept and put back.
 *
 * ## Confirmation is kept for the things undo cannot fix
 *
 * Removing a whole course takes its guide, its cards and every answer against
 * them, and that is a different order of loss from a deleted row. Those still
 * ask — and they ask by making you type, because a button somebody has learned
 * to click through is not a question.
 */

import type { Persisted } from '../state/shape';

/** The fields one action can damage, and what to call the undo. */
export interface Undoable {
  label: string;
  fields: (keyof Persisted)[];
}

/**
 * Every action that removes something a person made.
 *
 * Ticking a box is not here: it is reversible by ticking it again, and a toast
 * after every tick would be the most annoying thing in the app. Neither is
 * anything that only edits — an edit leaves the thing there to edit back.
 */
export const UNDOABLE: Record<string, Undoable> = {
  deleteTask: { label: 'Task deleted', fields: ['tasks'] },
  deleteAppointment: { label: 'Appointment deleted', fields: ['appointments'] },
  removeCommitment: { label: 'Activity removed', fields: ['commitments'] },
  removePlace: { label: 'Place removed', fields: ['places'] },
  removeTimer: { label: 'Timer cleared', fields: ['timers'] },
  removeAlarm: { label: 'Alarm deleted', fields: ['alarms'] },
  removeApplication: { label: 'Application removed', fields: ['applications'] },
  clearReading: { label: 'Reading progress forgotten', fields: ['progress'] },
  unmarkReturned: { label: 'Marked as not back', fields: ['returned'] },
  dropRequirement: { label: 'Requirement removed', fields: ['requirements'] },
  dropTaken: { label: 'Course removed', fields: ['taken'] },
  dropPerson: { label: 'Person removed', fields: ['people', 'visits', 'letters'] },
  dropVisit: { label: 'Conversation removed', fields: ['visits'] },
  dropLetter: { label: 'Letter removed', fields: ['letters'] },
  dropRest: { label: 'Protected time removed', fields: ['rest'] },
  dropWindow: { label: 'Working hours removed', fields: ['windows'] },
  dropCost: { label: 'Cost removed', fields: ['costs'] },
  dropBalance: { label: 'Reading removed', fields: ['balances'] },
  dropResidence: { label: 'Room removed', fields: ['residences'] },
  deleteNote: { label: 'Note deleted', fields: ['notes'] },
  dropSource: { label: 'Source removed', fields: ['sources'] },
  dropSitting: { label: 'Paper removed', fields: ['sittings'] },
};

/**
 * Actions that take more than a row, and are asked about instead.
 *
 * Removing a course takes its deadlines, its guide, its cards and every answer
 * recorded against them. An undo could put the rows back and could not put
 * back the confidence somebody has in an app that lost their term, so these
 * ask first — by typing, because a button people have learned to click through
 * has stopped being a question.
 */
export const TYPE_TO_CONFIRM: Record<string, string> = {
  removeCourse: 'the course code',
};

/** How long the toast stays up. Long enough to notice, short enough to ignore. */
export const SHOWN_FOR = 8000;

export interface Taken {
  label: string;
  at: number;
  /** The fields as they were, before. */
  was: Partial<Persisted>;
}

export function undoableFor(type: string): Undoable | null {
  return UNDOABLE[type] ?? null;
}

/** Snapshot the fields an action is about to damage. */
export function snapshot(state: Persisted, u: Undoable, at: number): Taken {
  const was: Partial<Persisted> = {};
  for (const f of u.fields) {
    (was as Record<string, unknown>)[f as string] = state[f];
  }
  return { label: u.label, at, was };
}

/** How many things are in a field: rows in a list, keys in a record. */
function size(v: unknown): number {
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === 'object') return Object.keys(v).length;
  return v === undefined || v === null ? 0 : 1;
}

/**
 * Whether the action actually took anything.
 *
 * A Remove pressed on an id that is already gone should not put a toast up
 * offering to undo nothing, and neither identity test answers that: a slice
 * returns a fresh `{...state}` every time, and the `.filter` inside it
 * allocates a new array whether or not it dropped a row.
 *
 * Counting does answer it, because every action in `UNDOABLE` is a removal —
 * that is the entry condition for being in the table. One check here covers all
 * twenty-two rather than a guard written twenty-two times and forgotten once.
 */
export function tookSomething(took: Taken, after: Persisted): boolean {
  for (const f of Object.keys(took.was) as (keyof Persisted)[]) {
    if (size(after[f]) < size(took.was[f])) return true;
  }
  return false;
}

/** Whether a snapshot is still offerable. */
export function fresh(t: Taken | null, now: number): boolean {
  return t !== null && now - t.at < SHOWN_FOR;
}

/**
 * Whether what was typed matches what was asked for.
 *
 * Case and surrounding space are forgiven — the point is that somebody read
 * the sentence and typed the thing, not that they can copy exactly.
 */
export function typedRight(typed: string, want: string): boolean {
  return typed.trim().toLowerCase() === want.trim().toLowerCase() && want.trim().length > 0;
}
