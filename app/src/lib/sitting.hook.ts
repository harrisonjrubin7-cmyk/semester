/**
 * The running timer, shared by everything that shows it.
 *
 * Two places need it at once — the control on a deadline, and the indicator in
 * the header that follows you around the app — and they have to agree. The
 * store would be the obvious home, except that the store is what syncs to the
 * account, and a running timer must not: see the note at the top of
 * `lib/session.ts`.
 *
 * So this is the smallest thing that does the job. One module-level copy, a
 * set of listeners, and localStorage as the only durable record. The same
 * shape as `useSyncExternalStore` expects, because it is exactly that problem.
 */

import { useCallback, useSyncExternalStore } from 'react';
import { readSitting, writeSitting, type Sitting } from './session';

let held: Sitting | null | undefined;
const listeners = new Set<() => void>();

function current(): Sitting | null {
  // Read once, lazily. `useSyncExternalStore` calls the snapshot on every
  // render and compares by identity, so parsing JSON here would hand back a
  // new object each time and re-render forever.
  if (held === undefined) held = readSitting();
  return held;
}

function subscribe(fire: () => void): () => void {
  listeners.add(fire);
  return () => listeners.delete(fire);
}

export function setSitting(next: Sitting | null): void {
  held = next;
  writeSitting(next);
  for (const fire of listeners) fire();
}

/** The session in progress, and a setter. Null when nothing is running. */
export function useSitting(): [Sitting | null, (next: Sitting | null) => void] {
  const now = useSyncExternalStore(subscribe, current, () => null);
  const set = useCallback((next: Sitting | null) => setSitting(next), []);
  return [now, set];
}
