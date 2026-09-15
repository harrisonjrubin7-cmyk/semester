/**
 * What happens to a task when you tick it, and what its steps add up to.
 *
 * Two small facts that would otherwise live inside a reducer case and a row
 * component, which is where the app would then have to look for them. They
 * are here because both are decisions rather than plumbing, and because a
 * decision somebody has to re-derive from a JSX file is a decision that gets
 * made differently the second time.
 *
 * ## Ticking a repeating task moves it, rather than recording that it is done
 *
 * A repeating task could have been modelled the way a repeating appointment
 * is: one stored row, expanded into occurrences wherever a day is drawn, with
 * the completed ones kept in a list beside the rule. That is right for an
 * appointment because an appointment is *drawn on a grid* — a week view has
 * to ask "does this land on Thursday" about every day on screen at once.
 *
 * A task is not drawn on a grid. It is one row in a list, and the only date
 * anybody wants from it is the next one. So a repeating task sits on one date
 * at a time and ticking it advances that date to the next occurrence, leaving
 * it unfinished, which is what both clients look like they are doing: the
 * laundry you just did comes back a fortnight from now.
 *
 * The saving is not the code — it is that every other reader of a task is
 * untouched. `t.done` still means what it always meant, so the ten places
 * that count unfinished work, list a day, or answer the assistant did not
 * have to learn that a task can be done on Tuesday and not on Wednesday.
 * Against that, the app keeps no record of the fortnights you did do the
 * laundry — which it kept no record of before either, and which is a history
 * feature rather than a repeat one.
 *
 * `done` on a repeating task therefore means the *series* is over, and it can
 * only become true when the rule runs out of days. A rule always names a last
 * one, so it always does.
 */

import { nextAfter } from './repeat';
import type { PersonalTask, TaskStep } from './types';

/**
 * The patch for ticking a task, in either direction.
 *
 * Returns what to change rather than a whole task, so the reducer stays the
 * only thing that writes state and this stays a pure answer that can be
 * asserted on directly.
 */
export function tick(task: PersonalTask, on: boolean): Partial<PersonalTask> {
  // Unticking, and anything that does not repeat, is the plain flag.
  if (!on || !task.repeat || !task.date) return { done: on };

  const next = nextAfter(task.date, task.repeat, task.date);
  /*
   * No next day means the rule has run out, and the task is finished for
   * good. Without this an expired repeat would be a task that could never be
   * ticked off — every press rolling it to nowhere and leaving it where it
   * was, which reads as a broken checkbox rather than as a finished series.
   */
  if (!next) return { done: true };

  /*
   * Forward, and unfinished. The steps come back with it: a weekly task that
   * breaks into the same three pieces every week is the whole reason for
   * having steps on something that repeats, and leaving them ticked would
   * mean clearing them by hand every time.
   */
  return {
    done: false,
    date: next,
    ...(task.steps?.length ? { steps: task.steps.map((s) => ({ ...s, done: false })) } : {}),
  };
}

/** What ticking it will do, said in the row so nothing happens unannounced. */
export function tickSays(task: PersonalTask): string {
  if (!task.repeat || !task.date) return '';
  const next = nextAfter(task.date, task.repeat, task.date);
  return next ? `Comes back ${next}` : 'Last one';
}

/** How far through the steps it is. `of` is zero when there are none. */
export function stepsDone(task: PersonalTask): { done: number; of: number } {
  const steps = task.steps ?? [];
  return { done: steps.filter((s) => s.done).length, of: steps.length };
}

/**
 * Whether the steps say the task is finished but the task does not.
 *
 * Neither client ticks the task for you, and neither should this: a task is
 * not always the sum of the steps somebody happened to write down, and a list
 * that finishes itself takes the decision away at the one moment the person
 * is already looking at it. What it can do is say so, which is what this is
 * for.
 */
export function stepsAllDone(task: PersonalTask): boolean {
  const { done, of } = stepsDone(task);
  return of > 0 && done === of && !task.done;
}

/** A new step. Ids are made by the caller, which is the only impure part. */
export function newStep(id: string, text: string): TaskStep {
  return { id, text: text.trim(), done: false };
}
