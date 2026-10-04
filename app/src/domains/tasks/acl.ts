import { isIsoDate } from '../kernel';
import type { PersonalTask } from '../../lib/types';
import type { Task } from './model';
import type { TaskRepository } from './ports';

/**
 * Anti-corruption layer: the legacy `PersonalTask` and its reducer, as a `Task`
 * and a `TaskRepository`.
 *
 * The legacy shape is wider than the domain's, deliberately — it carries steps,
 * notes, a free-text time and a repeat rule that the slice does not own yet.
 * The mapping is therefore **lossy in one direction only**: reading drops what
 * the domain does not model, and writing never goes through a whole-object
 * replace. Every write is the narrowest legacy command that expresses it
 * (`toggleTask`, `editTask` with a one-field patch), so a task's steps and notes cannot be overwritten
 * by a domain that never saw them.
 *
 * A host provides {@link LegacyTaskHost}; the real one reads `useStore()` and
 * dispatches into the reducer, and the test drives the reducer directly.
 */

/** What the reducer's `addTask` takes: a `PersonalTask` before it has an id, a creation time or a state. */
export type NewLegacyTask = Omit<PersonalTask, 'id' | 'created' | 'done'>;

export type LegacyTaskCommand =
  | { type: 'addTask'; task: NewLegacyTask }
  | { type: 'toggleTask'; id: string }
  | { type: 'editTask'; id: string; patch: { date?: string | null; time?: string } }
  | { type: 'deleteTask'; id: string };

export interface LegacyTaskHost {
  /** The tasks as the legacy state holds them *now* (not as they were when the host was built). */
  read(): readonly PersonalTask[];
  dispatch(command: LegacyTaskCommand): void;
  /**
   * Resolves once the legacy store has committed what was just dispatched.
   *
   * Optional, because the reducer is synchronous and a test host has nothing to
   * wait for. A React host needs it: `dispatch` only *schedules* the reducer, so
   * a read straight afterwards still sees the old list, and `create` would
   * report that the store did not record a task it was about to record.
   */
  settled?(): Promise<void>;
}

export function taskFromLegacy(task: PersonalTask): Task {
  return {
    id: task.id,
    title: task.title,
    state: task.done ? 'done' : 'open',
    dueOn: task.date !== null && isIsoDate(task.date) ? task.date : null,
    courseId: task.courseId,
    time: task.time,
    repeats: task.repeat !== undefined,
  };
}

export function legacyTaskRepository(host: LegacyTaskHost): TaskRepository {
  return {
    async get(id) {
      const found = host.read().find((t) => t.id === id);
      return found ? taskFromLegacy(found) : null;
    },
    async list() {
      return host.read().map(taskFromLegacy);
    },
    async save(task) {
      const before = host.read().find((t) => t.id === task.id);
      if (!before) return;
      let wrote = false;
      // `toggleTask` flips, so it is only dispatched when the stored state differs.
      if ((before.done ? 'done' : 'open') !== task.state) {
        host.dispatch({ type: 'toggleTask', id: task.id });
        wrote = true;
      }
      // `editTask` rather than `moveTask`: only it can send a task back to "someday" (date null), and with a
      // one- or two-field patch it is the same write `moveTask` makes. Compared against the *mapped* date, so a
      // stored date the domain could not read is never rewritten.
      const patch: { date?: string | null; time?: string } = {};
      if (taskFromLegacy(before).dueOn !== task.dueOn) patch.date = task.dueOn;
      if (before.time !== task.time) patch.time = task.time;
      if (patch.date !== undefined || patch.time !== undefined) {
        host.dispatch({ type: 'editTask', id: task.id, patch });
        wrote = true;
      }
      if (wrote) await host.settled?.();
    },
    async remove(id) {
      if (!host.read().some((t) => t.id === id)) return;
      host.dispatch({ type: 'deleteTask', id });
      await host.settled?.();
    },
    async create(draft) {
      const known = new Set(host.read().map((t) => t.id));
      host.dispatch({
        type: 'addTask',
        task: {
          title: draft.title,
          date: draft.dueOn,
          time: draft.time,
          note: draft.note,
          courseId: draft.courseId,
          ...(draft.origin !== null ? { from: draft.origin } : {}),
        },
      });
      await host.settled?.();
      const added = host.read().find((t) => !known.has(t.id));
      if (!added) throw new Error('The legacy store did not record the new entry.');
      return taskFromLegacy(added);
    },
  };
}
