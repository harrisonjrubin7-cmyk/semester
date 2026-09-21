import type { Catalog } from '../data/catalog';
import { blocksFor } from '../data/catalog';
import { dateToIso, decorateItem, longLabel } from './date';
import { obj, textValue } from './device-library';
import type { CourseId } from './types';

/**
 * A season, as the person living it has to plan around it.
 *
 * Not a fixture list. The app already has one of those — `data/events.ts`
 * carries the athletics fixtures anybody can go and watch. This is the other
 * side: the practices, the training, and above all the *travel*, which is the
 * thing that collides with a midterm and needs a letter written three weeks
 * beforehand.
 *
 * Which is why an event here spans a range rather than sitting on a day, and
 * why `eventDays` exists. A bus leaving Thursday afternoon and returning
 * Sunday night is four days of missed classes, and a planner that stored one
 * date would show one.
 *
 * ## The absence draft is a draft
 *
 * `absenceDraft` writes a letter to a professor and says, in its first line,
 * that it is not an official travel authorization. It cannot be: authorizing
 * an absence is something an athletics office does, and this app has no
 * connection to one. What it can do is have the right words ready and the
 * conflicting classes already listed, which is most of the work.
 */

export const ATHLETIC_KINDS = ['Practice', 'Competition', 'Training', 'Travel', 'Meeting', 'Recreation'] as const;

export type AthleticKind = (typeof ATHLETIC_KINDS)[number];

export interface AthleticEvent {
  id: string;
  title: string;
  team: string;
  kind: AthleticKind;
  /** `YYYY-MM-DDTHH:MM`, local. A range, not a day — see above. */
  start: string;
  end: string;
  where: string;
  notes: string;
  steps: { text: string; done: boolean }[];
}

export interface AthleticsLibrary {
  version: 1;
  events: AthleticEvent[];
}

export const EMPTY_ATHLETICS: AthleticsLibrary = { version: 1, events: [] };

/** The caps, named once so the reader and the message cannot disagree. */
export const ATHLETICS_LIMITS = {
  events: 250,
  title: 160,
  team: 160,
  where: 300,
  notes: 8000,
  steps: 30,
  stepText: 500,
  /** The longest an event may run. A season is not one event. */
  days: 31,
} as const;

const LOCAL_MINUTE = /^\d{4}-\d\d-\d\dT\d\d:\d\d$/;

/**
 * An athletics library out of storage or a file, or an error.
 *
 * The time checks are the substance. A start and an end that parse is not
 * enough: an end at or before the start makes `eventDays` loop forever, and an
 * event spanning a year would put a "Travel" band across every day of the
 * term. Both are stated here rather than guarded at each call site.
 */
export function readAthletics(value: unknown): AthleticsLibrary {
  if (
    !obj(value) ||
    value.version !== 1 ||
    !Array.isArray(value.events) ||
    value.events.length > ATHLETICS_LIMITS.events
  ) {
    throw new Error(`Use a version 1 athletics export with up to ${ATHLETICS_LIMITS.events} events.`);
  }

  const ids = new Set<string>();
  for (const e of value.events) {
    const shaped =
      obj(e) &&
      textValue(e.id, 100) &&
      !ids.has(e.id as string) &&
      textValue(e.title, ATHLETICS_LIMITS.title) &&
      !!(e.title as string).trim() &&
      textValue(e.team, ATHLETICS_LIMITS.team) &&
      ATHLETIC_KINDS.includes(e.kind as AthleticKind) &&
      textValue(e.where, ATHLETICS_LIMITS.where) &&
      textValue(e.notes, ATHLETICS_LIMITS.notes) &&
      textValue(e.start, 30) &&
      textValue(e.end, 30) &&
      LOCAL_MINUTE.test(e.start as string) &&
      LOCAL_MINUTE.test(e.end as string) &&
      Number.isFinite(Date.parse(e.start as string)) &&
      Number.isFinite(Date.parse(e.end as string)) &&
      // Strictly after, so a zero-length event cannot hang `eventDays`.
      Date.parse(e.end as string) > Date.parse(e.start as string) &&
      Date.parse(e.end as string) - Date.parse(e.start as string) <=
        ATHLETICS_LIMITS.days * 86_400_000 &&
      Array.isArray(e.steps) &&
      e.steps.length <= ATHLETICS_LIMITS.steps &&
      !e.steps.some(
        (s: unknown) => !obj(s) || !textValue(s.text, ATHLETICS_LIMITS.stepText) || typeof s.done !== 'boolean',
      );

    if (!shaped) {
      throw new Error(
        `Check event titles, times and checklists. An event runs from its start to a later end, up to ${ATHLETICS_LIMITS.days} days.`,
      );
    }
    ids.add(e.id as string);
  }
  return value as unknown as AthleticsLibrary;
}

