import { fail, ok, type DomainError, type Result } from '../../../kernel';
import { agendaFor, conflictsIn, isRealDay, type Conflict, type Entry } from '../domain/agenda';

/**
 * One calendar the student has: their own appointments, their courses'
 * deadlines, a feed they connected. Each is a source; none is special.
 */
export interface CalendarSource {
  /** What to call it when it is the one that failed. */
  readonly name: string;
  entriesOn(on: string): Promise<readonly Entry[]>;
}

/** "May they?", already bound to the person asking; see tasks' port of the same name for why it is not shared. */
export type Guard = (action: string, resource?: { ownerId?: string | null }) => Result<unknown, DomainError>;

export interface Agenda {
  readonly on: string;
  readonly entries: readonly Entry[];
  readonly conflicts: readonly Conflict[];
  /**
   * Sources that could not be read. The day is drawn from the rest and says
   * which are missing: a campus feed being down must never hide a student's
   * own appointment, and a day that silently lacked a calendar would be wrong
   * in the way that is hardest to notice.
   */
  readonly unavailable: readonly string[];
}

export interface AgendaDeps {
  readonly sources: readonly CalendarSource[];
  readonly guard: Guard;
}

export const getAgenda = ({ sources, guard }: AgendaDeps) => async (on: string): Promise<Result<Agenda, DomainError>> => {
  const allowed = guard('calendar.read');
  if (!allowed.ok) return allowed;
  if (!isRealDay(on)) return fail('validation', 'calendar.bad_day', 'That is not a day on the calendar.');

  const settled = await Promise.allSettled(sources.map((s) => s.entriesOn(on)));
  const entries = agendaFor(settled.flatMap((r) => (r.status === 'fulfilled' ? [...r.value] : [])), on);
  const unavailable = sources.filter((_, i) => settled[i].status === 'rejected').map((s) => s.name);
  return ok({ on, entries, conflicts: conflictsIn(entries), unavailable });
};
