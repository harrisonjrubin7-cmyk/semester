import { MODULE_FLAGS, moduleOn } from '../../experience-flags';

/**
 * Which half of the sync owns the student's tasks — the old one, or the engine.
 *
 * Both cannot. Tasks have always travelled inside the `state` blob that `cloud.ts` pushes and merges, and the
 * engine carries them as rows of `public.tasks`. A task written through both would exist in two places with two
 * clocks, and every deletion would be a race between them: the blob's union merge cannot express a delete, so
 * the old half would put back what the engine removed. So while the engine owns tasks, the old half does not
 * take them back and does not count them in the base it compares against (`lib/deletions.ts` reads a task
 * missing from the account as a deletion, which is exactly the wrong thing). It does still *push* them, though:
 * a write-only mirror, so that a device on the same account that has not opted in keeps receiving tasks.
 *
 * ## Two switches, and both must be on
 *
 * 1. **The build's module flag**, `offline_engine_tasks` (`VITE_OFFLINE_ENGINE_TASKS`, off unless set, like every
 *    module flag — `lib/experience-flags.ts`). It decides whether this build has the feature at all. It is the
 *    rollback: set it back to `off` and the next build returns every device to the account sync. Nothing is lost
 *    by that, because the old half has pushed the task list in its blob all along (the write-only mirror below),
 *    so it resumes from a list that is current. (A task *deleted* while the engine was on can reappear on a
 *    device that had not opted in: the old merge keeps no record of a deletion it never saw.) The rows the
 *    engine wrote stay in `public.tasks`, unread.
 * 2. **This device's own opt-in**, `semester.engine.tasks = on`. The mirror is one-way — edits made to tasks on a
 *    device that has not opted in do not reach one that has — so a person turns the engine on per device, knowing
 *    that. `Erase from this device` clears it, as it clears every `semester.` key.
 *
 * Either one off and every call site here receives the very same object it always did.
 */
export const OWNS_TASKS_KEY = 'semester.engine.tasks';

export function taskEngineOn(): boolean {
  if (!moduleOn(MODULE_FLAGS.offline_engine_tasks)) return false;
  try {
    return localStorage.getItem(OWNS_TASKS_KEY) === 'on';
  } catch {
    return false;
  }
}

export function setTaskEngine(on: boolean): void {
  try {
    if (on) localStorage.setItem(OWNS_TASKS_KEY, 'on');
    else localStorage.removeItem(OWNS_TASKS_KEY);
  } catch {
    // Storage is off (a private window): nothing was owned, and nothing now is.
  }
}

/**
 * What the old half is allowed to see of a persisted object.
 *
 * Returns the same object — not a copy — when the engine is not in charge, so every caller that routes through
 * here is, with the switch off, exactly the code it was before.
 */
export function forLegacy<T extends Record<string, unknown>>(persisted: T): T {
  if (!taskEngineOn() || !('tasks' in persisted)) return persisted;
  const { tasks: _tasks, ...rest } = persisted;
  return rest as T;
}

/** The same for the base `lib/conflicts.ts` keeps, whose keys are `tasks/<id>`. */
export function baseForLegacy<T extends Record<string, string> | null>(base: T): T {
  if (!base || !taskEngineOn()) return base;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(base)) if (!k.startsWith('tasks/')) out[k] = v;
  return out as T;
}
