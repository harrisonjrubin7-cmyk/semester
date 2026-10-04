import { ok, type Clock, type DomainError, type Result } from '../../../kernel';
import type { Agenda, Conflict, Entry } from '../../calendar';
import type { Task, TaskList } from '../../tasks';
import { isQuiet, type NextAction, type Ranking } from '../domain/next';

/** "May they?", already bound to the person asking. */
export type Guard = (action: string, resource?: { ownerId?: string | null }) => Result<unknown, DomainError>;

/**
 * What Today reads, each as a function: the tasks slice's `listTasks`, the
 * calendar slice's `getAgenda`, and a ranker. Today does not import their
 * insides or construct them; the composition root hands them over, and a test
 * hands over three arrow functions.
 */
export interface TodayInputs {
  readonly tasks: () => Promise<Result<TaskList, DomainError>>;
  readonly agenda: (on: string) => Promise<Result<Agenda, DomainError>>;
  readonly ranking: (now: number) => Promise<Ranking>;
}

export interface TodayDeps extends TodayInputs {
  readonly guard: Guard;
  readonly clock: Clock;
}

export interface TodayView {
  readonly on: string;
  readonly schedule: readonly Entry[];
  readonly conflicts: readonly Conflict[];
  readonly overdue: readonly Task[];
  readonly dueToday: readonly Task[];
  readonly mostImportant: NextAction | null;
  readonly next: readonly NextAction[];
  /** Calendars that could not be read, so the screen can say the day may be incomplete. */
  readonly unavailable: readonly string[];
  readonly quiet: boolean;
}

/**
 * Today: one read model over tasks, the calendar and the ranker.
 *
 * Tasks being unreadable fails the whole thing, because the device's own list
 * is not optional. A calendar source being unreadable does not — that arrives
 * as `unavailable` and the rest of the day still draws.
 */
export const getToday = (deps: TodayDeps) => async (): Promise<Result<TodayView, DomainError>> => {
  const allowed = deps.guard('today.view');
  if (!allowed.ok) return allowed;

  const on = deps.clock.today();
  const [tasks, agenda, ranking] = await Promise.all([deps.tasks(), deps.agenda(on), deps.ranking(deps.clock.now())]);
  if (!tasks.ok) return tasks;
  if (!agenda.ok) return agenda;

  // What is left of the day: a finished deadline stays on the calendar, not here.
  const left = agenda.value.entries.filter((e) => !e.done);

  return ok({
    on,
    schedule: left,
    conflicts: agenda.value.conflicts,
    overdue: tasks.value.overdue,
    dueToday: tasks.value.dueToday,
    mostImportant: ranking.mostImportant,
    next: ranking.next,
    unavailable: agenda.value.unavailable,
    quiet: isQuiet({ schedule: left, overdue: tasks.value.overdue, dueToday: tasks.value.dueToday, ranking }),
  });
};
