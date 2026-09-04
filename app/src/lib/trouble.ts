/**
 * What went wrong, and what to press about it.
 *
 * Every screen that calls the model had grown the same four pieces of state
 * management: an error string, a `catch` that has to tell a real failure from
 * the student pressing Stop, and — after this — the question of whether doing
 * the same thing again is worth offering.
 *
 * That last question is the reason this exists rather than a plain
 * `useState('')`. The screens use one error string for two unrelated things:
 *
 *   - "network error: failed to fetch"          → press it again
 *   - "\"7PZ9\" is not a paper code."           → pressing it again fails identically
 *
 * A retry button on the second is a lie, and a lie that costs money on any
 * screen where the retry is an API call. So the two get different verbs. The
 * catch block, which is the only place that knows which kind it is, says
 * `failed(e, again)`; the validation branch says `wrong(message)`.
 */

import { useCallback, useState } from 'react';

/**
 * The message for a thrown thing, or null when it was a cancellation.
 *
 * Every screen has an abort controller behind a Stop button, and an aborted
 * fetch arrives here as a throw like any other. Showing "signal is aborted
 * without reason" to someone who just pressed Stop reports their own decision
 * back to them as a fault.
 */
export function troubleOf(e: unknown): string | null {
  if (e instanceof DOMException && e.name === 'AbortError') return null;
  if (e instanceof Error) return e.message || String(e);
  const said = String(e);
  return said === '[object Object]' ? 'Something went wrong.' : said;
}

export interface Trouble {
  /** What to show. Empty when nothing is wrong. */
  said: string;
  /** What the retry button runs, or null when there is nothing worth repeating. */
  again: (() => void) | null;
  /** Nothing is wrong. Call at the start of an attempt. */
  clear: () => void;
  /**
   * An attempt failed. Pass what to run to try the same thing again; leave it
   * out where a repeat would be wrong — an upload half-consumed, a form the
   * student has to change first.
   *
   * A cancellation is not a failure and is dropped here, so the caller does
   * not need to test for one.
   */
  failed: (e: unknown, again?: () => void) => void;
  /**
   * The input is the problem. Repeating it would fail the same way, so no
   * retry is offered.
   */
  wrong: (message: string) => void;
  /** Another thing also went wrong, alongside what is already shown. */
  add: (message: string) => void;
}

export function useTrouble(): Trouble {
  const [said, setSaid] = useState('');
  // Held as a nullable function, so it is stored wrapped: React reads a bare
  // function passed to a setter as an updater and would call it immediately —
  // which here means running the retry the instant the failure appears.
  const [again, setAgain] = useState<(() => void) | null>(null);

  const clear = useCallback(() => {
    setSaid('');
    setAgain(null);
  }, []);

  const failed = useCallback((e: unknown, retry?: () => void) => {
    const message = troubleOf(e);
    if (message === null) return;
    setSaid(message);
    setAgain(retry ? () => retry : null);
  }, []);

  const wrong = useCallback((message: string) => {
    setSaid(message);
    setAgain(null);
  }, []);

  const add = useCallback((message: string) => {
    if (!message) return;
    setSaid((prior) => (prior ? `${prior} ${message}` : message));
  }, []);

  return { said, again, clear, failed, wrong, add };
}
