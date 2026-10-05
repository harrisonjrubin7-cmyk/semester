import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useOnline } from '../offline-mode';
import { useNow, useStore } from '../../state/store';
import { canSend, discard, load, newEntry, openPort, send, shown, type Can, type Entry, type Kind, type Port, type Shown } from './outbox';
import { senders } from './senders';

/**
 * The outbox for the components.
 *
 * The list lives in one small external store, read with `useSyncExternalStore`,
 * so the offer on the screen that was refused and the list on Account are
 * never showing different things, and a change made anywhere reaches both
 * without either having to set state from an effect.
 */

interface Snapshot {
  accountId: string | null;
  entries: Entry[];
  durable: boolean;
  ready: boolean;
}

let portP: Promise<Port> | null = null;
const port = () => (portP ??= openPort());
let snap: Snapshot = { accountId: null, entries: [], durable: true, ready: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const getSnapshot = () => snap;
const NONE: Entry[] = [];

async function reload(accountId: string | null): Promise<void> {
  const p = await port();
  const entries = await load(p, accountId, Date.now());
  snap = { accountId, entries, durable: p.durable, ready: true };
  emit();
}

/** For tests: forget the open port and the list, so the next use starts fresh. */
export function resetOutbox(): void {
  portP = null;
  snap = { accountId: null, entries: [], durable: true, ready: false };
}

export interface Row {
  entry: Entry;
  shown: Shown;
  can: Can;
  /** A share that may have gone: sending again needs a second, deliberate tap. */
  needsConfirm: boolean;
}

export interface UseOutbox {
  ready: boolean;
  durable: boolean;
  online: boolean;
  rows: Row[];
  /** What the last action did, in a sentence, for a live region. */
  said: string;
  keep(kind: Kind, summary: string, payload: unknown): Promise<Entry | null>;
  sendOne(id: string, confirmed?: boolean): Promise<void>;
  drop(id: string): Promise<void>;
}

export function useOutbox(): UseOutbox {
  const { account } = useStore();
  const online = useOnline();
  const now = useNow().getTime();
  const accountId = account?.id ?? null;
  const s = useSyncExternalStore(subscribe, getSnapshot);
  const [said, setSaid] = useState('');

  // What is on disk for this account, read again when the account changes.
  useEffect(() => {
    void reload(accountId);
  }, [accountId]);

  // A snapshot read for another account is not this account's list.
  const mine = s.accountId === accountId;
  const entries = mine ? s.entries : NONE;

  const keep = useCallback(
    async (kind: Kind, summary: string, payload: unknown) => {
      if (accountId === null) return null;
      const entry = newEntry({ kind, accountId, summary, payload, now: Date.now() });
      try {
        await (await port()).put(entry);
      } catch {
        // Full, or refused: not kept, and it says so rather than pretending.
        setSaid('This could not be kept: the browser would not save it. Nothing was saved and nothing was sent.');
        return null;
      }
      setSaid(`Kept. ${summary} is waiting for you to send it. It will not go by itself.`);
      await reload(accountId);
      return entry;
    },
    [accountId],
  );

  const sendOne = useCallback(
    async (id: string, confirmed = false) => {
      const entry = entries.find((e) => e.id === id);
      if (!entry) return;
      const can = canSend(entry, Date.now(), { online, accountId, confirmed });
      if (!can.ok) {
        setSaid(can.why);
        return;
      }
      let out: Entry;
      try {
        out = await send(await port(), entry, senders);
      } catch {
        // The write that comes before the call failed, so no call was made.
        setSaid('Not sent. This device would not save its place first, so nothing left. Try again, or discard it.');
        return;
      }
      setSaid(
        out.state === 'sent'
          ? `Sent. ${out.summary}`
          : out.state === 'failed'
            ? `Not sent. ${out.said ?? 'It was refused.'}`
            : `${out.said ?? 'It may not have arrived.'}`,
      );
      await reload(accountId);
    },
    [entries, online, accountId],
  );

  const drop = useCallback(
    async (id: string) => {
      await discard(await port(), id);
      setSaid('Removed. Nothing was sent.');
      await reload(accountId);
    },
    [accountId],
  );

  const rows: Row[] = entries.map((entry) => {
    const plain = canSend(entry, now, { online, accountId });
    const forced = canSend(entry, now, { online, accountId, confirmed: true });
    return { entry, shown: shown(entry, now), can: forced, needsConfirm: !plain.ok && forced.ok };
  });

  return { ready: mine && s.ready, durable: s.durable, online, rows, said, keep, sendOne, drop };
}
