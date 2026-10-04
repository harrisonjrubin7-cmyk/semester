import type { Appointment, DatedItem, PersonalTask } from '../lib/types';
import { entriesFromLegacy } from './calendar';
import { principalFromLegacy, type LegacyPerson } from './identity';
import { systemClock, type Clock, type Result } from './kernel';
import { bindPolicy, type Can } from './policy';
import { buildToday, type TodayConfig, type TodayView } from './today';
import { createTaskService, legacyTaskRepository, taskFromLegacy, type LegacyTaskHost, type TaskService } from './tasks';

/**
 * The composition root: the one file that knows how the domains are wired to the
 * legacy app.
 *
 * Domains declare what they need as ports and never construct their own
 * dependencies; this file builds the adapters, hands them in, and is the only
 * place `acl.ts` files from different domains meet. A screen, a hook or a test
 * calls `createDomains` and gets services — it never imports an adapter.
 *
 * Every field of {@link LegacyHost} is a *function*, not a value. The legacy
 * store is replaced on every dispatch, so a host that captured `state.tasks`
 * once would serve the list as it was when the screen mounted. Reading through
 * a function is what keeps the domain looking at the live state, and it is the
 * thing the integration test checks.
 *
 * Not yet called from a screen. The sequence in `docs/architecture/modular-monolith.md`
 * moves `screens/Today.tsx` onto this behind a flag; until then the slice runs
 * beside the legacy code and the parity tests hold the two to the same answers.
 */

/** The few kernel types a host or hook needs, re-exported so none reaches into the kernel. */
export type { AppError, Clock, Result } from './kernel';

export interface LegacyHost {
  person(): LegacyPerson;
  readOnly(): boolean;
  tasks: LegacyTaskHost;
  appointments(): readonly Appointment[];
  /** Deadlines already dated against the live clock (`datedItems(catalog, now)`). */
  deadlines(): readonly DatedItem[];
}

/** Everything Today reads, as plain values from one render of the legacy store. */
export interface LegacySnapshot {
  person: LegacyPerson;
  readOnly: boolean;
  tasks: readonly PersonalTask[];
  appointments: readonly Appointment[];
  deadlines: readonly DatedItem[];
}

/**
 * Today from a snapshot, with nothing live in between.
 *
 * `createDomains` reads the store through functions so a service built once
 * stays current. A *render* wants the opposite: the state of this render, so
 * what it draws and what it derived cannot differ. Both go through here.
 */
export function todayFromLegacy(snapshot: LegacySnapshot, clock: Clock, config?: TodayConfig): Result<TodayView> {
  const can = bindPolicy(principalFromLegacy(snapshot.person), { readOnly: snapshot.readOnly });
  return buildToday({
    clock,
    can,
    entries: entriesFromLegacy({
      deadlines: snapshot.deadlines,
      tasks: snapshot.tasks,
      appointments: snapshot.appointments,
    }),
    tasks: snapshot.tasks.map(taskFromLegacy),
    config,
  });
}

export interface Domains {
  tasks: TaskService;
  /**
   * Resolves once the legacy store has committed whatever was last dispatched.
   * For a caller that writes through the legacy store itself (the repeating
   * tasks the domain does not own) and then needs the domain to see the result.
   */
  settled(): Promise<void>;
  /** Today, derived from the host's live state at the moment of the call. */
  today(config?: TodayConfig): Promise<Result<TodayView>>;
}

export function createDomains(host: LegacyHost, clock: Clock = systemClock): Domains {
  // Resolved at each call so a role change or read-only flip takes effect without rebuilding.
  const can: Can = (action) => bindPolicy(principalFromLegacy(host.person()), { readOnly: host.readOnly() })(action);

  return {
    tasks: createTaskService({ repo: legacyTaskRepository(host.tasks), clock, can }),
    settled: async () => host.tasks.settled?.(),
    async today(config) {
      return todayFromLegacy(
        {
          person: host.person(),
          readOnly: host.readOnly(),
          tasks: host.tasks.read(),
          appointments: host.appointments(),
          deadlines: host.deadlines(),
        },
        clock,
        config,
      );
    },
  };
}
