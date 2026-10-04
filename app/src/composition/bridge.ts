import type { Action } from '../state/shape';

/**
 * A bridge between a React component and the host the domains read through.
 *
 * Its own file, and importing nothing but a type, because the shell needs it
 * at first load and must not pay for the composition root to get it: the
 * domains are loaded only by a build that switches them on.
 */

/** A write the store ignored (a dispatch that changes nothing never commits) must not hang its caller. */
const SETTLE_TIMEOUT_MS = 1000;

export function makeBridge<S>(first: S, firstDispatch: (a: Action) => void) {
  let snapshot = first;
  let dispatch = firstDispatch;
  let waiting: (() => void)[] = [];
  return {
    sync(next: S, nextDispatch: (a: Action) => void) {
      snapshot = next;
      dispatch = nextDispatch;
      // The snapshot now holds what was dispatched, so whoever was waiting for it may read.
      const release = waiting;
      waiting = [];
      for (const resolve of release) resolve();
    },
    read: () => snapshot,
    send: (a: Action) => dispatch(a),
    /**
     * `dispatch` schedules the reducer; it does not run it. Straight after
     * `addTask` the snapshot still holds the old list, so the adapter could not
     * find the task it had just added. This resolves on the next sync, the
     * moment the snapshot holds the result.
     */
    settled: () =>
      new Promise<void>((resolve) => {
        waiting.push(resolve);
        setTimeout(resolve, SETTLE_TIMEOUT_MS);
      }),
  };
}

export type Bridge<S> = ReturnType<typeof makeBridge<S>>;
