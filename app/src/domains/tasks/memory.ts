import type { Task } from './model';
import type { TaskRepository } from './ports';

/**
 * A repository that keeps tasks in an array.
 *
 * It exists for tests, and for the day a screen wants to try the domain with no
 * storage at all. It is not exported from the domain's `index.ts`: production
 * code gets its repository from the composition root, never from here.
 */
export function memoryTaskRepository(seed: readonly Task[] = []): TaskRepository & { snapshot(): readonly Task[] } {
  let tasks = [...seed];
  let counter = 0;
  return {
    async get(id) {
      return tasks.find((t) => t.id === id) ?? null;
    },
    async list() {
      return [...tasks];
    },
    async remove(id) {
      tasks = tasks.filter((t) => t.id !== id);
    },
    async save(task) {
      tasks = tasks.map((t) => (t.id === task.id ? task : t));
    },
    async create(draft) {
      const task: Task = {
        id: `mem-${++counter}`,
        state: 'open',
        repeats: false,
        title: draft.title,
        dueOn: draft.dueOn,
        courseId: draft.courseId,
        time: draft.time,
      };
      tasks = [...tasks, task];
      return task;
    },
    snapshot: () => tasks,
  };
}
