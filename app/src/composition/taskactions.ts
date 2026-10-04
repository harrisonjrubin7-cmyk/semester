import { useEffect, useMemo, useRef, useState } from 'react';
import type { FeatureState } from '../intelligence/contracts';
import { EXPERIENCE_FLAGS } from '../lib/experience-flags';
import type { Action } from '../state/shape';
import { useNow, useStore } from '../state/store';
import { makeBridge, type Bridge } from './bridge';
import type { Domains } from './domains';
import type { StoreSnapshot } from './react';

/** What the reducer's `addTask` takes: a task before it has an id, a creation time or a state. */
export type NewTaskInput = Extract<Action, { type: 'addTask' }>['task'];

/**
 * Step 5: the four things a screen does to a task that the domain owns.
 *
 * Adding one, ticking it, moving it and deleting it. Thirteen screens used to
 * dispatch `addTask`, `toggleTask`, `moveTask`, `editTask` and `deleteTask`
 * themselves; now they ask for `add`, `toggle`, `reschedule` and `remove` and
 * this decides how. With `domainTasks` off that is the same dispatch as before,
 * byte for byte. At `production` it is the tasks domain's rules over the same
 * reducer, through the composition root's host.
 *
 * ## Why a tick is read from the live task, not from the button
 *
 * The button knows the task as it was drawn. Two quick presses would both say
 * "mark done", and the domain would then refuse the second as already done,
 * where the legacy toggle un-did it. A tick is a *toggle* to the person, so the
 * domain reads the task as the store holds it now, and presses are queued so
 * each one sees the last one's result.
 *
 * ## Why it never loses an action
 *
 * If the domain refuses for any reason but the task being gone, or throws, the
 * legacy dispatch runs and the refusal is said once. A person's tick should not
 * depend on a rule being right.
 *
 * A task with a repeat rule or steps is *added* by the legacy reducer: the
 * domain's `NewTask` carries neither. Ticking, moving and deleting one are the
 * domain's, because `lib/chores.tick` and `moveTask` already own what happens
 * to them.
 */

export interface TaskActions {
  /**
   * Add a task. The one door for it: nine screens used to dispatch `addTask`
   * each with its own copy of the fields. A task with a repeat rule or steps
   * goes to the legacy reducer, because the domain owns neither; the rest go
   * through the domain, which checks the title and the date.
   */
  add(task: NewTaskInput): void;
  /** Tick or un-tick, whichever the task is not. */
  toggle(id: string): void;
  /**
   * Move to a day, as `YYYY-MM-DD`, and optionally to a time of day as written
   * ("4:00 PM"). Leaving `time` out keeps the time the task has: dropping a task
   * on a month cell moves the day and nothing else.
   */
  reschedule(id: string, date: string, time?: string): void;
  /** Delete a task. Undo is the reducer's, and is unchanged: the same `deleteTask` reaches it. */
  remove(id: string): void;
}

