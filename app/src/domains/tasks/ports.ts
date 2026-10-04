import type { Task } from './model';

/**
 * What the tasks domain needs from storage — and all it needs.
 *
 * Async even though the legacy store is synchronous: the day the repository is
 * a Supabase table or another service (ADR 0001, and the extraction triggers in
 * the modularization ADR), no caller changes. A synchronous port would have to
 * be changed *then*, in every use case at once.
 */
/**
 * What it takes to make a task.
 *
 * `time` and `note` are free text the person typed, stored and shown as written
 * and never parsed (the legacy rule on `PersonalTask.time`). `origin` names what
 * the task was made in service of — a deadline, a follow-up — so something else
 * can tell whether it already exists; null when nothing made it.
 */
export interface NewTask {
  title: string;
  dueOn: string | null;
  courseId: string | null;
  time: string;
  note: string;
  origin: string | null;
}

export interface TaskRepository {
  /** Replace the stored entry with this one. */
  save(next: Task): Promise<void>;
  /** Remove the entry. Removing one that is already gone is not an error: the person's aim is met. */
  remove(id: string): Promise<void>;
  get(id: string): Promise<Task | null>;
  list(): Promise<readonly Task[]>;
  /** Store an entry the repository has not seen; the id is minted by the repository. */
  create(draft: NewTask): Promise<Task>;
}
