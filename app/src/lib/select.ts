import { blocksFor, classNote, codeOf, type Catalog } from '../data/catalog';
import { CAMPUS_CALENDARS } from '../data/events';
import {
  dateToIso,
  daysBetween,
  decorateEvent,
  decorateItem,
  minutesNow,
  sameDay,
  SEMESTER_YEAR,
  untilLabel,
} from './date';
import { blocksOn, type Commitment } from './activities';
import { hasTime } from './duetime';
import { punchline as tonePunchline, type Tone } from './tone';
import type {
  Appointment,
  Block,
  CampusEvent,
  CourseId,
  DatedEvent,
  DatedItem,
  FeedEvent,
  PersonalTask,
} from './types';

/*
 * A note on `cat.byId[…]`, which appears throughout.
 *
 * Every item in a catalogue comes from a module in that catalogue, so its
 * course is normally right there. "Normally" is doing work: a module arrives
 * from sync, from a restored backup, or from a course file somebody shared,
 * and nothing on the way in checks that each item's `c` names its own course.
 * One that does not used to throw here — and because this file feeds the Today
 * screen, the result was a white page on the app's home tab, from data that
 * had synced in perfectly quietly.
 *
 * So course lookups go through `codeOf`, which falls back rather than throws.
 * An orphaned deadline showing its bare id is a visible oddity somebody can
 * report; a blank screen is not.
 */

/** Every deadline, dated against the current clock, soonest first. */
export function datedItems(cat: Catalog, now: Date): DatedItem[] {
  return cat.items
    .map((i) => decorateItem(i, now))
    // By day, then by the hour inside the day. The second half is new: a
    // checklist used to put "In class" above "9:00 AM" because the order was
    // whatever the syllabus happened to list. See `lib/duetime.ts`.
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.dueAt - b.dueAt);
}

/**
 * The campus calendar this student actually has.
 *
 * Keyed by where they study rather than by whether the sample semester is on:
 * the listings are one university's, and a Vanderbilt student who imports
 * their own syllabi is still at Vanderbilt. See `data/events.ts`.
 *
 * The sample stays a way in for somebody who has set no school and is only
 * looking around — it is a Vanderbilt semester, so it carries Vanderbilt's
 * calendar with it.
 */
export function campusCalendar(schoolId: string, sample = false): CampusEvent[] {
  return CAMPUS_CALENDARS[schoolId] ?? (sample ? CAMPUS_CALENDARS.vanderbilt : []);
}

export function datedEvents(now: Date, schoolId = '', sample = false): DatedEvent[] {
  return campusCalendar(schoolId, sample)
    .map((e) => decorateEvent(e, now))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function itemsDueToday(cat: Catalog, now: Date): DatedItem[] {
  return datedItems(cat, now).filter((i) => i.isToday);
}

/** What is still ahead — the app is about what is coming, not what is gone. */
export function upcomingItems(cat: Catalog, now: Date): DatedItem[] {
  return datedItems(cat, now).filter((i) => !i.isPast);
}

export interface NextClass {
  block: Block;
  /** Minutes from now until it starts; negative once it has begun. */
  inMinutes: number;
  untilLabel: string;
  note: string;
  isTomorrow: boolean;
}

/**
 * The next class card. Looks at today's remaining blocks first, then walks
 * forward up to a week to find the next teaching day — so the card is never
 * empty on a Saturday.
 */
export function nextClass(cat: Catalog, now: Date): NextClass | null {
  const minutes = minutesNow(now);

  const todays = blocksFor(cat, now).filter((b) => !b.optional && !b.canceled);
  const laterToday = todays.find((b) => b.at > minutes);
  if (laterToday) {
    return {
      block: laterToday,
      inMinutes: laterToday.at - minutes,
      untilLabel: untilLabel(laterToday.at - minutes),
      note: classNote(cat, now, laterToday.c) ?? defaultNote(cat, laterToday, now),
      isTomorrow: false,
    };
  }

  for (let ahead = 1; ahead <= 7; ahead++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead);
    const first = blocksFor(cat, day).filter((b) => !b.optional && !b.canceled)[0];
    if (first) {
      return {
        block: first,
        inMinutes: ahead * 1440 + first.at - minutes,
        untilLabel: ahead === 1 ? 'tomorrow' : `in ${ahead} days`,
        note: classNote(cat, day, first.c) ?? defaultNote(cat, first, now),
        isTomorrow: ahead === 1,
      };
    }
  }
  return null;
}

