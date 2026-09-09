import { useCallback, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
import {
  FOLDS_KEY,
  allIn,
  isFolded,
  nextForAll,
  readFolds,
  setFold,
  writeFolds,
  inScope,
  type Folds,
} from './folds';

/**
 * The folded set, and which sections are on screen to be folded.
 *
 * Two module-level facts with one list of subscribers, rather than a context
 * or a slice of the store. Three reasons, in order of how much they matter:
 *
 * **The "collapse all" control has to move sections it does not contain.**
 * It sits at the top of the page; the sections are inside components the page
 * cannot see into — Today's five are five separate components, and the
 * screen's own markup contains none of them. So the sections say they are
 * there, as they mount, and the control reads that list. Anything less is a
 * button that folds whichever sections happened to be written inline.
 *
 * **This is not account data.** The store syncs to the cloud and is what a
 * backup contains; which headings you tapped shut on this phone is neither.
 * `lib/folds.ts` says why at length.
 *
 * **A heading should not re-render its screen.** `useSyncExternalStore` with
 * a boolean snapshot means folding one section re-renders that section and
 * the "all" control, and nothing else — on a screen where a section might be
 * a month grid or a PDF, that is the difference between instant and not.
 */

let current: Folds | null = null;
const listeners = new Set<() => void>();

/** One frozen empty set, so a snapshot with nothing in it is stable. */
const EMPTY: Folds = Object.freeze({});

/**
 * The sections mounted right now, and how many of each.
 *
 * A count rather than a flag: two screens can be alive at once for a frame
 * during a transition, and a section that unmounted its twin's registration
 * would leave the control folding a list with a hole in it.
 */
const shown = new Map<string, number>();

/**
 * Bumped by anything either half changes, and the whole of the snapshot.
 *
 * A number, because `useSyncExternalStore` compares snapshots by identity and
 * the two things being watched here are a rebuilt object and a mutable map.
 * One counter is honest about what it is: a signal to look again.
 */
let version = 0;

function load(): Folds {
  try {
    return readFolds(localStorage.getItem(FOLDS_KEY));
  } catch {
    // A private window with site data off. Every section is open and stays
    // open for the session, which is the app before any of this existed.
    return EMPTY;
  }
}

/** The current set, read from the device the first time anything asks. */
export function folds(): Folds {
  if (!current) current = load();
  return current;
}

function tell(): void {
  version += 1;
  for (const listener of listeners) listener();
}

function commit(next: Folds): void {
  if (next === folds()) return;
  current = next;
  try {
    localStorage.setItem(FOLDS_KEY, writeFolds(next));
  } catch {
    // The account's own save has first claim on the budget. A memory of
    // which sections were shut is not worth failing a screen over, so it is
    // dropped quietly and holds for this session only.
  }
  tell();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function stamp(): number {
  return version;
}

/**
 * Whether one section is shut, the tap that changes it, and the note that it
 * is on screen at all.
 *
 * The registration is a layout effect rather than an ordinary one so the
 * control above the sections is right on the frame the screen appears on,
 * instead of appearing a beat later.
 */
export function useFold(key: string): { shut: boolean; toggle: () => void } {
  const shut = useSyncExternalStore(
    subscribe,
    () => isFolded(folds(), key),
    // Rendered without a device to have folded anything on. Open.
    () => false,
  );

  useLayoutEffect(() => {
    shown.set(key, (shown.get(key) ?? 0) + 1);
    tell();
    return () => {
      const left = (shown.get(key) ?? 1) - 1;
      if (left > 0) shown.set(key, left);
      else shown.delete(key);
      tell();
    };
  }, [key]);

  const toggle = useCallback(() => {
    commit(setFold(folds(), key, !isFolded(folds(), key)));
  }, [key]);

  return { shut, toggle };
}

/**
 * Every section on one screen at once, for the control above them.
 *
 * "On this screen" is the scope the sections named themselves under, so it
 * covers the ones a screen wrote and the ones a component it uses drew for
 * itself — which on Today is all of them.
 */
export function useFoldAll(scope: string): {
  /** How many sections are on screen. Under two, there is nothing to say. */
  count: number;
  /** What the button should read. */
  said: string;
  /** What pressing it does. */
  press: () => void;
} {
  const at = useSyncExternalStore(subscribe, stamp, () => 0);
  return useMemo(() => {
    const keys = [...shown.keys()].filter((key) => inScope(key, scope));
    const next = nextForAll(folds(), keys);
    return {
      count: keys.length,
      said: next.said,
      press: () => commit(allIn(folds(), scope, keys, next.shut)),
    };
    // `at` is the signal that either half moved; the values are read fresh.
  }, [at, scope]);
}

/** For tests: forget what was read, so the next read goes to the device. */
export function forgetFolds(): void {
  current = null;
  tell();
}
