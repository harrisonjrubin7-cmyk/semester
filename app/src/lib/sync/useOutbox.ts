import { useCallback, useEffect, useState } from 'react';
import { useOnline } from '../offline-mode';
import { useStore } from '../../state/store';
import { canSend, discard, load, newEntry, openPort, send, shown, type Can, type Entry, type Kind, type Port, type Shown } from './outbox';
import { senders } from './senders';

/**
 * The outbox for the components: one port, one list, and every instance told
 * when it changes, so the offer on the screen that was refused and the list
 * on Account are never showing different things.
 */

let portP: Promise<Port> | null = null;
const port = () => (portP ??= openPort());
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

/** For tests: forget the open port, so the next use opens a fresh one. */
export function resetOutbox(): void {
  portP = null;
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
  const accountId = account?.id ?? null;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [durable, setDurable] = useState(true);
  const [ready, setReady] = useState(false);
  const [said, setSaid] = useState('');

  const reload = useCallback(async () => {
    const p = await port();
    setDurable(p.durable);
    setEntries(await load(p, accountId, Date.now()));
    setReady(true);
  }, [accountId]);

  useEffect(() => {
    void reload();
    listeners.add(reload);
    return () => void listeners.delete(reload);
  }, [reload]);

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
      changed();
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
      changed();
    },
    [entries, online, accountId],
  );

  const drop = useCallback(async (id: string) => {
    await discard(await port(), id);
    setSaid('Removed. Nothing was sent.');
    changed();
  }, []);

  const now = Date.now();
  const rows: Row[] = entries.map((entry) => ({
    entry,
    shown: shown(entry, now),
    can: canSend(entry, now, { online, accountId, confirmed: true }),
    needsConfirm: !canSend(entry, now, { online, accountId }).ok && canSend(entry, now, { online, accountId, confirmed: true }).ok,
  }));

  return { ready, durable, online, rows, said, keep, sendOne, drop };
}
