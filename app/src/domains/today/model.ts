import { addDays, err, ok, type Clock, type IsoDate, type Result } from '../kernel';
import { clashes, entriesOn, nextUp, type Clash, type Entry } from '../calendar';
import type { Can } from '../policy';
import { isDueOn, isOverdue, type Task } from '../tasks';

/**
 * Today: a read model, composed.
 *
 * Today owns no data. It asks the policy whether this person gets a Today, then
 * lays the calendar's entries and the tasks' open work over one day. That is the
 * entire domain — which is the point of the slice: the legacy `screens/Today.tsx`
 * is 2,100 lines with sixty-five imports because it also fetches, stores,
 * decides and draws; here the *deciding* is forty lines that can be tested at
 * any hour, in any time zone, with no React.
 *
 * It depends on `tasks`, `calendar` and `policy` only through their public
 * surfaces, and nothing depends on it.
 */

export interface TodayConfig {
  /** How many days of deadlines count as "coming up". Injected, never a constant a rule hides. */
  horizonDays: number;
}

export const DEFAULT_TODAY_CONFIG: TodayConfig = { horizonDays: 14 };

export interface TodayView {
  day: IsoDate;
  /** Everything on the calendar today, timed first. */
  schedule: Entry[];
  /** The next timed thing still ahead, if any. */
  upNext: Entry | null;
  /** Open tasks dated today. */
  dueToday: Task[];
  /** Open tasks dated before today, oldest first — shown, never hidden. */
  overdue: Task[];
  /** Deadlines in the next `horizonDays` days, excluding today. */
  comingUp: Entry[];
  clashes: Clash[];
  /** True when there is truly nothing: the screen may say so rather than draw empty boxes. */
  empty: boolean;
}

export interface TodayInput {
  clock: Clock;
  can: Can;
  entries: readonly Entry[];
  tasks: readonly Task[];
  config?: TodayConfig;
}

export function buildToday(input: TodayInput): Result<TodayView> {
  const decision = input.can('today.view');
  if (!decision.allow) return err('forbidden', decision.message, { reason: decision.reason });

  const { day, minutes } = input.clock.local();
  const horizon = (input.config ?? DEFAULT_TODAY_CONFIG).horizonDays;
  if (!Number.isInteger(horizon) || horizon < 0) {
    return err('validation', 'The look-ahead has to be a whole number of days.', { field: 'horizonDays' });
  }

  const schedule = entriesOn(input.entries, day);
  const dueToday = input.tasks.filter((t) => isDueOn(t, day));
  const overdue = input.tasks
    .filter((t) => isOverdue(t, day))
    .sort((a, b) => (a.dueOn as string).localeCompare(b.dueOn as string) || a.title.localeCompare(b.title));
  const last = addDays(day, horizon);
  const comingUp = input.entries
    .filter((e) => e.kind === 'deadline' && e.day > day && e.day <= last)
    .sort((a, b) => a.day.localeCompare(b.day) || (a.startMin ?? 1440) - (b.startMin ?? 1440));

  return ok({
    day,
    schedule,
    upNext: nextUp(input.entries, day, minutes),
    dueToday,
    overdue,
    comingUp,
    clashes: clashes(schedule),
    empty: schedule.length === 0 && dueToday.length === 0 && overdue.length === 0 && comingUp.length === 0,
  });
}
