import { transition, type WorkflowDefinition } from '@semester/institution';
import { fail, ok, type DomainError, type Result } from '../../../kernel';

/**
 * A thing the student has to do, as the domain sees it.
 *
 * Deliberately smaller than the legacy `PersonalTask`, which also carries a
 * note, steps, a free-text time and a repeat rule. The domain holds what its
 * rules read. What it does not hold stays where it is, in the legacy record,
 * and the adapter changes only the fields a decision touches — so a rule
 * written here cannot lose a field it never knew about.
 */
export interface Task {
  readonly id: string;
  readonly title: string;
  /** `YYYY-MM-DD`, or `null` for "someday". */
  readonly dueOn: string | null;
  readonly done: boolean;
  /**
   * The day a repeating task moves to when it is ticked, or `null` if it does
   * not repeat or its rule has run out. Worked out by whoever knows the rule
   * (`adapters/`), because the rule is not the domain's to re-implement.
   */
  readonly rollsTo: string | null;
}

export type TaskState = 'open' | 'done';

/**
 * The lifecycle, as ADR 0009 says a consequential workflow should be written:
 * every state, every legal move, one definition the tests can walk.
 *
 * Not terminal: a ticked task can be un-ticked, which is the plain checkbox
 * everyone expects. A repeating task's "done" means its series has ended, and
 * a rolled task is simply still `open` with a later date — see `complete`.
 */
export const TASK_LIFECYCLE: WorkflowDefinition<TaskState> = {
  type: 'personal_task',
  initial: 'open',
  terminal: [],
  transitions: { open: ['done'], done: ['open'] },
  exceptional: [],
};

export const stateOf = (task: Task): TaskState => (task.done ? 'done' : 'open');

/** What happened to a task, for a repository to apply and an event to report. */
export type TaskChange =
  | { readonly kind: 'complete'; readonly rolledTo: string | null }
  | { readonly kind: 'reopen' };

/**
 * Tick a task.
 *
 * A repeating one with days left is not finished: it moves forward and stays
 * open, which is what `lib/chores.tick` has always done. Anything else is
 * finished. Ticking what is already done is a conflict, not a no-op, because
 * a caller that thinks it is completing something should find out it is not.
 */
export function complete(task: Task): Result<TaskChange, DomainError> {
  const move = transition(TASK_LIFECYCLE, stateOf(task), 'done');
  if (!move.ok) return fail('conflict', 'tasks.already_done', 'That action is already done.');
  return ok({ kind: 'complete', rolledTo: task.rollsTo });
}

export function reopen(task: Task): Result<TaskChange, DomainError> {
  const move = transition(TASK_LIFECYCLE, stateOf(task), 'open');
  if (!move.ok) return fail('conflict', 'tasks.not_done', 'That action is not done, so there is nothing to reopen.');
  return ok({ kind: 'reopen' });
}

/** Open tasks, soonest first, undated last, ties by title so the order does not shuffle between renders. */
export function openTasks(tasks: readonly Task[]): Task[] {
  return tasks
    .filter((t) => !t.done)
    .sort((a, b) => (a.dueOn ?? '9999-99-99').localeCompare(b.dueOn ?? '9999-99-99') || a.title.localeCompare(b.title));
}

/** Open and dated before `day`. A task due on `day` itself is due, not late. */
export const isOverdue = (task: Task, day: string): boolean => !task.done && task.dueOn !== null && task.dueOn < day;
