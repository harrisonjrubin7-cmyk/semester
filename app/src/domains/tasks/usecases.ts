import { err, ok, type Clock, type DomainEvent, type Outcome, type Result } from '../kernel';
import type { Can, Obligation } from '../policy';
import { complete, reopen, reschedule, validateDueOn, validateTitle, type Task } from './model';
import type { TaskRepository } from './ports';

/**
 * The tasks application service: the only way anything outside this domain
 * changes a task.
 *
 * Every command does the same four things in the same order, and the order is
 * the point: ask the policy, load, apply the rule, store. A refusal at any step
 * stops there, so nothing is written for a person who may not write, and a
 * rule is never evaluated against a task that was not loaded.
 */

export interface AddTaskInput {
  title: string;
  dueOn?: string | null;
  courseId?: string | null;
  time?: string;
  note?: string;
  origin?: string | null;
}

export interface TaskServiceDeps {
  repo: TaskRepository;
  clock: Clock;
  can: Can;
}

export interface TaskService {
  add(input: AddTaskInput): Promise<Result<Outcome<Task, Obligation>>>;
  complete(id: string): Promise<Result<Outcome<Task, Obligation>>>;
  reopen(id: string): Promise<Result<Outcome<Task, Obligation>>>;
  reschedule(id: string, dueOn: string | null): Promise<Result<Outcome<Task, Obligation>>>;
  list(): Promise<Result<readonly Task[]>>;
}

export function createTaskService({ repo, clock, can }: TaskServiceDeps): TaskService {
  const event = (type: string, subject: string, data?: DomainEvent['data']): DomainEvent => ({
    type,
    at: clock.now(),
    subject,
    ...(data ? { data } : {}),
  });

  /** Permission, then load: the two steps every command to an existing task shares. */
  async function guarded(
    id: string,
    apply: (task: Task) => Result<Task>,
    name: string,
  ): Promise<Result<Outcome<Task, Obligation>>> {
    const decision = can('task.write');
    if (!decision.allow) return err('forbidden', decision.message, { reason: decision.reason });
    const task = await repo.get(id);
    if (!task) return err('not_found', 'That action isn’t in your list any more.', { id });
    const next = apply(task);
    if (!next.ok) return next;
    await repo.save(next.value);
    return ok({ value: next.value, events: [event(name, id)], obligations: decision.obligations });
  }

  return {
    async add(input) {
      const decision = can('task.write');
      if (!decision.allow) return err('forbidden', decision.message, { reason: decision.reason });
      const title = validateTitle(input.title);
      if (!title.ok) return title;
      const dueOn = validateDueOn(input.dueOn ?? null);
      if (!dueOn.ok) return dueOn;
      const task = await repo.create({
        title: title.value,
        dueOn: dueOn.value,
        courseId: input.courseId ?? null,
        time: input.time ?? '',
        note: input.note ?? '',
        origin: input.origin ?? null,
      });
      return ok({ value: task, events: [event('task.added', task.id)], obligations: decision.obligations });
    },
    complete: (id) => guarded(id, complete, 'task.completed'),
    reopen: (id) => guarded(id, reopen, 'task.reopened'),
    reschedule: (id, dueOn) => guarded(id, (task) => reschedule(task, dueOn), 'task.rescheduled'),
    async list() {
      const decision = can('task.read');
      if (!decision.allow) return err('forbidden', decision.message, { reason: decision.reason });
      return ok(await repo.list());
    },
  };
}
