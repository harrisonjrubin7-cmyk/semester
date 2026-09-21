/**
 * The hours log, added up by week — a record, never a determination.
 *
 * "CARA" is what an athletics department calls countable athletically-related
 * activity, and an athlete is usually told to keep a record of theirs. The
 * record they are given is a paper sheet or a spreadsheet nobody reconciles,
 * and the thing it is for — noticing in week six that the weeks are running
 * long, while something can still be said about it — is the thing a sheet in a
 * drawer cannot do.
 *
 * So this adds them up. That is the whole of it, and the limit of it.
 *
 * ## What it refuses to do, and why the refusal is the feature
 *
 * It does not decide whether an activity counts. It does not decide what the
 * limit is. It does not say whether a week was compliant, and it never will.
 *
 * Whether a given hour is countable is a real question with a real answer, and
 * the answer depends on the division, the sport, whether the sport is in or
 * out of its playing season, the academic year, and legislation that changes —
 * and it belongs to a compliance officer who can be asked. The figures usually
 * quoted (20 hours a week in season, 8 out of season, one day off) come from
 * NCAA Bylaw 17 and are not constants in this file for exactly that reason:
 * `lib/degree.ts` makes the same refusal about degree requirements at greater
 * length, and the argument is the same one. A confidently wrong number here is
 * found out by an athlete when nothing can be done about it.
 *
 * The arithmetic is therefore done against a figure the *student* entered,
 * from whoever told them, and a log with no figure entered is a log with a
 * total and no verdict — which is still worth more than a drawer.
 *
 * ## The week runs Monday to Sunday
 *
 * Because that is how a playing week is usually counted and how a practice
 * schedule is usually published. `lib/weekly.ts` starts its week on Sunday for
 * the report, which is a different question — a student looking back at a week
 * of study on a Sunday evening — and the two are not reconciled on purpose.
 */

import type { AthleticEvent, CaraEntry } from './athletics';
import { eventDays, hoursOnDay } from './athletics';
import { longLabel } from './date';

/** A week of the log, as a row. */
export interface CaraWeek {
  /** The Monday, `YYYY-MM-DD`. */
  start: string;
  /** How it reads — "Mon Sep 14". */
  label: string;
  hours: number;
  entries: CaraEntry[];
  /**
   * Days with at least one entry on them. An athlete is usually told they are
   * owed a day off a week; this is the count that question is asked of, and
   * the app does not ask it for them.
   */
  daysWith: number;
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The Monday of the week a day falls in, as `YYYY-MM-DD`. */
export function weekOf(day: string): string {
  const d = new Date(`${day}T12:00`);
  if (Number.isNaN(d.getTime())) return day;
  // getDay() is 0 for Sunday, so Sunday belongs to the week that began six
  // days earlier rather than to the one starting tomorrow.
  const back = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - back);
  return iso(d);
}

/** Every week with anything logged in it, most recent first. */
export function weeks(entries: CaraEntry[]): CaraWeek[] {
  const by = new Map<string, CaraEntry[]>();
  for (const e of entries) {
    const key = weekOf(e.date);
    by.set(key, [...(by.get(key) ?? []), e]);
  }
  return [...by.entries()]
    .map(([start, held]) => ({
      start,
      label: longLabel(new Date(`${start}T12:00`)),
      // Rounded once, at the end, to a tenth. Summing rounded entries is how a
      // week of twenty half-hours comes to 9.8.
      hours: Math.round(held.reduce((n, e) => n + e.hours, 0) * 10) / 10,
      entries: [...held].sort((a, b) => a.date.localeCompare(b.date)),
      daysWith: new Set(held.map((e) => e.date)).size,
    }))
    .sort((a, b) => b.start.localeCompare(a.start));
}

/** The whole log, in hours. */
export function logged(entries: CaraEntry[]): number {
  return Math.round(entries.reduce((n, e) => n + e.hours, 0) * 10) / 10;
}

/**
 * The limit the student typed, as a number, or null.
 *
 * Free text in, because people write "20", "20 hours", "20/wk". Anything that
 * is not a plain positive number of hours comes back null and the screen shows
 * a total with no comparison — which is honest, and better than measuring a
 * week against a figure parsed out of a sentence nobody checked.
 */
export function limitOf(text: string): number | null {
  const found = /^\s*(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours)?\s*(?:\/\s*(?:wk|week))?\s*$/i.exec(text);
  if (!found) return null;
  const n = Number(found[1]);
  return Number.isFinite(n) && n > 0 && n <= 168 ? n : null;
}

/**
 * What a week's line says — a count, and against the student's own figure when
 * they have given one.
 *
 * Never "over the limit" and never "compliant". The first is a determination
 * this app is not entitled to make and the second is worse, because somebody
 * would rely on it. "Above the 20 you entered" is a fact about two numbers the
 * student supplied, which is all this can honestly be.
 */
export function weekLine(week: CaraWeek, limit: number | null): string {
  const hours = `${week.hours} ${week.hours === 1 ? 'hour' : 'hours'} logged`;
  const days = `${week.daysWith} of 7 days`;
  if (limit === null) return `${hours} · ${days}`;
  const diff = Math.round((week.hours - limit) * 10) / 10;
  if (diff > 0) return `${hours} · ${days} · ${diff} above the ${limit} you entered`;
  return `${hours} · ${days} · ${Math.abs(diff)} below the ${limit} you entered`;
}

/**
 * The log entries a week of the season would produce, if the student says so.
 *
 * Typing a practice twice — once as a calendar event and once as an hours
 * entry — is the reason a log stops being kept in week three. The season is
 * already in this workspace with its hours in it, so this offers them back.
 *
 * It offers rather than writes, and the screen makes that a press. Whether
 * these hours are countable is not something the app knows: a recreational
 * kickabout and a required lift are both `Training` on the Athletics screen,
 * and only the athlete knows which was required. So `Recreation` is left out
 * entirely, and everything else comes back as a *draft* the student can edit
 * or delete before it is anything.
 *
 * Hours come from `hoursOnDay`, so a trip contributes the part of it that fell
 * in each day rather than its whole span against the day it left on — the same
 * clipping the week-ahead planner uses.
 */
export function fromSeason(events: AthleticEvent[], from: string, to: string): Omit<CaraEntry, 'id'>[] {
  const out: Omit<CaraEntry, 'id'>[] = [];
  for (const e of events) {
    if (e.kind === 'Recreation') continue;
    for (const day of eventDays(e)) {
      if (day < from || day > to) continue;
      const hours = Math.round(hoursOnDay([e], new Date(`${day}T12:00`)) * 10) / 10;
      if (hours <= 0) continue;
      out.push({
        date: day,
        hours: Math.min(hours, 24),
        kind:
          e.kind === 'Competition'
            ? 'Competition'
            : e.kind === 'Travel'
              ? 'Required travel'
              : e.kind === 'Meeting'
                ? 'Film or team meeting'
                : e.kind === 'Training'
                  ? 'Required weights or conditioning'
                  : 'Practice',
        note: `From your schedule: ${e.title}`,
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
