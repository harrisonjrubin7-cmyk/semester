import { useEffect, useRef, useState } from 'react';
import { SyncEngine, type SyncSummary } from '@semester/offline-sync';
import { cloud, cloudConfigured } from '../lib/cloud';
import { newId } from '../lib/idb';
import { READ_ONLY } from '../lib/readonly';
import type { PersonalTask } from '../lib/types';
import { idbSnapshotPort, openEngineStore } from '../lib/sync/engine/persistent';
import { taskEngineOn } from '../lib/sync/engine/ownership';
import { supabaseTaskRows } from '../lib/sync/engine/rows';
import { TaskSync } from '../lib/sync/engine/tasks';
import { tasksTransport } from '../lib/sync/engine/tasks-transport';

const DEVICE_KEY = 'semester.engine.device';
/** Quiet time after an edit before it is adopted and sent: a burst of typing is one write, not forty. */
const SETTLE_MS = 800;
/** How often to look for other devices' changes while the app is open and online. */
const POLL_MS = 60_000;

/** A random id for this installation, made on first use. Not a hardware identifier, and cleared by Erase device. */
function deviceId(): string {
  try {
    const kept = localStorage.getItem(DEVICE_KEY);
    if (kept) return kept;
    const fresh = newId('dev-');
    localStorage.setItem(DEVICE_KEY, fresh);
    return fresh;
  } catch {
    return newId('dev-');
  }
}

export interface TaskEngine {
  /** What the engine is holding for the sync line; null when it is off or has not run yet. */
  summary: SyncSummary | null;
}

interface Options {
  accountId: string | null;
  online: boolean;
  tasks: PersonalTask[];
  /** Dispatches the engine's tasks into the store, which weaves them against the list as it is then. */
  apply: (tasks: PersonalTask[], known: string[], adopted: Record<string, string>) => void;
}

/**
 * Carries the student's tasks through the sync engine instead of the account's `state` blob — when, and only
 * when, this device has opted in (`lib/sync/engine/ownership.ts`). With the switch off this does nothing: no
 * database is opened, no request is made, nothing is read.
 *
 * Each pass is: adopt what the student has (queue the edits), send and take (when online), then weave what the
 * engine holds into the list. Passes run one at a time, a short while after the list settles, and on a timer
 * while the app is open.
 */
export function useTaskEngine({ accountId, online, tasks, apply }: Options): TaskEngine {
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [ready, setReady] = useState(0);
  const [tick, setTick] = useState(0);
  const sync = useRef<TaskSync | null>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const on = taskEngineOn() && cloudConfigured && !READ_ONLY && accountId !== null;

  useEffect(() => {
    if (!on || accountId === null) return;
    let gone = false;
    void (async () => {
      const db = await cloud();
      const store = await openEngineStore(idbSnapshotPort(accountId));
      const engine = new SyncEngine({
        store,
        transport: tasksTransport(supabaseTaskRows(db, accountId), { now: Date.now }),
        identity: { tenantId: 'self', userId: accountId, deviceId: deviceId() },
        now: Date.now,
        newId: () => newId('c-'),
      });
      await engine.recover();
      if (gone) return;
      sync.current = new TaskSync(engine, store);
      setReady((n) => n + 1);
    })().catch(() => undefined);
    return () => {
      gone = true;
      sync.current = null;
    };
  }, [on, accountId]);

  useEffect(() => {
    if (!on || !online) return;
    const t = setInterval(() => setTick((n) => n + 1), POLL_MS);
    return () => clearInterval(t);
  }, [on, online]);

  useEffect(() => {
    const ts = sync.current;
    if (!on || !ts) return;
    const timer = setTimeout(() => {
      chain.current = chain.current
        .then(async () => {
          await ts.adopt(tasks);
          // A failed sync is not an error to show: the engine keeps the work, labels it pending, and retries.
          if (online) await ts.syncOnce().catch(() => undefined);
          const held = await ts.tasks();
          apply(held, [...ts.knownIds], { ...ts.adoptedCopies });
          const next = await ts.summary();
          setSummary((was) => (JSON.stringify(was) === JSON.stringify(next) ? was : next));
        })
        .catch(() => undefined);
    }, SETTLE_MS);
    return () => clearTimeout(timer);
    // `apply` is the store's dispatch wrapper and is stable; `tasks` is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, ready, tick, tasks, online]);

  return { summary: on ? summary : null };
}
