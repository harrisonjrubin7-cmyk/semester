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
 * ## The switch
 *
 * A device-local opt-in, off unless set, for dogfooding one device at a time. It is not a `FLAGS` entry or a
 * `VITE_` module flag yet: those carry a rollout plan, a kill switch, a deploy-workflow variable and a review
 * date, and are added when this leaves one person's device — a follow-up, not an oversight. Turning it off puts
 * the old half back in charge of the tasks this device holds; the rows the engine wrote stay in the table,
 * unread. `Erase from this device` clears it, as it clears every `semester.` key.
 */
export const OWNS_TASKS_KEY = 'semester.engine.tasks';

export function taskEngineOn(): boolean {
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
