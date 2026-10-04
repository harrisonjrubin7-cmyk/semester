import { useEffect, useMemo, useState } from 'react';
import { blocksFor, type Catalog } from '../data/catalog';
import type { LegacyRankingInput } from '../domains/today/adapters';
import { ACTIONS_PREFIX, EMPTY_ACTION_CHOICES, readActionChoices, type Choice } from '../lib/actions';
import { useMyCapabilities, type Grant } from '../lib/capabilities';
import { useDeviceLibrary } from '../lib/device-library';
import { useOfficeActions } from '../lib/office-actions.hook';
import type { OfficeAction } from '../lib/office-actions';
import { useRegistrationPlan } from '../lib/registration-plan';
import { datedItems, lengthOf, upcomingItems } from '../lib/select';
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
  /** Registration Day Mode, as the Action Center reads it. Absent when not surfaced. */
  readonly registration?: LegacyRankingInput['registration'];
  /** The campus office feed as fetched; `null` while loading, signed out, or failed. */
  readonly office?: readonly OfficeAction[] | null;
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
export function hostOver(read: () => StoreSnapshot, dispatch: (action: Action) => void, settled?: () => Promise<void>): LegacyHost {
  return {
    settled,
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
    taskCommands: {
      add: (task) => dispatch({ type: 'addTask', task }),
      move: (id, date, time) => dispatch({ type: 'moveTask', id, date, ...(time === undefined ? {} : { time }) }),
      remove: (id) => dispatch({ type: 'deleteTask', id }),
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
    // The sample's classes are not the student's until they say so — the rule
    // `TodayActionCenter` applies to the rows it draws.
    classes: (date) => {
      const s = read();
      const own = s.state.courses.map((c) => c.course.id);
      return blocksFor(s.catalog, date)
        .filter((b) => !s.state.sample || !b.c || own.includes(b.c))
        .map((block) => ({ block, minutes: lengthOf(s.catalog, block) }));
    },
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
        registration: s.registration,
        office: s.office,
      };
    },
  };
}

/**
 * The composed domains, over the live store.
 *
 * Stable across renders: the object is built once and reads the latest
 * snapshot through a bridge, so it is safe in an effect's dependency list and
 * never re-creates a use case because the clock ticked.
 *
 * Not called by any screen yet (phase 1). Today's ranking here covers
 * `todayActions` only; `TodayActionCenter` also ranks registration and campus
 * office actions, so phase 2's shadow comparison is expected to show those as
 * its first differences.
 */
export interface DomainOptions {
  /** Registration Day Mode is surfaced (the flag and the mode's own gate, as `TodayDecisionSurface` computes it). */
  readonly registrationDay?: boolean;
  /** The office feed is enabled. Without `officeList`, the hook fetches it itself. */
  readonly officeActions?: boolean;
  readonly officeAccountId?: string | null;
  /**
   * The feed, when the caller already holds it. Then nothing is fetched here:
   * `TodayShadow` is handed the Action Center's own, so shadowing costs no
   * second request to the account.
   */
  readonly officeList?: readonly OfficeAction[] | null;
}

/** A write the store ignored (a dispatch that changes nothing never commits) must not hang its caller. */
const SETTLE_TIMEOUT_MS = 1000;

function makeBridge(first: StoreSnapshot, firstDispatch: (a: Action) => void) {
  let snapshot = first;
  let dispatch = firstDispatch;
  let waiting: (() => void)[] = [];
  return {
    sync(next: StoreSnapshot, nextDispatch: (a: Action) => void) {
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

export function useDomains(platform: Platform = defaultPlatform, options: DomainOptions = {}): Domains {
  const store = useStore();
  const now = useNow();
  const grants = useMyCapabilities();
  const accountId = store.account?.id ?? null;
  const library = useDeviceLibrary(`${ACTIONS_PREFIX}:${accountId || 'device'}`, readActionChoices, EMPTY_ACTION_CHOICES);
  const plan = useRegistrationPlan();
  const own = useOfficeActions(options.officeList === undefined && !!options.officeActions, options.officeAccountId);
  const office = options.officeList !== undefined ? options.officeList : own.state.kind === 'ready' ? own.state.actions : null;

  const snapshot: StoreSnapshot = {
    state: store.state,
    catalog: store.catalog,
    accountId,
    schoolId: store.school.id,
    now,
    grants,
    choices: library.value.choices,
    registration: { active: !!options.registrationDay, data: plan.data, cart: plan.cart, catalog: plan.catalog },
    office,
  };
  return useBridgedDomains(snapshot, platform);
}

/**
 * The composed domains over a snapshot, through a bridge the host reads.
 *
 * The bridge lives as long as the component and is synced after each commit;
 * the host's closures run later, when a use case does, never during render, so
 * they see the latest committed snapshot.
 */
function useBridgedDomains(snapshot: StoreSnapshot, platform: Platform): Domains {
  const { dispatch } = useStore();
  const [bridge] = useState(() => makeBridge(snapshot, dispatch));
  useEffect(() => {
    bridge.sync(snapshot, dispatch);
  });
  return useMemo(() => composeDomains(hostOver(bridge.read, bridge.send, bridge.settled), platform), [bridge, platform]);
}

/**
 * The domains for a caller that only writes tasks.
 *
 * `useDomains` also reads the capability grants, the device library, the
 * registration plan and the office feed, because Today's ranking needs them.
 * A task row needs none of that, and one of these sits in every screen that
 * adds or ticks a task, so this builds the same snapshot without them. **Do not
 * ask it for `today`**: its ranking inputs are empty by construction.
 */
export function useTaskDomains(platform: Platform = defaultPlatform): Domains {
  const store = useStore();
  const now = useNow();
  const snapshot: StoreSnapshot = {
    state: store.state,
    catalog: store.catalog,
    accountId: store.account?.id ?? null,
    schoolId: store.school.id,
    now,
    grants: [],
    choices: {},
  };
  return useBridgedDomains(snapshot, platform);
}
