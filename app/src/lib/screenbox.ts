import type { RefObject } from 'react';

/**
 * The filter box on the screen in front of you, if it filters anything.
 *
 * `/` has to do one of two things and it cannot decide which without knowing
 * what is on screen: focus the filter where the screen has a list of its own,
 * open the whole-app search where it does not. Those two facts live in
 * different places — the key binding is global and mounted once, the box is
 * inside `<Page>` and re-created on every screen — so this is the one line
 * between them.
 *
 * It is a module-level slot rather than context on purpose. The listener runs
 * outside React, in a `keydown` handler that must not re-subscribe every time
 * a screen re-renders; reading a mutable slot at the moment the key is pressed
 * is both simpler and less code than threading a provider through the shell.
 *
 * ## What this replaced
 *
 * Both listeners existed and neither knew about the other. `lib/keys.ts` bound
 * `/` to the search overlay; `<Page>` bound `/` to its own box. Nothing called
 * `stopPropagation`, so a keypress ran both: on Grades it focused the overlay
 * and navigated, on Courses it left focus on `<body>` and did nothing useful.
 * One key, two owners, and the screen you were looking at lost either way.
 */

interface Box {
  input: RefObject<HTMLInputElement | null>;
  /** Whether it filters this screen, or only forwards to the whole app. */
  filters: boolean;
}

let current: Box | null = null;

/**
 * Claim the slot for this screen's box.
 *
 * Returns the release. Call it on unmount — and it only releases if this box
 * is still the one in the slot, because React mounts the next screen's `<Page>`
 * before unmounting the last one's, and a blind release would clear the box
 * that had just arrived.
 */
export function holdBox(box: Box): () => void {
  current = box;
  return () => {
    if (current === box) current = null;
  };
}

/** The box on screen, or null. Read at the moment a key is pressed. */
export function boxNow(): Box | null {
  return current;
}

/**
 * Put the caret in the screen's filter, if there is one worth focusing.
 *
 * True when it took the key, false when the caller should fall back to the
 * whole-app search. A box with no adapter is not worth focusing: typing into
 * it filters nothing, and the only way out of it is Enter, which opens the
 * overlay anyway — so `/` may as well open the overlay directly.
 */
export function focusBox(): boolean {
  const box = current;
  if (!box?.filters) return false;
  const el = box.input.current;
  if (!el) return false;
  el.focus();
  el.select();
  return true;
}
