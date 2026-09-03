import { COURSE_BY_ID, COURSES, COURSE_SHORT, ITEMS, blocksFor, classNote, GUIDES } from '../data/catalog';
import { EVENTS } from '../data/events';
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
import { liveGuide } from './live';
import type {
  Appointment,
  Block,
  CourseId,
  CourseUpdate,
  DatedEvent,
  DatedItem,
  FeedEvent,
  PersonalTask,
} from './types';

/** Every deadline, dated against the current clock, soonest first. */
export function datedItems(now: Date): DatedItem[] {
  return ITEMS.map((i) => decorateItem(i, now)).sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function datedEvents(now: Date): DatedEvent[] {
  return EVENTS.map((e) => decorateEvent(e, now)).sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
}

export function itemsDueToday(now: Date): DatedItem[] {
  return datedItems(now).filter((i) => i.isToday);
}

/** What is still ahead — the app is about what is coming, not what is gone. */
export function upcomingItems(now: Date): DatedItem[] {
  return datedItems(now).filter((i) => !i.isPast);
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
export function nextClass(now: Date): NextClass | null {
  const minutes = minutesNow(now);

  const todays = blocksFor(now).filter((b) => !b.optional && !b.canceled);
  const laterToday = todays.find((b) => b.at > minutes);
  if (laterToday) {
    return {
      block: laterToday,
      inMinutes: laterToday.at - minutes,
      untilLabel: untilLabel(laterToday.at - minutes),
      note: classNote(now, laterToday.c) ?? defaultNote(laterToday, now),
      isTomorrow: false,
    };
  }

  for (let ahead = 1; ahead <= 7; ahead++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ahead);
    const first = blocksFor(day).filter((b) => !b.optional && !b.canceled)[0];
    if (first) {
      return {
        block: first,
        inMinutes: ahead * 1440 + first.at - minutes,
        untilLabel: ahead === 1 ? 'tomorrow' : `in ${ahead} days`,
        note: classNote(day, first.c) ?? defaultNote(first, now),
        isTomorrow: ahead === 1,
      };
    }
  }
  return null;
}

/** When a class has nothing special on, show what is next due for that course. */
function defaultNote(block: Block, now: Date): string {
  if (!block.c) return block.meta;
  const next = upcomingItems(now).find((i) => i.c === block.c);
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
export function feed(now: Date, done: Record<string, boolean>): FeedEntry[] {
  const entries: FeedEntry[] = [];

  blocksFor(now).forEach((b, i) => {
    entries.push({
      key: `block-${i}`,
      isClass: true,
      c: b.c,
      top: 'Today',
      bottom: b.time,
      code: b.c ? COURSE_BY_ID[b.c].code : 'Campus',
      kind: b.optional ? 'Optional' : b.canceled ? 'Canceled' : 'Class',
      title: b.title,
      meta: b.meta,
      done: false,
      canceled: !!b.canceled,
    });
  });

  upcomingItems(now)
    .slice(0, 10)
    .forEach((it) => {
      entries.push({
        key: `item-${it.id}`,
        isClass: false,
        c: it.c,
        top: it.isToday ? 'Due' : it.dow,
        bottom: it.isToday ? it.dueTime.split(',')[0] : `${it.mon} ${it.day}`,
        code: COURSE_BY_ID[it.c].code,
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

export const FEED_FILTERS = ['All', 'Due', 'Classes', 'ECON', 'PSCI', 'CORE', 'BUS'] as const;
export type FeedFilter = (typeof FEED_FILTERS)[number];

export function filterFeed(entries: FeedEntry[], filter: FeedFilter): FeedEntry[] {
  if (filter === 'All') return entries;
  if (filter === 'Classes') return entries.filter((e) => e.isClass);
  if (filter === 'Due') return entries.filter((e) => !e.isClass);
  return entries.filter((e) => e.c && COURSE_SHORT[e.c] === filter);
}

/** The Today headline — it counts down as you tick things off. */
export function punchline(left: number, total: number): string {
  // When the day was empty to begin with, the all-clear card below already says
  // so — this line says something different rather than repeating it.
  if (total === 0) return 'A clear day. Rare.';
  if (left === 0) return 'Day cleared.';
  if (left === 1) return 'One thing left. Finish it.';
  if (left === 2) return 'Two left. Both before midnight.';
  return `${left} things stand between you and done.`;
}

/** The next exam across all four courses — the Study screen's radar. */
export function nextExam(now: Date) {
  const exam = upcomingItems(now).find((i) => i.kind === 'Exam');
  if (!exam) return null;
  return {
    item: exam,
    days: daysBetween(now, exam.date),
    code: COURSE_BY_ID[exam.c].code,
  };
}

/** How many unfinished deadlines each course is carrying. */
export function loadByCourse(now: Date, done: Record<string, boolean>) {
  const ahead = upcomingItems(now);
  const max = Math.max(1, ...COURSES.map((c) => ahead.filter((i) => i.c === c.id).length));
  return COURSES.map((c) => {
    const n = ahead.filter((i) => i.c === c.id && !done[i.id]).length;
    return { code: c.code, id: c.id, n, pct: Math.round((n / max) * 100) };
  });
}

export function searchItems(now: Date, query: string): DatedItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return datedItems(now).filter((i) => {
    const course = COURSE_BY_ID[i.c];
    const haystack = [
      i.title,
      i.kind,
      i.where,
      i.detail,
      course.code,
      course.name,
      course.prof,
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
export function itemsOn(now: Date, year: number, month: number, day: number): DatedItem[] {
  const target = new Date(year, month, day);
  return datedItems(now).filter((i) => sameDay(i.date, target));
}

/** One dot per deadline in the month grid, capped at three. */
export function dotsForMonth(now: Date, year: number, month: number): Record<number, number> {
  const counts: Record<number, number> = {};
  datedItems(now).forEach((i) => {
    if (i.date.getFullYear() === year && i.date.getMonth() === month) {
      counts[i.date.getDate()] = (counts[i.date.getDate()] ?? 0) + 1;
    }
  });
  return counts;
}

/**
 * "Tonight's 25 minutes" — the weakest unit in each course, time-boxed.
 *
 * Takes the updates so a unit you have just added a reading to counts as
 * colder than it was, which is the whole point of adding it.
 */
export function tonightPlan(updates: CourseUpdate[] = []) {
  return COURSES.map((c) => {
    const guide = updates.length ? liveGuide(c.id, updates) : GUIDES[c.id];
    let weakest = guide.units[0];
    let index = 0;
    guide.units.forEach((u, i) => {
      if (u.mastery < weakest.mastery) {
        weakest = u;
        index = i;
      }
    });
    return { courseId: c.id, code: guide.code, unit: weakest, index };
  });
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
export function railFor(date: Date, appointments: Appointment[]): (Block & { mine?: boolean })[] {
  const classes = blocksFor(date);
  const mine = appointmentsOn(appointments, date).map((a) => ({
    time: a.time,
    at: a.at,
    title: a.title,
    meta: a.where || 'Added by you',
    c: null,
    mine: true,
  }));
  return [...classes, ...mine].sort((a, b) => a.at - b.at);
}

export const SEMESTER = { year: SEMESTER_YEAR };
