import { fail, ok, type Clock, type DomainError, type EventSink, type Result } from '../../../kernel';
import { complete, draftTask, isOverdue, openTasks, reopen, reschedule, type NewTask, type Task } from '../domain/task';
import type { Guard, TaskRepository } from './ports';

export interface TaskDeps {
  readonly tasks: TaskRepository;
  readonly guard: Guard;
  readonly clock: Clock;
  readonly events: EventSink;
}

export interface Completion {
  readonly taskId: string;
  /** `rolled` for a repeating task that moved on; `done` for one that is finished. */
  readonly outcome: 'done' | 'rolled';
  readonly rolledTo: string | null;
}

async function load(deps: TaskDeps, id: string, action: string): Promise<Result<Task, DomainError>> {
  const allowed = deps.guard(action);
  if (!allowed.ok) return allowed;
  const task = await deps.tasks.find(id);
  return task ? ok(task) : fail('not_found', 'tasks.not_found', 'That action is not in your list any more.');
}

/**
 * Tick a task. Ask, decide, apply, say so — in that order, and the order is the
 * point: nothing is written for a request that was refused, and nothing is
 * announced for a write that did not happen.
 */
export const completeTask = (deps: TaskDeps) => async (id: string): Promise<Result<Completion, DomainError>> => {
  const found = await load(deps, id, 'tasks.complete');
  if (!found.ok) return found;
  const change = complete(found.value);
  if (!change.ok) return change;
  if (change.value.kind !== 'complete') return fail('invariant', 'tasks.wrong_change', 'That action could not be completed.');
  await deps.tasks.apply(id, change.value);
  deps.events.publish({ type: 'tasks.completed', at: deps.clock.now(), payload: { taskId: id, rolledTo: change.value.rolledTo } });
  return ok({ taskId: id, outcome: change.value.rolledTo ? 'rolled' : 'done', rolledTo: change.value.rolledTo });
};

export const reopenTask = (deps: TaskDeps) => async (id: string): Promise<Result<{ taskId: string }, DomainError>> => {
  const found = await load(deps, id, 'tasks.reopen');
  if (!found.ok) return found;
  const change = reopen(found.value);
  if (!change.ok) return change;
  await deps.tasks.apply(id, change.value);
  deps.events.publish({ type: 'tasks.reopened', at: deps.clock.now(), payload: { taskId: id } });
  return ok({ taskId: id });
};

/** Tick or un-tick, whichever the task is not. The intent is read from the task as stored, not from the button. */
export const toggleTask = (deps: TaskDeps) => async (id: string): Promise<Result<{ taskId: string }, DomainError>> => {
  const allowed = deps.guard('tasks.read');
  if (!allowed.ok) return allowed;
  const task = await deps.tasks.find(id);
  if (!task) return fail('not_found', 'tasks.not_found', 'That action is not in your list any more.');
  const done = await (task.done ? reopenTask(deps)(id) : completeTask(deps)(id));
  return done.ok ? ok({ taskId: id }) : done;
};

/** Add a task. Ask, check the title and the day, store, say so. */
export const addTask = (deps: TaskDeps) => async (input: NewTask): Promise<Result<Task, DomainError>> => {
  const allowed = deps.guard('tasks.create');
  if (!allowed.ok) return allowed;
  const draft = draftTask(input);
  if (!draft.ok) return draft;
  const task = await deps.tasks.create(draft.value);
  deps.events.publish({ type: 'tasks.created', at: deps.clock.now(), payload: { taskId: task.id } });
  return ok(task);
};

/** Move a task to a day, and optionally a time. */
export const rescheduleTask = (deps: TaskDeps) => async (id: string, dueOn: string | null, time?: string): Promise<Result<{ taskId: string }, DomainError>> => {
  const found = await load(deps, id, 'tasks.reschedule');
  if (!found.ok) return found;
  const change = reschedule(found.value, dueOn, time);
  if (!change.ok) return change;
  await deps.tasks.apply(id, change.value);
  deps.events.publish({ type: 'tasks.rescheduled', at: deps.clock.now(), payload: { taskId: id, dueOn } });
  return ok({ taskId: id });
};

export const removeTask = (deps: TaskDeps) => async (id: string): Promise<Result<{ taskId: string }, DomainError>> => {
  const found = await load(deps, id, 'tasks.remove');
  if (!found.ok) return found;
  await deps.tasks.remove(id);
  deps.events.publish({ type: 'tasks.removed', at: deps.clock.now(), payload: { taskId: id } });
  return ok({ taskId: id });
};

export interface TaskList {
  readonly open: readonly Task[];
  readonly overdue: readonly Task[];
  readonly dueToday: readonly Task[];
}

/** What is left, soonest first, and which of it is late or due now. */
export const listTasks = (deps: Pick<TaskDeps, 'tasks' | 'guard' | 'clock'>) => async (): Promise<Result<TaskList, DomainError>> => {
  const allowed = deps.guard('tasks.read');
  if (!allowed.ok) return allowed;
  const today = deps.clock.today();
  const open = openTasks(await deps.tasks.list());
  return ok({
    open,
    overdue: open.filter((t) => isOverdue(t, today)),
    dueToday: open.filter((t) => t.dueOn === today),
  });
};
