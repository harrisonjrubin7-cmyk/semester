import { tick } from '../../../lib/chores';
import { nextAfter } from '../../../lib/repeat';
import type { PersonalTask } from '../../../lib/types';
import type { Task } from '../domain/task';
import type { TaskRepository } from '../application/ports';

/**
 * A handle on a piece of legacy state, as narrow as the adapter needs.
 *
 * The legacy store is a React context; this is what the composition root
 * passes in so the adapter never imports it. A test passes an array in a
 * variable.
 */
export interface StateAccess<T> {
  read(): T;
  update(change: (current: T) => T): void;
}

/** The legacy record as a domain `Task`. Loses nothing the domain reads; the rest is never copied out. */
export function toTask(t: PersonalTask): Task {
  return {
    id: t.id,
    title: t.title,
    dueOn: t.date,
    done: t.done,
    rollsTo: t.repeat && t.date ? (nextAfter(t.date, t.repeat, t.date) ?? null) : null,
  };
}

/**
 * Tasks as the legacy app keeps them.
 *
 * `apply` does not write fields. It asks `lib/chores.tick` for the patch, the
 * function the Tasks screen already uses, and merges that. The domain has
 * decided *that* a task is ticked and *where it rolls to*; how a tick changes
 * a record — clearing a repeating task's steps, for one — is legacy knowledge
 * that stays there until the screen that owns it is retired. `tasks.test.ts`
 * holds the two answers to each other.
 */
export function legacyTaskRepository(state: StateAccess<PersonalTask[]>): TaskRepository {
  return {
    list: async () => state.read().map(toTask),
    find: async (id) => {
      const found = state.read().find((t) => t.id === id);
      return found ? toTask(found) : undefined;
    },
    apply: async (id, change) => {
      state.update((all) =>
        all.map((t) => (t.id === id ? { ...t, ...tick(t, change.kind === 'complete') } : t)),
      );
    },
  };
}
