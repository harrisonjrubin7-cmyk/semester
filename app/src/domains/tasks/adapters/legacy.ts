import { tick } from '../../../lib/chores';
import { nextAfter } from '../../../lib/repeat';
import type { PersonalTask } from '../../../lib/types';
import type { NewTask, Task } from '../domain/task';
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

/** What the reducer's `addTask` takes: a `PersonalTask` before it has an id, a creation time or a state. */
export type NewLegacyTask = Omit<PersonalTask, 'id' | 'created' | 'done'>;

/**
 * The three legacy writes that `update` cannot express.
 *
 * `update` hands back a whole next list, which a host can only turn into
 * `editTask` patches. An add needs the reducer to mint the id and the
 * timestamp, a delete is `deleteTask` (with its undo), and a move is
 * `moveTask`, the one the undo table names so a drag offers "Action moved".
 * Each is one dispatch of the action the screens used to send themselves.
 */
export interface TaskCommands {
  add(task: NewLegacyTask): void;
  move(id: string, date: string, time?: string): void;
  remove(id: string): void;
}

/**
 * Resolves once the legacy store has committed what was just dispatched.
 *
 * `dispatch` only *schedules* the reducer, so a read straight afterwards still
 * sees the old list, and `create` would report that the store did not record a
 * task it was about to record. A test host has nothing to wait for.
 */
export type Settled = () => Promise<void>;

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
export function legacyTaskRepository(state: StateAccess<PersonalTask[]>, commands: TaskCommands, settled: Settled = async () => {}): TaskRepository {
  return {
    list: async () => state.read().map(toTask),
    find: async (id) => {
      const found = state.read().find((t) => t.id === id);
      return found ? toTask(found) : undefined;
    },
    apply: async (id, change) => {
      if (change.kind === 'reschedule') {
        // A new day is `moveTask`, so a move offers its undo as it always did. "Someday" has no day to move to.
        if (change.dueOn !== null) commands.move(id, change.dueOn, change.time);
        else state.update((all) => all.map((t) => (t.id === id ? { ...t, date: null, ...(change.time === undefined ? {} : { time: change.time }) } : t)));
        await settled();
        return;
      }
      state.update((all) =>
        all.map((t) => (t.id === id ? { ...t, ...tick(t, change.kind === 'complete') } : t)),
      );
      // Wait for the commit: the next press reads the store, and a read before it would repeat this one.
      await settled();
    },
    create: async (draft: NewTask) => {
      const known = new Set(state.read().map((t) => t.id));
      commands.add({
        title: draft.title,
        date: draft.dueOn,
        time: draft.time,
        note: draft.note,
        courseId: draft.courseId,
        ...(draft.origin !== null ? { from: draft.origin } : {}),
      });
      await settled();
      const added = state.read().find((t) => !known.has(t.id));
      if (!added) throw new Error('The legacy store did not record the new entry.');
      return toTask(added);
    },
    remove: async (id) => {
      commands.remove(id);
      await settled();
    },
  };
}
