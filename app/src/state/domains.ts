import { useLayoutEffect, useMemo, useRef } from 'react';
import { createDomains, type Clock, type Domains, type LegacyHost } from '../domains/composition';
import { dateToIso } from '../lib/date';
import { READ_ONLY } from '../lib/readonly';
import { datedItems } from '../lib/select';
import { useNow, useStore } from './store';
import type { Action } from './shape';

/**
 * The domains, wired to the live store: step 2 of `docs/architecture/modular-monolith.md`.
 *
 * This is the only place `domains/composition.ts` meets React. It builds a
 * {@link LegacyHost} out of `useStore()` and hands back `createDomains`' answer.
 * No screen calls it yet; the cutover of Today is step 4.
 *
 * ## Why every field of the host reads a ref
 *
 * `useStore()` returns the state of *this render*. A host that captured it would
 * serve a list that is stale the moment anything is dispatched, and the services
 * are built once, not per render, so they would keep serving it. The refs are
 * assigned after each commit, so a call made from an event handler sees what is
 * on screen now.
 *
 * ## Why a write waits
 *
 * `dispatch` schedules the reducer; it does not run it. Straight after
 * `addTask` the ref still holds the old list, so the adapter could not find the
 * task it had just added. `settled()` resolves on the next commit, which is the
 * moment the ref holds the result, so a service call that resolves has really
 * been recorded. A second write started before the first commit would read the
 * old list; callers should await one write before starting the next.
 */

/** A write that never commits (a dispatch the store ignored) must not hang the caller. */
const SETTLE_TIMEOUT_MS = 1000;

/** The store's minute-quantised `now`, as the clock the domains are given. */
export function storeClock(now: () => Date): Clock {
  return {
    now: () => now().getTime(),
    local() {
      const d = now();
      return { day: dateToIso(d), minutes: d.getHours() * 60 + d.getMinutes() };
    },
  };
}

type Live = { store: ReturnType<typeof useStore>; now: Date };

/**
 * The host, built outside any component so nothing in it is created during a
 * render: it is handed the two refs themselves and only ever reads `.current`
 * when a service is called, from an event handler or a promise.
 */
function makeHost(live: { current: Live }, waiting: { current: (() => void)[] }): LegacyHost {
  return {
    person: () => ({
      accountId: live.current.store.account?.id ?? null,
      role: live.current.store.state.role,
      schoolId: live.current.store.state.schoolId,
    }),
    readOnly: () => READ_ONLY,
    tasks: {
      read: () => live.current.store.state.tasks,
      dispatch: (command) => live.current.store.dispatch(command as Action),
      settled: () =>
        new Promise<void>((resolve) => {
          waiting.current.push(resolve);
          setTimeout(resolve, SETTLE_TIMEOUT_MS);
        }),
    },
    appointments: () => live.current.store.state.appointments,
    deadlines: () => datedItems(live.current.store.catalog, live.current.now),
  };
}

function makeDomains(live: { current: Live }, waiting: { current: (() => void)[] }): Domains {
  return createDomains(makeHost(live, waiting), storeClock(() => live.current.now));
}

export function useDomains(): Domains {
  const store = useStore();
  const now = useNow();

  const live = useRef<Live>({ store, now });
  const waiting = useRef<(() => void)[]>([]);

  // After every commit: publish what is on screen, then release anyone waiting for it.
  useLayoutEffect(() => {
    live.current = { store, now };
    const release = waiting.current;
    waiting.current = [];
    for (const resolve of release) resolve();
  });

  // Built once: the host reads through `live`, so nothing here goes stale. The two refs are handed over
  // as objects and `.current` is only read when a service is called from a handler or a promise, never
  // during render, which is what this rule exists to catch.
  // oxlint-disable-next-line react/refs
  return useMemo(() => makeDomains(live, waiting), []);
}
