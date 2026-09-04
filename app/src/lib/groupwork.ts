/**
 * The four-person case, as arithmetic.
 *
 * A group project is one deadline in the app and four people's worth of work
 * in life. Who has which section, what nobody has claimed, and the answer to
 * "are we going to make this" a week out — which is the question nobody asks
 * until it is too late for the answer to be any use.
 *
 * The rooms and the row-level policies that make them safe already existed;
 * this is a shared checklist inside one, plus the counting that turns it into
 * something worth opening. `supabase/groups.sql` holds the storage half.
 *
 * ## The pace line, which is the point
 *
 * "Are we going to make it" has an honest arithmetic answer and a dishonest
 * scored one. The honest answer compares two rates: parts finished per day so
 * far, against parts remaining per day left. Both are counts of things the
 * group did, neither is a prediction about people, and the sentence it
 * produces — "at the rate so far, three short" — is one a group can argue with
 * productively. A percentage would not be.
 *
 * Where there is nothing to compute a rate from, it says so instead of
 * defaulting to optimism.
 *
 * ## What it never does
 *
 * No individual scoring. The app counts what is unclaimed and what each person
 * holds, because a group needs to see that to divide work; it does not rank
 * members, and `perPerson` is deliberately sorted by name rather than by
 * output so that reading it is not reading a league table.
 */

export interface Member {
  userId: string;
  /** Their handle, as the room shows it. */
  handle: string;
}

export interface Part {
  id: string;
  title: string;
  /** Who has it. Empty means nobody yet. */
  owner: string;
  done: boolean;
  /** ISO date this part is wanted by. Empty when only the group's date counts. */
  due: string;
  createdAt: number;
}

export interface Group {
  id: string;
  name: string;
  about: string;
  /** ISO date the whole thing is due. Empty when unset. */
  due: string;
}

const DAY = 86_400_000;

function daysBetween(from: Date, toIso: string): number {
  const [y, m, d] = toIso.split('-').map(Number);
  if (!y || !m || !d) return 0;
  const to = new Date(y, m - 1, d);
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((to.getTime() - start.getTime()) / DAY);
}

export interface Standing {
  total: number;
  done: number;
  /** Parts nobody has put their name to. */
  unclaimed: number;
  /** Days until the group's deadline. Null when it has not set one. */
  daysLeft: number | null;
}

export function standing(group: Group, parts: Part[], now: Date): Standing {
  return {
    total: parts.length,
    done: parts.filter((p) => p.done).length,
    unclaimed: parts.filter((p) => !p.done && !p.owner).length,
    daysLeft: group.due ? daysBetween(now, group.due) : null,
  };
}

/** The headline. Counts, and the days, and nothing else. */
export function headline(s: Standing): string {
  if (s.total === 0) return 'Nothing on the list yet.';
  const left = s.total - s.done;
  const bits = [`${s.done} of ${s.total} done`];
  if (s.unclaimed > 0) bits.push(`${s.unclaimed} unclaimed`);
  if (s.daysLeft !== null) {
    if (s.daysLeft < 0) bits.push('past the deadline');
    else if (s.daysLeft === 0) bits.push('due today');
    else bits.push(`${s.daysLeft} ${s.daysLeft === 1 ? 'day' : 'days'} left`);
  }
  if (left === 0) return `All ${s.total} done.`;
  return `${bits.join(', ')}.`;
}

export interface Pace {
  /** Parts finished per day since the list was started. */
  rate: number;
  /** Parts a day that finishing on time would take from here. */
  needed: number;
  /** How many short the current rate lands, rounded. Zero or less is fine. */
  short: number;
  /** Whether there is anything to compute a rate from. */
  known: boolean;
}

/**
 * Two rates, side by side.
 *
 * The rate so far is measured from the day the first part was added, not from
 * the day the group was created — a group that sat empty for a fortnight
 * before anybody wrote the list down did not spend that fortnight failing.
 */
export function pace(group: Group, parts: Part[], now: Date): Pace {
  const left = parts.filter((p) => !p.done).length;
  const daysLeft = group.due ? daysBetween(now, group.due) : 0;
  const needed = daysLeft > 0 ? left / daysLeft : left;

  const earliest = Math.min(...parts.map((p) => p.createdAt));
  const elapsed = Number.isFinite(earliest)
    ? Math.max(1, Math.round((now.getTime() - earliest) / DAY))
    : 0;
  const done = parts.filter((p) => p.done).length;

  if (parts.length === 0 || elapsed === 0 || done === 0 || !group.due) {
    return { rate: 0, needed: Math.round(needed * 100) / 100, short: 0, known: false };
  }

  const rate = done / elapsed;
  const willDo = daysLeft > 0 ? rate * daysLeft : 0;
  return {
    rate: Math.round(rate * 100) / 100,
    needed: Math.round(needed * 100) / 100,
    short: Math.max(0, Math.round(left - willDo)),
    known: true,
  };
}

/**
 * "At the rate so far, three short."
 *
 * The sentence a group can argue with. Silent rather than optimistic where
 * there is no rate to speak of — a list with nothing ticked yet says how much
 * a day it would take, which is the useful thing to know on day one.
 */
export function paceLine(group: Group, parts: Part[], now: Date): string {
  const p = pace(group, parts, now);
  const left = parts.filter((x) => !x.done).length;
  if (left === 0) return '';
  if (!group.due) return 'No deadline set for the group, so there is no rate to compare against.';

  const daysLeft = daysBetween(now, group.due);
  if (daysLeft <= 0) {
    return `${left} ${left === 1 ? 'part' : 'parts'} still open, and the deadline has passed.`;
  }
  if (!p.known) {
    const each = Math.round(p.needed * 10) / 10;
    return `Nothing ticked yet. Finishing on time means ${each} ${each === 1 ? 'part' : 'parts'} a day from here.`;
  }
  if (p.short <= 0) {
    return `At the rate so far, that lands with room — ${p.rate} a day against the ${p.needed} it needs.`;
  }
  return `At the rate so far, ${p.short} short — ${p.rate} a day against the ${p.needed} it needs.`;
}

export interface Share {
  member: Member;
  has: number;
  done: number;
}

/**
 * What each person is holding.
 *
 * Sorted by handle, deliberately. Sorting by output would make this a league
 * table, and a group that opens the app to see who is behind is a group about
 * to have a worse conversation than the one it needed to have.
 */
export function perPerson(members: Member[], parts: Part[]): Share[] {
  return [...members]
    .sort((a, b) => a.handle.localeCompare(b.handle))
    .map((member) => {
      const theirs = parts.filter((p) => p.owner === member.userId);
      return { member, has: theirs.length, done: theirs.filter((p) => p.done).length };
    });
}

/** Parts nobody has claimed, oldest first — the ones the group has to divide. */
export function unclaimed(parts: Part[]): Part[] {
  return parts.filter((p) => !p.done && !p.owner).sort((a, b) => a.createdAt - b.createdAt);
}

/** Yours, undone, soonest first. What a person opens this to see. */
export function mine(parts: Part[], userId: string): Part[] {
  return parts
    .filter((p) => p.owner === userId && !p.done)
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
}

/**
 * Whether a part is late on its own account.
 *
 * Only where the group set a date for that part specifically. The group's own
 * deadline is not applied to every line, because a part with no date of its
 * own is not late until the whole thing is.
 */
export function isLate(part: Part, now: Date): boolean {
  return !part.done && part.due !== '' && daysBetween(now, part.due) < 0;
}
