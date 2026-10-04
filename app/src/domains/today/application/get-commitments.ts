import { fail, ok, type Clock, type DomainError, type Result } from '../../../kernel';
import type { Agenda, Entry } from '../../calendar';
import { MAX_HORIZON_DAYS, daysFrom } from '../domain/horizon';
import type { Guard } from './get-today';

/** One day of a look-ahead: everything on it, in the order a day is read, and the calendars that could not be read. */
export interface CommitmentDay {
  readonly on: string;
  readonly entries: readonly Entry[];
  readonly unavailable: readonly string[];
}

export interface CommitmentsDeps {
  readonly guard: Guard;
  readonly clock: Clock;
  /** The calendar's day read, with every source the look-ahead wants (the composition root decides which). */
  readonly agenda: (on: string) => Promise<Result<Agenda, DomainError>>;
}

/**
 * The next `days` days, today first.
 *
 * Today's own read model answers "what is on today"; this answers "what is on
 * each of the next ten", which is what the commitments list is drawn from. Finished
 * entries are kept and marked `done` rather than dropped: whether a finished one is
 * drawn is the screen's call, and a read model that had already thrown it away could
 * not be asked the other way.
 *
 * A day whose calendar fails entirely (not a source being down, which arrives as
 * `unavailable`, but the read being refused or the day being invalid) fails the whole
 * look-ahead, because a list with a silent hole in it is wrong in the way hardest to notice.
 */
export const getCommitments = (deps: CommitmentsDeps) => async (days: number): Promise<Result<readonly CommitmentDay[], DomainError>> => {
  const allowed = deps.guard('today.view');
  if (!allowed.ok) return allowed;
  if (!Number.isInteger(days) || days < 1 || days > MAX_HORIZON_DAYS) {
    return fail('validation', 'today.bad_horizon', `Look ahead between 1 and ${MAX_HORIZON_DAYS} days.`);
  }
  const ons = daysFrom(deps.clock.today(), days);
  const read = await Promise.all(ons.map((on) => deps.agenda(on)));
  const out: CommitmentDay[] = [];
  for (let i = 0; i < read.length; i++) {
    const r = read[i];
    if (!r.ok) return r;
    out.push({ on: ons[i], entries: r.value.entries, unavailable: r.value.unavailable });
  }
  return ok(out);
};
