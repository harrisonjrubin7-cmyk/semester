/**
 * The days that are going to hurt, found while they can still be moved.
 *
 * The app has always been able to show that four things are due on the same
 * Friday. It showed them as four rows, one under another, in the same voice as
 * a Tuesday with one — and the calendar, where the pile-up is most visible,
 * was the quietest about it. Everything needed to say so out loud was already
 * being collected: the dates, the kinds, the commitments, and — since the
 * timer — a measured sense of how long each kind of work takes *this* student.
 *
 * ## Two weeks out, not the night before
 *
 * A warning on the day is not a warning, it is a description. The horizon is
 * deliberately long enough that the answer is still "start the essay on
 * Sunday" rather than "cancel something".
 *
 * ## It never invents an estimate
 *
 * A day's load is the sum of what `lib/pace.ts` can actually estimate from the
 * student's own reports. Work it has never seen contributes zero minutes and
 * is counted separately, so a heavy day is never *hidden* by unknowns — the
 * sentence says how many it could not weigh. The alternative, defaulting an
 * unknown assignment to some average, produces a number that is confidently
 * wrong in whichever direction the average happens to sit.
 *
 * ## Four kinds, because they need four different things done
 *
 * Two exams on one day is a revision problem, weeks out. Four deadlines at one
 * minute past midnight is a sequencing problem, days out. A day whose work
 * does not fit is a starting problem. Work landing on a day you are already
 * committed elsewhere is a diary problem, and the app knows about the
 * commitment because the student entered it.
 */

import { estimate, type Spent } from './pace';
import { isExam } from './runway';
import type { Commitment } from './activities';
import type { DatedItem } from './types';

export type ClashKind = 'exams' | 'heavy' | 'stacked' | 'committed';

export interface Clash {
  /** The day, `YYYY-MM-DD`, so it can be opened. */
  date: string;
  kind: ClashKind;
  /** One sentence, in the second person. */
  says: string;
  /** How many days from now. Sorted nearest first. */
  daysAway: number;
  /** What is involved, for the row to list. */
  items: DatedItem[];
  /** Estimated hours of work, for `heavy`. Zero otherwise. */
  hours: number;
  /** Things on that day nothing could be estimated for. */
  unknown: number;
}

/** Hours of coursework in a day before it stops being a normal day. */
export const DEFAULT_BUDGET = 4;

/** How far out to look. Long enough that the answer is still "start earlier". */
export const HORIZON = 14;

/** Three or more landing in the same hour is a queue, not a coincidence. */
const STACKED = 3;

/*
 * What counts as an exam is `lib/runway.ts`'s definition, not a third copy of
 * the regex. It is also the better one: it counts a paper worth 25% or more,
 * which is an exam in everything but name, and it reads the title as well as
 * the kind — so "Take-home Quiz 2" is found where matching only the kind
 * would miss it.
 */

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Which days in the horizon are worth warning about.
 *
 * Ticked work is excluded by the caller, not here: what counts as done is the
 * store's business and this should not have an opinion about it.
 */
export function clashes(
  items: DatedItem[],
  spent: Spent[],
  commitments: Commitment[],
  /** A course id to its code, for naming two exams in one sentence. */
  code: (id: string) => string,
  budgetHours = DEFAULT_BUDGET,
): Clash[] {
  // No `now` parameter: `datedItems` has already stamped `daysAway` against
  // it, and a second clock here could disagree with the one the rest of the
  // screen is drawn from.
  const ahead = items.filter((i) => i.daysAway >= 0 && i.daysAway <= HORIZON);
  const byDay = new Map<string, DatedItem[]>();
  for (const i of ahead) {
    const day = isoOf(i.date);
    byDay.set(day, [...(byDay.get(day) ?? []), i]);
  }

  const out: Clash[] = [];

  for (const [date, onDay] of byDay) {
    const daysAway = onDay[0].daysAway;

    let minutes = 0;
    let unknown = 0;
    for (const i of onDay) {
      const e = estimate(spent, i.c, i.kind);
      if (e.minutes > 0) minutes += e.minutes;
      else unknown += 1;
    }
    const hours = Math.round((minutes / 60) * 10) / 10;

    const exams = onDay.filter((i) => isExam(i));
    if (exams.length >= 2) {
      out.push({
        date,
        kind: 'exams',
        daysAway,
        items: exams,
        hours,
        unknown,
        says: `${exams.length} exams on the same day — ${[...new Set(exams.map((e) => code(e.c)))].join(' and ')}.`,
      });
    }

    // A day already promised to something else. The student entered the
    // commitment, so this is the app joining up two things it was told.
    const busy = commitments.filter((c) => c.days.includes(new Date(`${date}T12:00:00`).getDay()));
    if (busy.length > 0 && onDay.length >= 2) {
      out.push({
        date,
        kind: 'committed',
        daysAway,
        items: onDay,
        hours,
        unknown,
        says: `${onDay.length} things due on a day you have ${busy.map((c) => c.name).join(' and ')}.`,
      });
    }

    // Everything landing in one hour. Common, because 11:59 PM is a default.
    const atSameTime = new Map<number, DatedItem[]>();
    for (const i of onDay) atSameTime.set(i.dueAt, [...(atSameTime.get(i.dueAt) ?? []), i]);
    for (const [, group] of atSameTime) {
      if (group.length >= STACKED) {
        out.push({
          date,
          kind: 'stacked',
          daysAway,
          items: group,
          hours,
          unknown,
          says: `${group.length} things due at ${group[0].dueTime || 'the same time'}.`,
        });
      }
    }

    if (hours > budgetHours) {
      out.push({
        date,
        kind: 'heavy',
        daysAway,
        items: onDay,
        hours,
        unknown,
        says:
          unknown > 0
            ? `About ${hours} hours of work due, on your own timings — plus ${unknown} the app has never timed.`
            : `About ${hours} hours of work due, on your own timings.`,
      });
    }
  }

  // Nearest first, and the harder kind first within a day: two exams is a
  // bigger problem than a busy afternoon, and reading the smaller one first
  // would bury it.
  const rank: Record<ClashKind, number> = { exams: 0, heavy: 1, stacked: 2, committed: 3 };
  return out.sort((a, b) => a.daysAway - b.daysAway || rank[a.kind] - rank[b.kind]);
}

/**
 * The one worth saying on Today, or null.
 *
 * One, not a list. A screen that opens with four warnings is a screen people
 * learn to scroll past, and the nearest hard day is the one that changes what
 * somebody does this evening.
 */
export function worstAhead(all: Clash[]): Clash | null {
  return all[0] ?? null;
}

/** "In 9 days", "Tomorrow", "Today". */
export function whenLine(c: Clash): string {
  if (c.daysAway === 0) return 'Today';
  if (c.daysAway === 1) return 'Tomorrow';
  return `In ${c.daysAway} days`;
}

/**
 * What to do about it, which is the half a warning usually leaves out.
 *
 * Each kind has one honest answer and it is not "work harder". Two exams
 * means the revision has to start earlier; a stack at one time means picking
 * an order now rather than at 11pm; a heavy day means moving something to the
 * days on either side, which are visible on the same screen.
 */
export function adviceFor(c: Clash): string {
  switch (c.kind) {
    case 'exams':
      return 'Two exams cannot be revised for in one evening. The runway for both starts now.';
    case 'stacked':
      return 'Pick the order tonight rather than at eleven. The one worth most marks goes first.';
    case 'heavy':
      return 'Move what can move to the days either side — they are lighter, and this is early enough to.';
    case 'committed':
      return 'You already know where you will be. Whatever is due needs finishing before it.';
  }
}