/**
 * Every local day an event touches, as `YYYY-MM-DD`.
 *
 * Walked a day at a time from local midnight rather than divided out of the
 * millisecond span, because the two disagree twice a year: a trip across a
 * daylight-saving boundary is 23 or 25 hours long, and arithmetic on the span
 * drops or repeats a day exactly when somebody is furthest from campus.
 */
export function eventDays(e: AthleticEvent): string[] {
  const out: string[] = [];
  const at = new Date(e.start);
  at.setHours(0, 0, 0, 0);
  const end = new Date(e.end);
  while (at < end) {
    const y = at.getFullYear();
    const m = String(at.getMonth() + 1).padStart(2, '0');
    const d = String(at.getDate()).padStart(2, '0');
    out.push(`${y}-${m}-${d}`);
    at.setDate(at.getDate() + 1);
  }
  return out;
}

/** Whether two spans share any time at all. Half-open, so touching is not overlapping. */
export const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) =>
  Date.parse(a.start) < Date.parse(b.end) && Date.parse(a.end) > Date.parse(b.start);

/**
 * The letter, with the conflicts already in it.
 *
 * The bracketed first line is not decoration: this is a document a student
 * will paste into an email to somebody who can hold their grade, and it must
 * not read as though an authority produced it. The request it makes is to
 * *discuss*, because asking for an arrangement the professor has not agreed
 * to is how a letter like this gets a short answer.
 */
export function absenceDraft(e: AthleticEvent, conflicts: string[]): string {
  const when = `${e.start.replace('T', ' ')} through ${e.end.replace('T', ' ')}`;
  const affected = conflicts.length
    ? `Classes or work to discuss:\n${conflicts.map((c) => `- ${c}`).join('\n')}`
    : 'I will confirm any affected classes and assessments with you.';

  return [
    '# Absence request draft',
    '',
    'Please review before sending. This is not an official travel authorization.',
    '',
    'Hello Professor,',
    '',
    `I am planning to travel with ${e.team || 'my team'} for ${e.title}, from ${when}.`,
    '',
    affected,
    '',
    'Could we discuss how to prepare for any missed material, and the process for any assessment arrangements? I will provide official documentation from the authorized athletics office when it is available.',
    '',
    'Thank you.',
  ].join('\n');
}

/**
 * Where a student's own season is kept, named once.
 *
 * The key carries the account and the term, same as the Athletics screen has
 * always written it. It moved out here the moment a second reader appeared:
 * the week-ahead arithmetic reads this library too, and a planner keyed on a
 * string one character different from the screen's would report a season of
 * nothing, convincingly, forever.
 */
export function athleticsKey(accountId: string | undefined, term: string): string {
  return `semester.athletics.v1:${accountId || 'device'}:${term}`;
}

/**
 * Hours an event takes out of one local day.
 *
 * Clipped to the day at both ends, which is the whole difficulty. A bus
 * leaving Thursday at four and returning Sunday at eight is 76 hours long and
 * none of the three planners it touches wants that number: Thursday loses
 * eight of its evening, Friday and Saturday lose everything, Sunday loses its
 * morning. Counting the span against the departure day instead would put
 * three days of travel into one Thursday and leave the weekend reading empty.
 *
 * A day is capped at its own length by construction, since both edges are
 * clamped to the day's own midnights.
 */
