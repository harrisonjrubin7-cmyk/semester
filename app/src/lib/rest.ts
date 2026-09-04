/**
 * The hours that are not available, and what that does to the plan.
 *
 * `lib/windows.ts` records the hours you work in. Nothing recorded the hours
 * you do not, and the difference matters more than it sounds: rest that is not
 * written down is the residual, and the residual is what gets eaten. Every
 * planner in existence will quietly schedule an evening into one in the
 * morning and call the week feasible.
 *
 * ## A floor the planner may not go under
 *
 * Not a suggestion and not a nudge. Hours inside the floor are removed from
 * the week's capacity before anything is planned, so a week that only fits by
 * working at half past one does not fit, and the app says so on Monday instead
 * of letting it fail on Thursday.
 *
 * ## Protected blocks, which are the point
 *
 * Meals, the gym, one genuinely free evening. Entered as fixed, subtracted
 * like the floor. The app has always had commitments — a club, a job — and
 * those are things you promised other people. These are the ones you promised
 * yourself, which is exactly why they need writing down: nobody else will
 * defend them.
 *
 * ## The contract
 *
 * At the start of a term you decide how many hours a week school gets. From
 * then on the week is measured against a number *you* chose rather than
 * against whatever is left after everything else, which is how a term reaches
 * October before anybody notices it was overloaded in September.
 *
 * Nothing here enforces anything. It subtracts, compares, and says what it
 * found — the decision to work past the floor is a decision a person makes,
 * and an app that refused to show them the work would just be an app they
 * stopped using.
 */

import type { Window } from './windows';
import { hoursOn } from './windows';

/** Hours nobody should be planning into. Minutes past midnight. */
export interface Floor {
  /** When it starts, e.g. 23 * 60. */
  from: number;
  /** When it ends the next morning, e.g. 7 * 60. */
  to: number;
  on: boolean;
}

export const DEFAULT_FLOOR: Floor = { from: 23 * 60, to: 7 * 60, on: false };

/** One block of time that is yours and is not for work. */
export interface Rest {
  id: string;
  label: string;
  /** Weekday numbers, 0 = Sunday. */
  days: number[];
  from: number;
  to: number;
}

/**
 * How many minutes of a span fall inside the floor.
 *
 * The floor wraps midnight, which is the whole reason this is a function
 * rather than a subtraction: 23:00–07:00 is two intervals on a clock and one
 * night to a person.
 */
export function insideFloor(from: number, to: number, floor: Floor): number {
  if (!floor.on) return 0;
  const DAY = 24 * 60;
  // Two days of floor, not one. A window is minutes past midnight *of the day
  // it starts*, so an evening that runs to one in the morning is 18:00–25:00
  // — and intersecting that against a single day's intervals counted one hour
  // of an eleven o'clock floor instead of two.
  const spans: [number, number][] = [];
  for (const offset of [0, DAY]) {
    if (floor.from > floor.to) {
      spans.push([offset, offset + floor.to], [offset + floor.from, offset + DAY]);
    } else {
      spans.push([offset + floor.from, offset + floor.to]);
    }
  }
  let inside = 0;
  for (const [a, b] of spans) {
    inside += Math.max(0, Math.min(to, b) - Math.max(from, a));
  }
  return inside;
}

/** Minutes of a span taken by protected blocks on that weekday. */
export function insideRest(from: number, to: number, day: number, rest: Rest[]): number {
  let inside = 0;
  for (const r of rest) {
    if (!r.days.includes(day)) continue;
    inside += Math.max(0, Math.min(to, r.to) - Math.max(from, r.from));
  }
  return inside;
}

export interface DayCapacity {
  day: number;
  /** Hours the windows claim. */
  claimed: number;
  /** Hours removed by the floor. */
  slept: number;
  /** Hours removed by protected blocks. */
  kept: number;
  /** What is actually left. */
  real: number;
}

/**
 * One weekday's hours, after the floor and the protected blocks come out.
 *
 * The removed hours are reported separately rather than folded in, because
 * "you have nine hours" and "you have fourteen, four of which are after
 * midnight and one is dinner" are different statements and only the second
 * can be argued with.
 */
export function dayCapacity(windows: Window[], day: number, floor: Floor, rest: Rest[]): DayCapacity {
  const mine = windows.filter((w) => w.days.includes(day));
  let claimed = 0;
  let slept = 0;
  let kept = 0;
  for (const w of mine) {
    const span = Math.max(0, w.to - w.from);
    claimed += span;
    slept += insideFloor(w.from, w.to, floor);
    // Protected time inside the floor is not deducted twice: a nine o'clock
    // dinner on a day whose floor starts at eleven is one hour gone, not two.
    const restMinutes = insideRest(w.from, w.to, day, rest);
    const overlap = rest
      .filter((r) => r.days.includes(day))
      .reduce((n, r) => n + insideFloor(Math.max(r.from, w.from), Math.min(r.to, w.to), floor), 0);
    kept += Math.max(0, restMinutes - overlap);
  }
  const real = Math.max(0, claimed - slept - kept);
  return {
    day,
    claimed: claimed / 60,
    slept: slept / 60,
    kept: kept / 60,
    real: real / 60,
  };
}

