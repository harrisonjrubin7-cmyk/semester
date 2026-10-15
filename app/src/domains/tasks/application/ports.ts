import type { NewTask, TaskChange, Task } from '../domain/task';
import type { DomainError, Result } from '../../../kernel';

/**
 * Where tasks live. Async although the device store is not: the next
 * implementation is a server, and a port that bakes in the current adapter's
 * synchrony is a port that has to change the day that happens.
 */
export interface TaskRepository {
  list(): Promise<readonly Task[]>;
  find(id: string): Promise<Task | undefined>;
  /** Apply a change the domain has already decided on. The repository does not second-guess it. */
  apply(id: string, change: TaskChange): Promise<void>;
  /** Store a new task and return it as stored, with the id the store gave it. */
  create(draft: NewTask): Promise<Task>;
  remove(id: string): Promise<void>;
}

/**
 * "May they?", already bound to the person asking. Tasks does not know a
 * policy slice exists: the composition root hands it a function, and anything
 * with this shape will do. That is what keeps tasks free of a dependency on
 * policy, and policy free of one on tasks.
 */
export type Guard = (action: string, resource?: { ownerId?: string | null }) => Result<unknown, DomainError>;