/** When a class has nothing special on, show what is next due for that course. */
function defaultNote(cat: Catalog, block: Block, now: Date): string {
  if (!block.c) return block.meta;
  const next = upcomingItems(cat, now).find((i) => i.c === block.c);
  if (!next) return block.meta;
  return `Next up: ${next.title} · ${next.dueShort}`;
}

export interface FeedEntry {
  key: string;
  isClass: boolean;
  c: CourseId | null;
  top: string;
  bottom: string;
  code: string;
  kind: string;
  title: string;
  meta: string;
  done: boolean;
  canceled: boolean;
  itemId?: string;
}

/**
 * The single chronological scroll behind nav mode 1B: today's classes and every
 * upcoming deadline, interleaved.
 */
export function feed(cat: Catalog, now: Date, done: Record<string, boolean>): FeedEntry[] {
  const entries: FeedEntry[] = [];

  blocksFor(cat, now).forEach((b, i) => {
    entries.push({
      key: `block-${i}`,
      isClass: true,
      c: b.c,
      top: 'Today',
      bottom: b.time,
      code: b.c ? codeOf(cat, b.c) : 'Campus',
      kind: b.optional ? 'Optional' : b.canceled ? 'Canceled' : 'Class',
      title: b.title,
      meta: b.meta,
      done: false,
      canceled: !!b.canceled,
    });
  });

  upcomingItems(cat, now)
    .slice(0, 10)
    .forEach((it) => {
      entries.push({
        key: `item-${it.id}`,
        isClass: false,
        c: it.c,
        top: it.isToday ? 'Due' : it.dow,
        bottom: it.isToday ? it.dueTime.split(',')[0] : `${it.mon} ${it.day}`,
        code: codeOf(cat, it.c),
        kind: it.kind,
        title: it.title,
        meta: `${it.dueTime} · ${it.where}`,
        done: !!done[it.id],
        canceled: false,
        itemId: it.id,
      });
    });

  return entries;
}

/** Chips for the feed: the fixed three, then one per course in the catalog. */
export function feedFilters(cat: Catalog): string[] {
  return ['All', 'Due', 'Classes', ...cat.shortCodes];
}
export type FeedFilter = string;

export function filterFeed(cat: Catalog, entries: FeedEntry[], filter: FeedFilter): FeedEntry[] {
  if (filter === 'All') return entries;
  if (filter === 'Classes') return entries.filter((e) => e.isClass);
  if (filter === 'Due') return entries.filter((e) => !e.isClass);
  return entries.filter((e) => e.c && cat.short[e.c] === filter);
}

/**
 * The Today headline — it counts down as you tick things off.
 *
 * The words live in `lib/tone.ts` now, because they are the ones a student
 * reads when they are behind and the phrasing is a setting. The counting is
 * still here and is the same whatever tone is on.
 */
export function punchline(left: number, total: number, tone: Tone = 'direct'): string {
  return tonePunchline(left, total, tone);
}

/** The next exam across all four courses — the Study screen's radar. */
export function nextExam(cat: Catalog, now: Date) {
  const exam = upcomingItems(cat, now).find((i) => i.kind === 'Exam');
  if (!exam) return null;
  return {
    item: exam,
    days: daysBetween(now, exam.date),
    code: codeOf(cat, exam.c),
  };
}

/**
 * Kinds of deadline that are a test — the ones revising is *for*.
 *
 * A quiz counts. Most courses set far more quizzes than exams, so a plan that
 * only knew about exams was blind to the thing most weeks are actually
 * building toward, which is how "your weakest unit" could sit above a unit
 * being quizzed on Thursday.
 */
const TESTS = new Set(['Exam', 'Midterm', 'Quiz', 'Final']);

/**
 * A course's next test: how many days off, and what kind it is.
 *
 * Separate from {@link nextExam}, which answers a different question — the one
 * exam nearest across the whole semester, for the radar at the top of Study.
 * This is per course, because ranking one course's units against another's
 * needs to know that ECON is examined on Thursday and HIST is not.
 *
 * The kind comes back with it so the sentence built from this can say "quiz in
 * two days" rather than promoting every quiz to an exam.
 */
