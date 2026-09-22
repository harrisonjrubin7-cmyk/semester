import { TRAIL_KEY, readTrail, stepped, writeTrail, type Visit } from './trail';
import type { Screen } from './types';

/**
 * The trail, as one fact the app shares — and the one place that writes it.
 *
 * Module state rather than the store, for the reason `lib/trail.ts` gives at
 * length: the store syncs to the cloud and is what a backup contains, and a
 * record of everywhere somebody looked is not account data. `folds.hook.ts`
 * and `browser.hook.ts` are the same shape for the same reason, and this is
 * the third, which is enough to call it the app's way of holding a fact about
 * *this device*.
 *
 * ## One writer
 *
 * {@link recordVisit} is called from exactly one place — the effect in
 * `state/store.tsx` that puts the address in the bar. That effect already
 * computes where the app is, out of `NAMED` and the state, and already fires
 * once per place rather than once per render. A second computation of "where
 * are we" would be a second answer to drift out of step with the address,
 * which is the bug this repository keeps finding in its own history.
 *
 * It takes the screen and the id rather than reading them, so this file needs
 * nothing from the store and can be tested without one.
 *
 * ## No subscription, yet
 *
 * `folds.hook.ts` and `browser.hook.ts` both publish to `useSyncExternalStore`
 * because both have components watching them. This one has no reader at all —
 * item A of the queue is the record and the writer, and the History screen is
 * item B — so the listener set and the snapshot hook are not written here. Ten
 * lines of plumbing with nothing plugged into it is ten lines nobody can tell
 * are wrong.
 */

let held: Visit[] | null = null;

function load(): Visit[] {
  try {
    return readTrail(localStorage.getItem(TRAIL_KEY));
  } catch {
    // A private window with site data off. The trail lasts the session, which
    // is the app as it was before any of this existed.
    return [];
  }
}

/** The trail, read from the device the first time anything asks. */
export function trail(): Visit[] {
  if (!held) held = load();
  return held;
}

function commit(next: Visit[]): void {
  if (next === trail()) return;
  held = next;
  try {
    localStorage.setItem(TRAIL_KEY, writeTrail(next));
  } catch {
    // The account's own save has first claim on the budget. Knowing where you
    // were last Tuesday is not worth failing a save over, so it is dropped
    // quietly and the trail holds for this session only.
  }
}

/** The app is now at this place. See the header for why there is one caller. */
export function recordVisit(screen: Screen, id: string, at: number = Date.now()): void {
  commit(stepped(trail(), { screen, id, at }));
}

/**
 * Drop the trail, and the device's copy of it.
 *
 * For tests, the way `forgetStrip` in `browser.hook.ts` is — and it is also
 * the call the Clear controls will make, which is master spec 169–171 and the
 * queue's item C. Written now rather than with them because clearing is a
 * property of the record rather than of a screen, and because the two do not
 * arrive at the same time: **nothing draws the trail yet, so there is nothing
 * to clear it from.** The queue's rule that C lands with or before B — a
 * history surface that cannot be cleared should not ship — is about the
 * surface, and this is the half of it that can be true in advance.
 */
export function forgetTrail(): void {
  held = null;
  try {
    localStorage.removeItem(TRAIL_KEY);
  } catch {
    // Nothing to remove, or nowhere to remove it from.
  }
}
