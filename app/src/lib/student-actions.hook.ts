import { useCallback, useEffect, useRef, useState } from 'react';
import type { StudentAction, StudentActionState } from './student-actions';
import { myStudentActions, settleStudentAction, StaleActionError } from './student-actions-remote';

export type FeedbackState =
  | { kind: 'off' }
  | { kind: 'signed-out' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; actions: StudentAction[]; stale: boolean };

/**
 * The student's released-feedback actions, fetched once per mount while
 * `enabled` and `userId` names the signed-in account, and again after every
 * change. The caller passes the account rather than this reading the store, so
 * `lib/` does not import upward. Each answer is kept
 * with the account it was fetched for, as `useOfficeActions` does, so a shared
 * device never shows the last account's feedback to the next.
 *
 * `settle` sends the version last known for the row — the feed's, or the one
 * the previous settle returned, so Undo after Done works although a done row
 * has left the feed. A stale refusal reloads the feed and marks it `stale`
 * until the student's next successful change.
 */
export function useStudentActions(enabled: boolean, userId: string | null) {
  const [state, setState] = useState<{ for: string | null; value: FeedbackState }>({ for: null, value: { kind: 'loading' } });
  const [round, setRound] = useState(0);
  const stale = useRef(false);
  const versions = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!enabled || !userId) return;
    let live = true;
    myStudentActions()
      .then((actions) => {
        if (!live) return;
        for (const a of actions) {
          versions.current[a.id] = Math.max(versions.current[a.id] ?? 0, a.version);
        }
        setState({ for: userId, value: { kind: 'ready', actions, stale: stale.current } });
      })
      .catch(
        (e: unknown) =>
          live && setState({ for: userId, value: { kind: 'error', message: e instanceof Error ? e.message : String(e) } }),
      );
    return () => {
      live = false;
    };
  }, [enabled, userId, round]);

  const reload = useCallback(() => {
    setState({ for: null, value: { kind: 'loading' } });
    setRound((r) => r + 1);
  }, []);

  /** Moves one row on the server, then reads the feed again. Throws the refusal, in words. */
  const settle = useCallback(
    async (id: string, to: StudentActionState) => {
      if (!userId) throw new Error('Sign in first.');
      const version = versions.current[id];
      if (!version) throw new Error('This item is no longer in your list.');
      try {
        const done = await settleStudentAction(id, to, version);
        versions.current[id] = done.version;
        stale.current = false;
      } catch (e) {
        if (e instanceof StaleActionError) {
          stale.current = true;
          setRound((r) => r + 1);
        }
        throw e;
      }
      setRound((r) => r + 1);
    },
    [userId],
  );

  const shown: FeedbackState =
    !enabled ? { kind: 'off' } : !userId ? { kind: 'signed-out' } : state.for === userId ? state.value : { kind: 'loading' };
  return { state: shown, reload, settle, userId };
}
