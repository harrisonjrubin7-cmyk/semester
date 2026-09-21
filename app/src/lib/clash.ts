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

import { dateToIso } from './date';
import { NO_TIME } from './duetime';
import { estimate, type Spent } from './pace';
import { isExam } from './runway';
import type { Commitment } from './activities';
import { eventDays, type AthleticEvent } from './athletics';
import type { DatedItem } from './types';

export type ClashKind = 'exams' | 'competition' | 'travel' | 'heavy' | 'stacked' | 'committed';

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
  /**
   * The season, from the Athletics device library. Empty for a caller that has
   * not read it, which is every caller that is not the app itself.
   */
  athletics: AthleticEvent[] = [],
): Clash[] {
  // No `now` parameter: `datedItems` has already stamped `daysAway` against
  // it, and a second clock here could disagree with the one the rest of the
  // screen is drawn from.
  const ahead = items.filter((i) => i.daysAway >= 0 && i.daysAway <= HORIZON);
  const byDay = new Map<string, DatedItem[]>();
  for (const i of ahead) {
    const day = dateToIso(i.date);
    byDay.set(day, [...(byDay.get(day) ?? []), i]);
  }

  /*
   * The season by day, built once rather than re-walked per deadline.
   *
   * `eventDays` is the same day-walk the Athletics screen uses, so a trip that
   * reads as four days there reads as four days here. A day nothing is due on
   * is not in `byDay` at all and never gets looked up: a competition on a free
   * Saturday is not a clash, it is a Saturday.
   */
  const season = new Map<string, AthleticEvent[]>();
  for (const e of athletics) {
    for (const day of eventDays(e)) season.set(day, [...(season.get(day) ?? []), e]);
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

    /*
     * An exam and a competition on one day.
     *
     * Named separately from `committed` below, which is about a weekly
     * commitment and fires on two ordinary deadlines. This fires on one exam
     * and one competition, because that pair has a different answer: nobody
     * sequences their way out of being in another state.
     *
     * Training and practice are deliberately not in here. A practice moves,
     * and a warning that fired on every evening session for every exam in the
     * fortnight is a warning somebody switches off before it ever says
     * anything about a bus to Knoxville.
     */
    const fixtures = (season.get(date) ?? []).filter((e) => e.kind === 'Competition');
    if (fixtures.length > 0 && exams.length > 0) {
      out.push({
        date,
        kind: 'competition',
        daysAway,
        items: exams,
        hours,
        unknown,
        says: `${exams.length === 1 ? 'An exam' : `${exams.length} exams`} on the day of ${fixtures.map((f) => f.title).join(' and ')}.`,
      });
    }

    /*
     * Work due on a day you are travelling.
     *
     * One deadline is enough, unlike `committed`, which wants two. The
     * difference is that a commitment is somewhere you will be for two hours
     * and travel is a day you do not have — an airport, a bus, a hotel with
     * the wifi it has — so a single paper due in the middle of it is already
     * the problem.
     */
    const away = (season.get(date) ?? []).filter((e) => e.kind === 'Travel');
    if (away.length > 0) {
      out.push({
        date,
        kind: 'travel',
        daysAway,
        items: onDay,
        hours,
        unknown,
        says: `${onDay.length === 1 ? '1 thing' : `${onDay.length} things`} due on a travel day — ${away.map((a) => a.title).join(' and ')}.`,
      });
    }

    // A day already promised to something else. The student entered the
    // commitment, so this is the app joining up two things it was told.
    /*
     * Active ones only. A commitment carries a switch — the Activities screen
     * calls it Pause and Resume, and dims the row when it is off — and this
     * read past it, so a club somebody had left still made the app say the day
     * was promised to it. Measured: paused, and the warning still read "2
     * things due on a day you have Rowing squad."
     *
     * Every other reader of this list already honours the switch: `blocksOn`
     * checks it, so the day rail, the day grid, the week grid, the hours tab
     * and the week-ahead figures all do; `ai/providers/campus.ts` filters on
     * it; the Activities screen counts with it. This was the one place that
     * did not, and the sentence it produces names the thing by name.
     */
    const busy = commitments.filter(
      (c) => c.active && c.days.includes(new Date(`${date}T12:00:00`).getDay()),
    );
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

    /*
     * Everything landing in one hour. Common, because 11:59 PM is a default.
     *
     * Grouped on `dueAt`, and `NO_TIME` is not one — it is what `duetime.ts`
     * returns for a wording that names no hour, so that a deadline with no
     * clock sorts to the end of its day rather than the top. Every such item
     * carries the same number, so they were gathered up as though they shared
     * an hour and the day was reported as a pile-up at a time none of them
     * stated. Worse, the sentence took its wording from whichever happened to
     * be first: "In class", "Before class" and "End of the week" came out as
     * "3 things due at In class", two thirds of which is not true, and where
     * the first wording was blank it read "3 things due at the same time",
     * which is not true of any of them.
     *
     * That sentence is not incidental. `worstAhead` shows one warning and
     * nearest wins, so a made-up pile-up on a near day is the single thing the
     * app says about the fortnight. A day with several untimed things due is a
     * real thing to know, and `heavy` above is what knows it — by how long the
     * work takes rather than by an hour nobody named.
     */
    const atSameTime = new Map<number, DatedItem[]>();
    for (const i of onDay) {
      if (i.dueAt >= NO_TIME) continue;
      atSameTime.set(i.dueAt, [...(atSameTime.get(i.dueAt) ?? []), i]);
    }
    for (const [, group] of atSameTime) {
      if (group.length >= STACKED) {
        out.push({
          date,
          kind: 'stacked',
          daysAway,
          items: group,
          hours,
          unknown,
          // Every one of these states an hour now, so the wording is the
          // syllabus's own rather than a stand-in. Trimmed because a `dueTime`
          // is stored exactly as it was read, padding included.
          says: `${group.length} things due at ${group[0].dueTime.trim() || 'the same time'}.`,
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
  /*
   * Two exams first, then the two a letter can still fix, then the three that
   * are about how an evening is spent. `competition` sits above `heavy`
   * because a heavy day is moveable by starting earlier and a competition is
   * not moveable at all.
   */
  const rank: Record<ClashKind, number> = {
    exams: 0,
    competition: 1,
    travel: 2,
    heavy: 3,
    stacked: 4,
    committed: 5,
  };
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
    case 'competition':
      return 'This is a letter, not a late night. Draft the absence request from Athletics while there is still time for an answer, and ask about the arrangement rather than assuming one.';
    case 'travel':
      return 'A travel day has no desk in it. Finish what you can before you go, and take the rest offline.';
    case 'stacked':
      return 'Pick the order tonight rather than at eleven. The one worth most marks goes first.';
    case 'heavy':
      return 'Move what can move to the days either side — they are lighter, and this is early enough to.';
    case 'committed':
      return 'You already know where you will be. Whatever is due needs finishing before it.';
  }
}