export interface WeekCapacity {
  days: DayCapacity[];
  claimed: number;
  slept: number;
  kept: number;
  real: number;
}

export function weekCapacity(windows: Window[], floor: Floor, rest: Rest[]): WeekCapacity {
  const days = [0, 1, 2, 3, 4, 5, 6].map((d) => dayCapacity(windows, d, floor, rest));
  const sum = (pick: (d: DayCapacity) => number) =>
    Math.round(days.reduce((n, d) => n + pick(d), 0) * 10) / 10;
  return {
    days,
    claimed: sum((d) => d.claimed),
    slept: sum((d) => d.slept),
    kept: sum((d) => d.kept),
    real: sum((d) => d.real),
  };
}

/** What was taken out, said plainly. Empty when nothing was. */
export function takenLine(c: WeekCapacity): string {
  const bits: string[] = [];
  if (c.slept > 0) bits.push(`${c.slept} to the sleep floor`);
  if (c.kept > 0) bits.push(`${c.kept} to what you have kept for yourself`);
  if (bits.length === 0) return '';
  return `${c.claimed} hours in your windows, ${bits.join(' and ')} — ${c.real} left.`;
}

/**
 * How many hours a week you decided school gets.
 *
 * Zero means no contract, which is not the same as zero hours: without one the
 * week is measured against whatever happens to be left, which is how a term
 * reaches October before anybody notices it was overloaded in September.
 */
export interface Contract {
  hours: number;
  /** When it was set, so a stale one can be re-asked about. */
  at: number;
}

export const NO_CONTRACT: Contract = { hours: 0, at: 0 };

/**
 * The week's verdict, said on Monday.
 *
 * Three numbers and no encouragement. Where the week does not fit it says so
 * without softening it, because a plan that requires nineteen hours out of
 * eleven is not a plan and calling it "ambitious" wastes the one chance to say
 * so while something can still be done.
 */
export function verdict(needed: number, c: WeekCapacity, contract: Contract): string {
  if (c.real <= 0) {
    return 'No working hours set, so there is nothing to measure a week against. Set them under Mine → Hours.';
  }
  const against = contract.hours > 0 ? Math.min(contract.hours, c.real) : c.real;
  const basis =
    contract.hours > 0 && contract.hours < c.real
      ? `the ${contract.hours} hours a week you said school gets`
      : `the ${c.real} hours your windows leave`;

  if (needed <= 0) {
    return `Nothing timed this week, so there is no figure to set against ${basis}.`;
  }
  const over = Math.round((needed - against) * 10) / 10;
  if (over > 0) {
    return `This week asks for about ${needed} hours against ${basis}. It is ${over} over. That is not a scheduling problem.`;
  }
  return `This week asks for about ${needed} hours against ${basis}. It fits, with ${Math.abs(over)} spare.`;
}

/** Whether the week is genuinely over, for a caller deciding whether to shout. */
export function over(needed: number, c: WeekCapacity, contract: Contract): boolean {
  if (c.real <= 0 || needed <= 0) return false;
  const against = contract.hours > 0 ? Math.min(contract.hours, c.real) : c.real;
  return needed > against;
}

export function newRest(patch: Partial<Rest>, at: number): Rest {
  return {
    id: `r${at}${Math.random().toString(36).slice(2, 7)}`,
    label: (patch.label ?? '').trim(),
    days: [...new Set(patch.days ?? [])].filter((d) => d >= 0 && d <= 6).sort(),
    from: Math.max(0, Math.min(24 * 60, patch.from ?? 0)),
    to: Math.max(0, Math.min(24 * 60, patch.to ?? 0)),
  };
}

/** Stored values made safe. */
export function readFloor(raw: unknown): Floor {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_FLOOR };
  const f = raw as Partial<Floor>;
  const ok = (n: unknown) => typeof n === 'number' && n >= 0 && n <= 24 * 60;
  return {
    from: ok(f.from) ? (f.from as number) : DEFAULT_FLOOR.from,
    to: ok(f.to) ? (f.to as number) : DEFAULT_FLOOR.to,
    on: f.on === true,
  };
}

export function readRest(raw: unknown): Rest[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Rest => Boolean(r) && typeof r === 'object' && typeof r.id === 'string')
    .map((r) => ({
      id: r.id,
      label: typeof r.label === 'string' ? r.label : '',
      days: Array.isArray(r.days) ? r.days.filter((d: unknown) => typeof d === 'number') : [],
      from: typeof r.from === 'number' ? r.from : 0,
      to: typeof r.to === 'number' ? r.to : 0,
    }));
}

export function readContract(raw: unknown): Contract {
  if (!raw || typeof raw !== 'object') return { ...NO_CONTRACT };
  const c = raw as Partial<Contract>;
  return {
    hours: typeof c.hours === 'number' && c.hours > 0 ? Math.min(120, Math.round(c.hours)) : 0,
    at: typeof c.at === 'number' ? c.at : 0,
  };
}

/** Hours a week the windows claim, before anything comes out. */
export function claimedHours(windows: Window[]): number {
  return [0, 1, 2, 3, 4, 5, 6].reduce((n, d) => n + hoursOn(windows, d), 0);
}
