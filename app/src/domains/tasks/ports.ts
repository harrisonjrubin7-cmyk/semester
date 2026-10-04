import type { Task } from './model';

/**
 * What the tasks domain needs from storage — and all it needs.
 *
 * Async even though the legacy store is synchronous: the day the repository is
 * a Supabase table or another service (ADR 0001, and the extraction triggers in
 * the modularization ADR), no caller changes. A synchronous port would have to
 * be changed *then*, in every use case at once.
 */
export interface TaskRepository {
  /** Replace the stored entry with this one. */
  save(next: Task): Promise<void>;
  get(id: string): Promise<Task | null>;
  list(): Promise<readonly Task[]>;
  /** Store an entry the repository has not seen; the id is minted by the repository. */
  create(draft: { title: string; dueOn: string | null; courseId: string | null }): Promise<Task>;
}
