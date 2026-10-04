import { defineMachine, err, isIsoDate, ok, send, type IsoDate, type Result } from '../kernel';

/**
 * A task: something the person decided to do, which is either still ahead or done.
 *
 * Three rules live here and nowhere else.
 *
 * 1. **A task has a title.** Trimmed, non-empty, at most {@link TITLE_LIMIT}.
 * 2. **A date, when there is one, is a real day.** `2026-02-30` is a refusal, not a value.
 * 3. **A task moves through a machine.** `open` becomes `done` by completing and
 *    back by reopening; anything else is an `invalid_transition`, so "complete a
 *    task that is already complete" is a visible no-op the screen can word,
 *    rather than a toggle that quietly un-does it. (The legacy reducer's
 *    `toggleTask` does the latter; this is the difference the slice exists to show.)
 *
 * What a task does *not* know: where it is stored, who may touch it, what a
 * calendar looks like. Those arrive as ports, a policy and a read model.
 */

export const TITLE_LIMIT = 200;

export const TASK_STATES = ['open', 'done'] as const;
export type TaskState = (typeof TASK_STATES)[number];
export type TaskEvent = 'complete' | 'reopen';

export const TASK_MACHINE = defineMachine<TaskState, TaskEvent>({
  type: 'task',
  initial: 'open',
  on: {
    open: { complete: 'done' },
    done: { reopen: 'open' },
  },
});

export interface Task {
  readonly id: string;
  readonly title: string;
  readonly state: TaskState;
  /** The day it is meant for. Null is "someday". */
  readonly dueOn: IsoDate | null;
  readonly courseId: string | null;
  /**
   * When in the day, as the person wrote it ("6:30 PM", "before work"). Free
   * text, shown as written and never parsed — the legacy rule on
   * `PersonalTask.time`. Empty is "no time".
   */
  readonly time: string;
  /**
   * Whether a rule brings it back. The slice does not own repetition — the
   * legacy engine in `lib/repeat.ts` does — so a repeating task is readable
   * here and refused for writes, which is the honest edge of the boundary.
   */
  readonly repeats: boolean;
}

export function validateTitle(raw: string): Result<string> {
  const title = raw.trim();
  if (title === '') return err('validation', 'Give the action a name first.', { field: 'title' });
  if (title.length > TITLE_LIMIT) {
    return err('validation', `Keep the name under ${TITLE_LIMIT} characters.`, { field: 'title', limit: TITLE_LIMIT });
  }
  return ok(title);
}

export function validateDueOn(value: string | null): Result<IsoDate | null> {
  if (value === null) return ok(null);
  return isIsoDate(value) ? ok(value) : err('validation', 'That isn’t a day on the calendar.', { field: 'dueOn' });
}

const refuseRepeat = (task: Task): Result<Task> | null =>
  task.repeats
    ? err('unsupported', 'Repeating actions are still handled by the older list. Change it there for now.', {
        reason: 'legacy_owns_repetition',
        id: task.id,
      })
    : null;

export function complete(task: Task): Result<Task> {
  const refused = refuseRepeat(task);
  if (refused) return refused;
  const next = send(TASK_MACHINE, task.state, 'complete');
  return next.ok ? ok({ ...task, state: next.value }) : next;
}

export function reopen(task: Task): Result<Task> {
  const refused = refuseRepeat(task);
  if (refused) return refused;
  const next = send(TASK_MACHINE, task.state, 'reopen');
  return next.ok ? ok({ ...task, state: next.value }) : next;
}

/** `time` is optional: leaving it out keeps the time the task has, as dropping a task on a month cell does. */
export function reschedule(task: Task, dueOn: string | null, time?: string): Result<Task> {
  const refused = refuseRepeat(task);
  if (refused) return refused;
  const day = validateDueOn(dueOn);
  if (!day.ok) return day;
  return ok({ ...task, dueOn: day.value, ...(time === undefined ? {} : { time }) });
}

/** Whether a task is still ahead of the person on `today`: open, and dated today or earlier. */
export const isOverdue = (task: Task, today: IsoDate): boolean =>
  task.state === 'open' && task.dueOn !== null && task.dueOn < today;

export const isDueOn = (task: Task, day: IsoDate): boolean => task.state === 'open' && task.dueOn === day;
