import { useMemo } from 'react';
import type { Domains } from '../domains/composition';
import type { FeatureState } from '../intelligence/contracts';
import { EXPERIENCE_FLAGS } from '../lib/experience-flags';
import { useDomains } from './domains';
import type { Action } from './shape';
import { useStore } from './store';

/**
 * Step 5: the two things a screen does to a task that the domain owns.
 *
 * Ticking a task and moving it to another day. The screens used to dispatch
 * `toggleTask` and `editTask` themselves; now they ask for `toggle` and
 * `reschedule` and this decides how. With `domainTasks` off, or for a repeating
 * task, that is the same dispatch as before, byte for byte. At `production` it
 * is the domain's rules over the same reducer.
 *
 * ## Why a tick is read from the live task, not from the button
 *
 * The button knows the task as it was drawn. Two quick presses would both say
 * "mark done", and the domain would then refuse the second as already done —
 * where the legacy toggle un-did it. A tick is a *toggle* to the person, so the
 * intent is taken from the task as the store holds it now, and presses are
 * queued so each one sees the last one's result.
 *
 * ## Why a repeating task still goes to the legacy reducer
 *
 * Ticking one moves it to its next date rather than finishing it, and
 * `lib/repeat.ts` owns that. The domain says so (`unsupported`) rather than
 * guessing; here it is simply never asked.
 *
 * ## Why it never loses a tick
 *
 * If the domain refuses for any reason but the task being gone, the legacy
 * dispatch runs. A person's tick should not depend on a rule being right.
 */

export interface TaskActions {
  /** Tick or un-tick, whichever the task is not. */
  toggle(id: string): void;
  /** Move to a day, as `YYYY-MM-DD`. */
  reschedule(id: string, date: string): void;
}

export function makeTaskActions(domains: Domains, dispatch: (action: Action) => void, flag: FeatureState): TaskActions {
  const legacy: TaskActions = {
    toggle: (id) => dispatch({ type: 'toggleTask', id }),
    reschedule: (id, date) => dispatch({ type: 'editTask', id, patch: { date } }),
  };
  if (flag !== 'production') return legacy;

  // One at a time, so each press sees the store as the last one left it.
  let tail: Promise<void> = Promise.resolve();
  const enqueue = (job: () => Promise<void>) => {
    tail = tail.then(job).catch(() => undefined);
  };

  /** Run the legacy dispatch, and wait for it to land before the next press looks. */
  const viaLegacy = async (go: () => void) => {
    go();
    await domains.settled();
  };

  const find = async (id: string) => {
    const listed = await domains.tasks.list();
    return listed.ok ? listed.value.find((t) => t.id === id) : undefined;
  };

  return {
    toggle: (id) =>
      enqueue(async () => {
        const task = await find(id);
        if (!task) return; // gone since it was drawn
        if (task.repeats) return viaLegacy(() => legacy.toggle(id));
        const done = await (task.state === 'done' ? domains.tasks.reopen(id) : domains.tasks.complete(id));
        if (!done.ok && done.error.code !== 'not_found') await viaLegacy(() => legacy.toggle(id));
      }),
    reschedule: (id, date) =>
      enqueue(async () => {
        const task = await find(id);
        if (!task) return;
        if (task.repeats) return viaLegacy(() => legacy.reschedule(id, date));
        const moved = await domains.tasks.reschedule(id, date);
        if (!moved.ok && moved.error.code !== 'not_found') await viaLegacy(() => legacy.reschedule(id, date));
      }),
  };
}

export function useTaskActions(flag: FeatureState = EXPERIENCE_FLAGS.domainTasks): TaskActions {
  const domains = useDomains();
  const { dispatch } = useStore();
  return useMemo(() => makeTaskActions(domains, dispatch, flag), [domains, dispatch, flag]);
}
