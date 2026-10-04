import { useEffect, useMemo, useRef } from 'react';
import type { Catalog } from '../data/catalog';
import { ACTIONS_PREFIX, EMPTY_ACTION_CHOICES, readActionChoices, type Choice } from '../lib/actions';
import { useMyCapabilities, type Grant } from '../lib/capabilities';
import { useDeviceLibrary } from '../lib/device-library';
import { datedItems, upcomingItems } from '../lib/select';
import { ownedScope } from '../lib/standing';
import { pathSnapshot } from '../lib/today-decision';
import type { PersonalTask } from '../lib/types';
import { useNow, useStore, type Action, type State } from '../state/store';
import { composeDomains, defaultPlatform, type Domains, type LegacyHost, type Platform } from './domains';

/**
 * The legacy store, as a `LegacyHost`.
 *
 * Two pieces so the part that matters can be tested without React:
 * `hostOver` is a plain function of "what the store holds right now" and
 * "how to dispatch", and `useDomains` is the thin hook that supplies both.
 */

/** Everything the host reads from the store, at one moment. */
export interface StoreSnapshot {
  readonly state: State;
  readonly catalog: Catalog;
  readonly accountId: string | null;
  readonly schoolId: string;
  readonly now: Date;
  readonly grants: readonly Grant[];
  /** What the student has snoozed or dismissed on Today, from the device library. */
  readonly choices: Record<string, Choice>;
}

/** The fields of `next` that differ from `current`: the `patch` an `editTask` action carries. */
function patchOf(current: PersonalTask, next: PersonalTask): Partial<PersonalTask> {
  const patch: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(current), ...Object.keys(next)])) {
    const a = (current as unknown as Record<string, unknown>)[key];
    const b = (next as unknown as Record<string, unknown>)[key];
    if (a !== b) patch[key] = b;
  }
  return patch as Partial<PersonalTask>;
}

/**
 * Build a host over a snapshot reader and a dispatcher.
 *
 * **Writes go through the reducer**, as every legacy write does, so persistence,
 * sync and the unpushed-edits flag see them. The tasks adapter hands over a
 * whole next list computed with `lib/chores.tick`; this turns it back into the
 * `editTask` patches the reducer already understands. The reducer's own
 * `toggleTask` is `{ ...t, ...tick(t, !t.done) }`, so the two paths produce the
 * same record (held by `react.test.ts`, case by case).
 *
 * Reads call `read()` each time rather than closing over a snapshot, so a
 * use case that runs after a dispatch sees the state that dispatch made.
 */
export function hostOver(read: () => StoreSnapshot, dispatch: (action: Action) => void): LegacyHost {
  return {
    identity: () => {
      const s = read();
      return { role: s.state.role, userId: s.accountId, schoolId: s.schoolId, grants: s.grants };
    },
    tasks: {
      read: () => read().state.tasks,
      update: (change) => {
        const current = read().state.tasks;
        const next = change(current);
        const before = new Map(current.map((t) => [t.id, t]));
        for (const t of next) {
          const was = before.get(t.id);
          if (!was || was === t) continue;
          const patch = patchOf(was, t);
          if (Object.keys(patch).length) dispatch({ type: 'editTask', id: t.id, patch } as Action);
        }
      },
    },
    appointments: () => read().state.appointments,
    // The sample's deadlines are not the student's until they say so: the same
    // `ownedScope` the Action Center applies, so the two never disagree on which.
    deadlines: () => {
      const s = read();
      const own = s.state.courses.map((c) => c.course.id);
      return ownedScope(datedItems(s.catalog, s.now), own, s.state.sample, s.catalog.empty).items;
    },
    isDone: (id) => read().state.done[id] === true,
    ranking: () => {
      const s = read();
      const own = s.state.courses.map((c) => c.course.id);
      const scope = ownedScope(upcomingItems(s.catalog, s.now), own, s.state.sample, s.catalog.empty);
      const at = s.now.getTime();
      return {
        input: {
          path: pathSnapshot(s.state.requirements, s.state.taken),
          upcoming: scope.items,
          done: s.state.done,
          reviewDue: Object.values(s.state.reviews).filter((r) => r.due <= at).length,
          catalogEmpty: scope.empty,
        },
        choices: s.choices,
      };
    },
  };
}

/**
 * The composed domains, over the live store.
 *
 * Stable across renders: the object is built once and reads the latest
 * snapshot through a ref, so it is safe in an effect's dependency list and
 * never re-creates a use case because the clock ticked.
 *
 * Not called by any screen yet (phase 1). Today's ranking here covers
 * `todayActions` only; `TodayActionCenter` also ranks registration and campus
 * office actions, so phase 2's shadow comparison is expected to show those as
 * its first differences.
 */
export function useDomains(platform: Platform = defaultPlatform): Domains {
  const store = useStore();
  const now = useNow();
  const grants = useMyCapabilities();
  const accountId = store.account?.id ?? null;
  const library = useDeviceLibrary(`${ACTIONS_PREFIX}:${accountId || 'device'}`, readActionChoices, EMPTY_ACTION_CHOICES);

  const snapshot: StoreSnapshot = {
    state: store.state,
    catalog: store.catalog,
    accountId,
    schoolId: store.school.id,
    now,
    grants,
    choices: library.value.choices,
  };
  const latest = useRef(snapshot);
  const dispatch = useRef(store.dispatch);
  useEffect(() => {
    latest.current = snapshot;
    dispatch.current = store.dispatch;
  });

  return useMemo(() => composeDomains(hostOver(() => latest.current, (a) => dispatch.current(a)), platform), [platform]);
}