export function hoursOnDay(events: { start: string; end: string }[], date: Date): number {
  // Both edges from the calendar rather than from a 24-hour step, for
  // `eventDays`'s reason: a day across a daylight-saving boundary is 23 or 25
  // hours long, and a fixed step would clip an hour off one day of the year
  // and double-count an hour on another.
  const from = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const to = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
  let ms = 0;
  for (const e of events) {
    const a = Date.parse(e.start);
    const b = Date.parse(e.end);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) continue;
    ms += Math.max(0, Math.min(b, to) - Math.max(a, from));
  }
  return ms / 3_600_000;
}

/**
 * What a trip's days hold, course by course.
 *
 * The Athletics screen's own `conflicts` answers this at the hour — it clips
 * the first and last days to the event's own times, so leaving at four on
 * Thursday does not cost the Thursday morning lecture. That is the right
 * answer to *what does this trip cost me*, and the wrong shape for two other
 * questions the app now asks: which courses to bundle for offline, and who to
 * write to.
 *
 * Both of those are course-shaped and day-shaped, so this is too. It is
 * deliberately the coarser reading: a professor writing back about a Thursday
 * you are on a bus for does not care that the bus left at four.
 */
export interface Missed {
  course: CourseId;
  /** Class meetings inside the days — "Fri Sep 18 · Lecture". */
  classes: string[];
  /** Deadlines falling inside the days — "Fri Sep 18 · Problem Set 4". */
  due: string[];
}

export function runsOver(catalog: Catalog, days: string[], now: Date): Missed[] {
  const found = new Map<CourseId, Missed>();
  const add = (course: CourseId): Missed => {
    const held = found.get(course) ?? { course, classes: [], due: [] };
    found.set(course, held);
    return held;
  };

  for (const day of days) {
    // Midday, so a date built from the string cannot land on the day before in
    // a timezone behind UTC. `lib/date.ts` makes the same move.
    const date = new Date(`${day}T12:00`);
    if (Number.isNaN(date.getTime())) continue;
    const label = longLabel(date);

    for (const b of blocksFor(catalog, date)) {
      if (b.canceled || !b.c) continue;
      add(b.c).classes.push(`${label} · ${b.title}`);
    }
    for (const i of catalog.items) {
      if (dateToIso(decorateItem(i, now).date) === day) add(i.c).due.push(`${label} · ${i.title}`);
    }
  }
  return [...found.values()];
}

/**
 * The absence note as an email rather than as a document.
 *
 * The document version above is the one to keep, print or hand to an athletics
 * office. This is the one that gets *sent*, which is a different artefact:
 * addressed to one professor, about one course, with no markdown headings in
 * it — a `#` in an email body is a `#` in a professor's inbox.
 *
 * It says the same first thing for the same reason, and it asks rather than
 * announces. Everything factual in it comes from the student's own calendar
 * and the syllabus the app already holds; nothing about why, because the app
 * does not know why and `lib/mail.ts` forbids it inventing one.
 */
export function absenceEmail(
  e: AthleticEvent,
  course: { code: string; name?: string },
  missed: Missed,
): { subject: string; body: string } {
  const when = `${e.start.replace('T', ' ')} through ${e.end.replace('T', ' ')}`;
  const lines = [...missed.classes.map((c) => `- Class: ${c}`), ...missed.due.map((d) => `- Due: ${d}`)];

  return {
    subject: `${course.code} — absence for ${e.title}`,
    body: [
      'Hello Professor,',
      '',
      `I am travelling with ${e.team || 'my team'} for ${e.title}, from ${when}, and will miss the following in ${course.code}:`,
      '',
      lines.length > 0 ? lines.join('\n') : '- I will confirm exactly which sessions this affects.',
      '',
      'Could we discuss how to prepare for the material I will miss, and the process for any assessment arrangements? I will send official documentation from the athletics office when I have it — this message is not one.',
      '',
      'Thank you.',
    ].join('\n'),
  };
}