export function makeTaskActions(
  domains: Domains | null,
  dispatch: (action: Action) => void,
  flag: FeatureState,
  log: (message: string) => void = (message) => console.warn(message),
): TaskActions {
  const legacy: TaskActions = {
    add: (task) => dispatch({ type: 'addTask', task }),
    toggle: (id) => dispatch({ type: 'toggleTask', id }),
    // `moveTask` either way: it is the one the undo table names, so a day-only move offers "Action moved" too.
    reschedule: (id, date, time) => dispatch({ type: 'moveTask', id, date, ...(time === undefined ? {} : { time }) }),
    remove: (id) => dispatch({ type: 'deleteTask', id }),
  };
  // No domains yet (they load lazily, and only for a build that switches them on): the legacy dispatch, which is what
  // every press did before.
  if (flag !== 'production' || domains === null) return legacy;

  // One at a time, so each press sees the store as the last one left it.
  let tail: Promise<void> = Promise.resolve();
  const enqueue = (job: () => Promise<void>) => {
    tail = tail.then(job).catch(() => undefined);
  };

  /**
   * Run a job; if the domain *throws* (a repository that could not find what it
   * had just written, say), say so once and do the legacy dispatch instead. A
   * refusal is handled inside each job; this is for the exception, which would
   * otherwise be swallowed by the queue and take the person's action with it.
   * Safe against doing it twice: the only awaits that can throw come before the
   * dispatch (the lookup) or after it has committed or timed out.
   */
  const orLegacy = (job: () => Promise<void>, fallback: () => void) =>
    enqueue(async () => {
      try {
        await job();
      } catch (error) {
        log(`[domainTasks] the domain threw (${error instanceof Error ? error.message : 'unknown'}); the legacy store took it`);
        await viaLegacy(fallback);
      }
    });

  /** Run the legacy dispatch, and wait for it to land before the next press looks. */
  const viaLegacy = async (go: () => void) => {
    go();
    await domains.settled();
  };

  /** `not_found` is a task that went away between the draw and the press: nothing to do, and not a refusal. */
  const refused = (result: { ok: boolean; error?: { kind: string } }) => !result.ok && result.error?.kind !== 'not_found';

  return {
    add: (task) =>
      orLegacy(async () => {
        if (task.repeat !== undefined || (task.steps?.length ?? 0) > 0) return viaLegacy(() => legacy.add(task));
        const added = await domains.tasks.add({
          title: task.title,
          dueOn: task.date,
          courseId: task.courseId,
          time: task.time,
          note: task.note,
          origin: task.from ?? null,
        });
        if (!added.ok) {
          // The screens have no place to show a refusal, and losing somebody's task is worse than
          // storing one the domain would have questioned. It is said once, where a developer sees it.
          log(`[domainTasks] the domain refused an add (${added.error.code}); the legacy store took it`);
          await viaLegacy(() => legacy.add(task));
        }
      }, () => legacy.add(task)),
    toggle: (id) =>
      orLegacy(async () => {
        const done = await domains.tasks.toggle(id);
        if (refused(done)) await viaLegacy(() => legacy.toggle(id));
      }, () => legacy.toggle(id)),
    reschedule: (id, date, time) =>
      orLegacy(async () => {
        const moved = await domains.tasks.reschedule(id, date, time);
        if (refused(moved)) await viaLegacy(() => legacy.reschedule(id, date, time));
      }, () => legacy.reschedule(id, date, time)),
    remove: (id) =>
      orLegacy(async () => {
        const gone = await domains.tasks.remove(id);
        if (refused(gone)) await viaLegacy(() => legacy.remove(id));
      }, () => legacy.remove(id)),
  };
}

/**
 * The domains for a caller that only writes tasks, loaded when the flag asks for them.
 *
 * **Not imported at the top of this file.** `composition/domains.ts` pulls in
 * every slice and its legacy adapters, about 30 KB, and this hook sits in the
 * shell (`QuickAdd`, `BreakItUp`, `UnityLayer`), so a static import put that on
 * the first load of every build, flag on or off. A build without the flag never
 * fetches it; a build with it fetches it once, and until it arrives a press takes
 * the legacy path, which is the safe one. The snapshot has no grants or choices:
 * `today` is not asked for here and its ranking inputs are empty by construction.
 */
function useTaskDomains(enabled: boolean): Domains | null {
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
  const bridge = useRef<Bridge<StoreSnapshot> | null>(null);
  const latest = useRef({ snapshot, dispatch: store.dispatch });
  const [domains, setDomains] = useState<Domains | null>(null);

  // After every commit: publish what is on screen, and release anyone waiting for it.
  useEffect(() => {
    latest.current = { snapshot, dispatch: store.dispatch };
    bridge.current?.sync(snapshot, store.dispatch);
  });

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void Promise.all([import('./domains'), import('./react')]).then(([{ composeDomains }, { hostOver }]) => {
      if (!live) return;
      const made = makeBridge(latest.current.snapshot, latest.current.dispatch);
      bridge.current = made;
      setDomains(composeDomains(hostOver(made.read, made.send, made.settled)));
    });
    return () => {
      live = false;
    };
  }, [enabled]);

  return enabled ? domains : null;
}

export function useTaskActions(flag: FeatureState = EXPERIENCE_FLAGS.domainTasks): TaskActions {
  const domains = useTaskDomains(flag === 'production');
  const { dispatch } = useStore();
  return useMemo(() => makeTaskActions(domains, dispatch, flag), [domains, dispatch, flag]);
}
