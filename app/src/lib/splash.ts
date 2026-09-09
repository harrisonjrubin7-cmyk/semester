/**
 * Whether the opening screen has already run, for this page load.
 *
 * A launch is the event the welcome keys on — opening the app, or coming back
 * to an installed one the system has since unloaded — and a module is the
 * thing in this codebase whose lifetime is exactly that. So the flag lives
 * here rather than in the store: it is deliberately not persisted, not synced
 * and not restored, because every one of those would mean the app welcomed you
 * on Monday and never again.
 *
 * It is a module of its own rather than a `let` inside `components/Splash.tsx`
 * so that a test can start a second launch without reloading the component and
 * everything it imports — the same bargain `forgetFolds` makes in
 * `lib/folds.hook.ts`.
 *
 * Reading and writing are two calls on purpose. The component decides once, at
 * mount, and records it from an effect afterwards; a single `claim()` that did
 * both would be a side effect during render, which React's StrictMode runs
 * twice and would answer differently each time.
 */

let played = false;

/** Whether this page load has already shown it. */
export function splashPlayed(): boolean {
  return played;
}

/** Remember that it has, so nothing replays it before the next page load. */
export function splashDone(): void {
  played = true;
}

/** For tests: forget the launch, so the next mount is a fresh one. */
export function forgetSplash(): void {
  played = false;
}
