/**
 * Where you were on each screen.
 *
 * The app remounts its scroll area on every navigation — `key={state.screen}`
 * in `App.tsx` — which is right for everything except this: it throws away the
 * scroll position, so going from halfway down Courses into a guide and back
 * puts you at the top of Courses again. On a phone, halfway down a long list is
 * fifteen flicks, and an app that makes you do them twice is one you stop
 * browsing in.
 *
 * ## In memory, not on disk
 *
 * Restoring a position from yesterday would put somebody in the middle of a
 * list whose contents have moved — the deadline they were looking at is done,
 * the week has turned over. Within a session it is a return to where you were;
 * across sessions it is a stranger's bookmark. So this lives in a module-level
 * map that dies with the tab.
 *
 * ## Two rules that are not the obvious ones
 *
 * Tapping the tab you are already on goes to the top. That is what every phone
 * does and it is the only way back up a long list without flicking.
 *
 * A position goes stale. Come back to Courses forty minutes later and being
 * dropped two thousand pixels down is disorienting rather than helpful, so
 * after `STALE_AFTER` the screen opens at the top like a fresh one.
 */

/** After this long, a remembered position is somebody else's. */
export const STALE_AFTER = 15 * 60 * 1000;

/** Below this, restoring is indistinguishable from not bothering. */
export const WORTH_KEEPING = 24;

interface Mark {
  top: number;
  at: number;
}

const marks = new Map<string, Mark>();

/** Remember where a screen was left. */
export function keep(screen: string, top: number, at: number): void {
  if (top < WORTH_KEEPING) {
    // Not "leave the old one": scrolling back to the top is a deliberate act
    // and should be what you find when you return.
    marks.delete(screen);
    return;
  }
  marks.set(screen, { top, at });
}

/**
 * Where to open a screen, given how far it can actually scroll.
 *
 * `most` is the real limit — content changes while you are away, and a list
 * that lost four rows cannot honour a position past its own end. Clamping here
 * rather than letting the browser do it keeps the decision in a tested place.
 */
export function opensAt(screen: string, at: number, most: number): number {
  const mark = marks.get(screen);
  if (!mark) return 0;
  if (at - mark.at > STALE_AFTER) {
    marks.delete(screen);
    return 0;
  }
  return Math.max(0, Math.min(mark.top, most));
}

/** Tapping the tab you are already on, or anything else that means "top". */
export function forget(screen: string): void {
  marks.delete(screen);
}

/** For a test, and for signing out. */
export function forgetAll(): void {
  marks.clear();
}

/** Whether a screen has somewhere to go back to. */
export function remembered(screen: string): boolean {
  return marks.has(screen);
}
