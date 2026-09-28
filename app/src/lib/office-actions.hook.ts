import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../state/store';
import type { OfficeAction } from './office-actions';
import { markDone, myOfficeActions } from './office-actions-remote';

export type FeedState =
  | { kind: 'off' }
  | { kind: 'signed-out' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; actions: OfficeAction[] };

/**
 * The student's office actions, fetched once per mount while `enabled` and
 * signed in. Signed out there is nothing to fetch: office actions come from
 * the school, through the account. `accountId` overrides the store's
 * account, for tests.
 */
export function useOfficeActions(enabled: boolean, accountId?: string | null) {
  const { account } = useStore();
  const userId = accountId !== undefined ? accountId : (account?.id ?? null);
  // Each result is kept with the account it was fetched for, and shown only
  // to that account: after a switch on a shared device the feed reads as
  // loading until the new account's answer arrives, never as the last one's.
  const [state, setState] = useState<{ for: string | null; value: FeedState }>({ for: null, value: { kind: 'loading' } });
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!enabled || !userId) return;
    let live = true;
    myOfficeActions()
      .then((actions) => live && setState({ for: userId, value: { kind: 'ready', actions } }))
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

  /** Marks one done (or not), then reads the feed again. Throws the database's refusal. */
  const setDone = useCallback(
    async (id: string, done: boolean) => {
      if (!userId) throw new Error('Sign in first.');
      await markDone(userId, id, done);
      setRound((r) => r + 1);
    },
    [userId],
  );

  const shown: FeedState =
    !enabled ? { kind: 'off' } : !userId ? { kind: 'signed-out' } : state.for === userId ? state.value : { kind: 'loading' };
  return { state: shown, reload, setDone, userId };
}
