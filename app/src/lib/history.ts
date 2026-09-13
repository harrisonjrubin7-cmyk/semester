/**
 * Undo and redo inside one thing you are editing.
 *
 * `lib/undo.ts` is the app's other undo and stays what it is: one step, for
 * the destructive actions, offered in a toast for eight seconds. That is the
 * right shape for *deleting a note* and the wrong shape for *typing in a
 * spreadsheet*, where a mistake is a cell you overwrote four cells ago and the
 * question is not "did you mean to delete that" but "put it back".
 *
 * So this is the editor's history: a list of states, a finger pointing at one
 * of them, and the two moves. It is pure and generic — a sheet, a deck, a
 * document — because the alternative was writing the same ring buffer into
 * each screen and getting the redo branch subtly different in each.
 *
 * ## Typing is not one step per keystroke
 *
 * A history that recorded every character would make undo useless: twelve
 * presses to take back a word. {@link push} coalesces — a change arriving
 * within {@link COALESCE} of the last one, under the same `tag`, replaces it
 * rather than stacking. The tag is what separates "still typing in B4" from
 * "moved to C4 and started typing there", and it is why the caller passes one.
 *
 * ## A new branch throws the redo away
 *
 * Standard, and worth saying: undo twice, then type, and the two undone states
 * are gone. Keeping them would mean a tree, and nobody has ever wanted to
 * navigate a tree of their own typing.
 */

/** How long two changes can be apart and still be one step. */
export const COALESCE = 900;

/** As many states as are kept. Past this the oldest goes. */
export const DEEPEST = 60;

export interface History<T> {
  /** Oldest first. Never empty: the first entry is where the editor opened. */
  past: T[];
  /** Which entry is showing. */
  at: number;
  /** What the entry at `at` was tagged with, for coalescing. */
  tag: string;
  /** When it was recorded. */
  when: number;
}

export function start<T>(state: T, when = 0): History<T> {
  return { past: [state], at: 0, tag: '', when };
}

/** What the editor is showing. */
export function now<T>(h: History<T>): T {
  return h.past[h.at];
}

export function canUndo<T>(h: History<T>): boolean {
  return h.at > 0;
}

export function canRedo<T>(h: History<T>): boolean {
  return h.at < h.past.length - 1;
}

/**
 * Record a change.
 *
 * Coalescing replaces the entry rather than adding one, so the *first* state
 * of a run of typing is what undo goes back to — which is the whole point.
 * Anything past the finger is dropped: a change is a new branch.
 */
export function push<T>(h: History<T>, state: T, tag: string, when: number): History<T> {
  const together = tag !== '' && tag === h.tag && when - h.when < COALESCE;
  if (together) {
    const past = h.past.slice(0, h.at + 1);
    past[h.at] = state;
    return { past, at: h.at, tag, when };
  }
  const past = [...h.past.slice(0, h.at + 1), state];
  // The oldest goes when the list is full, and the finger comes back with it —
  // otherwise it points one past where it was and undo skips a step.
  const over = Math.max(0, past.length - DEEPEST);
  return { past: past.slice(over), at: past.length - 1 - over, tag, when };
}

export function undo<T>(h: History<T>): History<T> {
  if (!canUndo(h)) return h;
  // The tag is cleared on a move, so the next change starts its own step
  // rather than coalescing into the one just stepped away from.
  return { ...h, at: h.at - 1, tag: '' };
}

export function redo<T>(h: History<T>): History<T> {
  if (!canRedo(h)) return h;
  return { ...h, at: h.at + 1, tag: '' };
}