export function testedIn(
  cat: Catalog,
  now: Date,
  courseId: CourseId,
): { days: number; kind: string } | null {
  const next = upcomingItems(cat, now).find((i) => i.c === courseId && TESTS.has(i.kind));
  return next ? { days: Math.max(0, daysBetween(now, next.date)), kind: next.kind } : null;
}

/** How many unfinished deadlines each course is carrying. */
export function loadByCourse(cat: Catalog, now: Date, done: Record<string, boolean>) {
  const ahead = upcomingItems(cat, now);
  const max = Math.max(1, ...cat.courses.map((c) => ahead.filter((i) => i.c === c.id).length));
  return cat.courses.map((c) => {
    const n = ahead.filter((i) => i.c === c.id && !done[i.id]).length;
    return { code: c.code, id: c.id, n, pct: Math.round((n / max) * 100) };
  });
}

export function searchItems(cat: Catalog, now: Date, query: string): DatedItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return datedItems(cat, now).filter((i) => {
    const course = cat.byId[i.c];
    const haystack = [
      i.title,
      i.kind,
      i.where,
      i.detail,
      course?.code,
      course?.name,
      course?.prof,
      i.dueShort,
      i.mon,
      i.dow,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

/** Deadlines falling on a given day of the displayed month. */
export function itemsOn(cat: Catalog, now: Date, year: number, month: number, day: number): DatedItem[] {
  const target = new Date(year, month, day);
  return datedItems(cat, now).filter((i) => sameDay(i.date, target));
}

/** One dot per deadline in the month grid, capped at three. */
export function dotsForMonth(cat: Catalog, now: Date, year: number, month: number): Record<number, number> {
  const counts: Record<number, number> = {};
  datedItems(cat, now).forEach((i) => {
    if (i.date.getFullYear() === year && i.date.getMonth() === month) {
      counts[i.date.getDate()] = (counts[i.date.getDate()] ?? 0) + 1;
    }
  });
  return counts;
}

// ── Your own things, folded into the day ──────────────────────────────────

/** Personal tasks due on a given day. */
export function tasksOn(tasks: PersonalTask[], date: Date): PersonalTask[] {
  const iso = dateToIso(date);
  return tasks.filter((t) => t.date === iso);
}

/** Anything a connected calendar says is on that day, in time order. */
export function feedEventsOn(events: FeedEvent[], date: Date): FeedEvent[] {
  const iso = dateToIso(date);
  return events
    .filter((e) => e.date === iso)
    .sort((a, b) => (a.at ?? -1) - (b.at ?? -1));
}

/** Appointments on a given day, in time order. */
export function appointmentsOn(appointments: Appointment[], date: Date): Appointment[] {
  const iso = dateToIso(date);
  return appointments.filter((a) => a.date === iso).sort((a, b) => a.at - b.at);
}

/**
 * The full rail for a day: classes from the syllabi and your own appointments,
 * merged in time order. Appointments are marked `mine` so the UI can show whose
 * they are rather than implying the syllabus asked for them.
 */
export function railFor(
  cat: Catalog,
  date: Date,
  appointments: Appointment[],
  commitments: Commitment[] = [],
  /**
   * Deadlines falling on this day, so one with a real hour on it sits where
   * it happens rather than in a list above the day. Only the ones whose
   * wording names a time — "In class" is a thing you have all day for, and
   * drawing it at midnight would be inventing an hour.
   */
  due: DatedItem[] = [],
): (Block & { mine?: boolean; kind?: string; minutes?: number; from?: { kind: 'appointment' | 'item'; id: string } })[] {
  const classes = blocksFor(cat, date);
  const mine = appointmentsOn(appointments, date).map((a) => ({
    time: a.time,
    at: a.at,
    title: a.title,
    meta: a.where || 'Added by you',
    c: null,
    mine: true,
    kind: a.kind ?? 'other',
    // What this block *is*, so a grid can move it. The id below is built from
    // the time and the title and is only unique within a day's render — good
    // enough to draw with, useless for changing anything.
    from: { kind: 'appointment' as const, id: a.id },
  }));
  // A club, a shift, a practice. They are on the day whether or not the app
  // draws them, and a Tuesday that already has practice on it should look
  // full before you agree to something else.
  const standing = blocksOn(commitments, date);

  const deadlines = due
    .filter((i) => sameDay(i.date, date) && hasTime(i.dueTime))
    .map((i) => ({
      time: i.dueTime,
      at: i.dueAt,
      title: i.title,
      meta: [codeOf(cat, i.c), i.kind].filter(Boolean).join(' · '),
      c: i.c,
      // Dimmer than a class, like office hours: it is a moment rather than a
      // room you have to be in.
      optional: true,
      from: { kind: 'item' as const, id: i.id },
    }));

  return [...classes, ...mine, ...standing, ...deadlines].sort((a, b) => a.at - b.at);
}

/**
 * A day as blocks an hour grid can draw.
 *
 * Classes carry a real length from the syllabus; anything you added is a point
 * in time, so it gets fifty minutes — long enough to read, short enough not to
 * imply a duration nobody stated.
 */
export function hoursFor(
  cat: Catalog,
  date: Date,
  appointments: Appointment[],
  commitments: Commitment[] = [],
  /** Deadlines with an hour on them, so the grid can draw and move them too. */
  due: DatedItem[] = [],
): {
  id: string;
  title: string;
  meta: string;
  at: number;
  minutes: number;
  kind: string | null;
  /** Which course a class belongs to, so the grid can colour it. */
  c: CourseId | null;
  canceled?: boolean;
  /** The record this block was drawn from, where there is one that can move. */
  from?: { kind: 'appointment' | 'item'; id: string };
}[] {
  return railFor(cat, date, appointments, commitments, due).map((b, i) => ({
    id: `${b.at}-${i}-${b.title}`,
    ...(b.from ? { from: b.from } : {}),
    title: b.title,
    // A commitment states its own length; an appointment is a point in time
    // and gets fifty minutes rather than a duration nobody stated.
    minutes: b.minutes ?? (b.mine ? 50 : lengthOf(cat, b)),
    meta: b.meta,
    at: b.at,
    kind: b.mine ? (b.kind ?? 'other') : null,
    // A class's course, carried through so the grid can draw it in that
    // course's colour. `railFor` has always known it; the grid never got it.
    c: b.c ?? null,
    canceled: b.canceled,
  }));
}

/**
 * How long a class runs.
 *
 * The recurring schedule states a start and no end, but the course's `meets`
 * line usually carries both — "T/R · 1:15–2:30p" is seventy-five minutes and
 * "MWF · 9:05–9:55a" is fifty. Parsed from there, because it is data the app
 * already has; fifty when the line does not say, which is the common case and
 * an honest default rather than a guess at something longer.
 */
export function lengthOf(cat: Catalog, block: Block): number {
  const meets = block.c ? cat.byId[block.c]?.meets : '';
  const mins = spanOf(meets ?? '');
  return mins ?? 50;
}

/** Minutes between the two times in "1:15–2:30p", or null. */
export function spanOf(meets: string): number | null {
  const m = meets.match(/(\d{1,2})(?::(\d{2}))?\s*([ap])?\s*[–—-]\s*(\d{1,2})(?::(\d{2}))?\s*([ap])?/i);
  if (!m) return null;

  const [, h1, m1, ap1, h2, m2, ap2] = m;
  // A range usually marks the meridiem once, at the end — "9:05–9:55a" is both
  // morning. When only the start says, the end inherits it, and vice versa.
  const half = (ap1 || ap2 || '').toLowerCase();
  const to24 = (h: string, suffix: string) => {
    let hour = Number(h) % 12;
    if (suffix === 'p') hour += 12;
    return hour;
  };
  const start = to24(h1, (ap1 || half).toLowerCase()) * 60 + Number(m1 ?? 0);
  let end = to24(h2, (ap2 || half).toLowerCase()) * 60 + Number(m2 ?? 0);
  // "11:30–1:00p" crosses noon: the end is simply later than the start.
  if (end <= start) end += 12 * 60;
  const span = end - start;
  return span > 0 && span <= 5 * 60 ? span : null;
}

export const SEMESTER = { year: SEMESTER_YEAR };
