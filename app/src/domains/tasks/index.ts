/**
 * Tasks: what the student has to do, and ticking it off.
 *
 * Public entry. Other slices may import types and use-case factories from
 * here and nothing else (`architecture.test.ts`, slice-doors-stay-shut).
 */
export { TASK_LIFECYCLE, TITLE_LIMIT, complete, reopen, reschedule, draftTask, isDay, openTasks, isOverdue, stateOf } from './domain/task';
export type { Task, TaskState, TaskChange, NewTask } from './domain/task';
export { completeTask, reopenTask, toggleTask, addTask, rescheduleTask, removeTask, listTasks } from './application/use-cases';
export type { Completion, TaskDeps, TaskList } from './application/use-cases';
export type { TaskRepository, Guard } from './application/ports';
