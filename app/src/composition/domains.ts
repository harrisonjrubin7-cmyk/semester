import { nullSink, systemClock, systemIds, type Clock, type EventSink, type IdSource } from '../kernel';
import { getAgenda } from '../domains/calendar';
import { appointmentSource, classSource, deadlineSource, taskSource, type ClassMeeting } from '../domains/calendar/adapters';
import { currentSubject } from '../domains/identity';
import { legacyIdentity, type LegacyIdentity } from '../domains/identity/adapters';
import { createAuthorizer, type InstitutionalContext } from '../domains/policy';
import { addTask, completeTask, listTasks, removeTask, reopenTask, rescheduleTask, toggleTask } from '../domains/tasks';
import { legacyTaskRepository, type Settled, type StateAccess, type TaskCommands } from '../domains/tasks/adapters';
import { getCommitments, getToday } from '../domains/today';
import { legacyRanking, type LegacyRankingInput } from '../domains/today/adapters';
import type { Appointment, DatedItem, PersonalTask } from '../lib/types';

/**
 * Everything the domains need that only the legacy app has, as plain
 * functions. This is the entire surface between the two worlds: a React hook
 * over the legacy store fills it in, a test fills it in with arrays.
 *
 * Legacy *types* are named here because this is the shell, which is allowed to
 * know them. No domain imports them except through its own `adapters/`.
 */
export interface LegacyHost {
  readonly identity: () => LegacyIdentity;
  readonly tasks: StateAccess<PersonalTask[]>;
  /** The writes a whole-list `update` cannot say: add, move (with its undo), delete. */
  readonly taskCommands: TaskCommands;
  /** Resolves once the store has committed what was just dispatched. Absent where a write is synchronous. */
  readonly settled?: Settled;
  readonly appointments: () => Appointment[];
  readonly deadlines: () => DatedItem[];
  /** The student's class meetings on a day, with how long each runs. */
  readonly classes: (date: Date) => readonly ClassMeeting[];
  /** Whether the student ticked this deadline off. */
  readonly isDone: (id: string) => boolean;
  readonly ranking: () => LegacyRankingInput;
}

export interface Platform {
  readonly clock: Clock;
  readonly ids: IdSource;
  readonly events: EventSink;
  /** Absent on a device with no institution. Institutional actions are then refused, not guessed. */
  readonly institutional?: InstitutionalContext;
}

export const defaultPlatform: Platform = { clock: systemClock, ids: systemIds, events: nullSink };

/**
 * The composition root: where ports meet their implementations, once.
 *
 * Nothing else in the app constructs a use case. A screen is handed what it
 * needs from here, which is the whole of the migration: the day a screen reads
 * `today.view()` instead of eight legacy hooks, it can be locked in
 * `legacy.json` and the next change cannot quietly put the hooks back.
 */
export function composeDomains(host: LegacyHost, platform: Platform = defaultPlatform) {
  const { clock, ids, events, institutional } = platform;
  const identity = legacyIdentity(host.identity);
  const subject = () => currentSubject(identity);
  const authorizer = createAuthorizer({ clock, institutional });

  /** Bound to whoever is signed in *now*, and to a fresh correlation id for each question. */
  const guard = (action: string, resource?: { ownerId?: string | null }) =>
    authorizer.enforce(subject(), { action, resource, correlationId: ids.next() });

  const settled: Settled = host.settled ?? (async () => {});
  const taskDeps = { tasks: legacyTaskRepository(host.tasks, host.taskCommands, settled), guard, clock, events };
  const sources = [classSource(host.classes), appointmentSource(host.appointments), deadlineSource(host.deadlines, host.isDone)];
  const tasks = {
    list: listTasks(taskDeps),
    complete: completeTask(taskDeps),
    reopen: reopenTask(taskDeps),
    toggle: toggleTask(taskDeps),
    add: addTask(taskDeps),
    reschedule: rescheduleTask(taskDeps),
    remove: removeTask(taskDeps),
  };
  // The day's own agenda has no tasks in it: Today reads those from the tasks slice, and would count them twice.
  // The look-ahead is the other question, "what is on each of the next days", where a task is an entry like any other.
  const calendar = {
    agenda: getAgenda({ sources, guard }),
    horizon: getAgenda({ sources: [...sources, taskSource(host.tasks.read)], guard }),
  };
  const today = {
    view: getToday({ guard, clock, tasks: tasks.list, agenda: calendar.agenda, ranking: legacyRanking(host.ranking) }),
    commitments: getCommitments({ guard, clock, agenda: calendar.horizon }),
  };

  return { subject, tasks, calendar, today, settled };
}

export type Domains = ReturnType<typeof composeDomains>;
