import { blocksFor, classNote, codeOf, type Catalog } from '../data/catalog';
import { occursOn } from './repeat';
import { CAMPUS_CALENDARS } from '../data/events';
import {
  dateToIso,
  daysBetween,
  shiftIso,
  decorateEvent,
  decorateItem,
  minutesNow,
  sameDay,
  untilLabel,
} from './date';
import { blocksOn, type Commitment } from './activities';
import { hasTime, readDue } from './duetime';
import { CAMPUS_KIND } from './kinds';
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
    .sort(byTime);
}

/**
 * Whether a screen that shows dated things has nothing at all to show.
 *
 * `catalog.empty` was the whole test, on seven screens. It is the right test
 * for five of them — Courses, Study, Behind, Tonight and Meet are about
 * graded coursework, and there is no such thing without a syllabus. It is the
 * wrong test for the two that also show what the student put in themselves.
 *
 * Measured: with no courses, one task and one appointment dated today, the
 * calendar said "Nothing on the calendar yet" and Today said "Nothing on
 * today yet" — both entries made through this app's own screens, both dated,
 * both denied. Only Personal showed them. That is the same failure the month
 * panel had one level down, on the whole screen: the app telling somebody
 * there is nothing there about a thing they put there.
 *
 * The campus calendar is deliberately not counted. It is not the student's
 * doing — it is there for anybody with a school set, which is everybody by
 * default — so counting it would make the first run unreachable on these two
 * screens rather than fixing anything. A fresh install with no syllabi and
 * nothing added still gets told where to start.
 */
export function nothingYet(
  cat: Catalog,
  own: { tasks: PersonalTask[]; appointments: Appointment[]; feedEvents: FeedEvent[] },
): boolean {
  return (
    cat.empty &&
    own.tasks.length === 0 &&
    own.appointments.length === 0 &&
    own.feedEvents.length === 0
  );
}

/**
 * How much is still to do — the syllabus's and the student's, together.
 *
 * The springboard's one line of summary counted `catalog.items` alone, so a
 * launcher with a task on it said "Nothing outstanding." That is the home
 * screen under that navigation, which makes it the first sentence the app
 * says to somebody who opens it.
 *
 * Appointments are deliberately not counted. An appointment is not
 * outstanding work — it is a time you have to be somewhere — and a line
 * calling it a thing to do would be the opposite error.
 */
export function outstanding(
  cat: Catalog,
  state: { done: Record<string, boolean>; tasks: PersonalTask[] },
): number {
  return (
    cat.items.filter((i) => !state.done[i.id]).length +
    state.tasks.filter((t) => !t.done).length
  );
}

/**
 * How long an appointment runs when it does not say.
 *
 * An hour. Every appointment used to be drawn as fifty minutes — a class
 * period, which is what the grid had a constant for — so a four-hour shift
 * and a coffee were the same block. An hour is the honest default for
 * something somebody typed a start time for and no end, and it is what both
 * Google and Outlook put in the box.
 */
export const LONG_ENOUGH = 60;

/**
 * How long one of yours runs. Named apart from `lengthOf` below, which
 * answers the same question about a class and reads it off the syllabus.
 */
export function appointmentLength(a: Appointment): number {
  return a.minutes && a.minutes > 0 ? a.minutes : LONG_ENOUGH;
}

/**
 * Where an all-day entry sorts against a timed one: above all of them.
 *
 * One function rather than an `?? -1` at each call site, because it is one
 * decision and it is not the obvious one. `null` could as easily have meant
 * "unknown, so put it last" — it does exactly that for a deadline whose
 * wording names no hour, which lists *under* the grid. An all-day entry is
 * the opposite case: it is not missing an hour, it covers all of them, and
 * both Google Calendar and Outlook draw it in a banner pinned above the
 * first row. Anything reading `at` to order a day should get that answer
 * without having to rediscover it.
 */
export function byTime(a: { at: number | null }, b: { at: number | null }): number {
  return (a.at ?? -1) - (b.at ?? -1);
}

/**
 * Date first, then the hour within it — the order a list of upcoming things
 * is always in.
 *
 * Four screens had this comparator written out by hand and a fifth spelled
 * the date half with `localeCompare`, which is the same thing for ISO dates
 * and does not look like it. Making `at` nullable broke all five at once,
 * which is how a copy this old gets found: they had agreed for as long as
 * nobody edited one of them.
 */
export function byDateThenTime(
  a: { date: string; at: number | null },
  b: { date: string; at: number | null },
): number {
  return a.date === b.date ? byTime(a, b) : a.date < b.date ? -1 : 1;
}

/**
 * Appointments on a given day, in time order — the series expanded.
 *
 * The one seam every view reads appointments through, which is why the repeat
 * rule is expanded here rather than in each of them. What comes back is the
 * *occurrence*: a copy with `date` set to the day asked for, so everything
 * downstream keeps reading `a.date` and none of it has to know a rule exists.
 *
 * The id is not changed. Two occurrences of one series share an id on
 * purpose — it is one stored appointment, and the id is what a move or a
 * delete names. Which occurrence they mean is the date, passed separately;
 * see `moveAppointment` and `deleteAppointment` in `state/slices/mine.ts`.
 */
export function appointmentsOn(appointments: Appointment[], date: Date): Appointment[] {
  const iso = dateToIso(date);
  return appointments
    .filter((a) => occursOn(a.date, a.repeat, iso))
    .map((a) => (a.date === iso ? a : { ...a, date: iso }))
    .sort(byTime);
}

/**
 * The longest span one all-day entry may cover, in days.
 *
 * A bound rather than a policy. `bannersOn` has to look backwards from the
 * day it is drawing to find spans that began earlier, and without a limit
 * that is a walk to the start of recorded time on every cell of every month
 * grid. Ten weeks is longer than any break in a semester and longer than the
 * semester's own reading period, so nothing a student would actually write
 * hits it — and a span that did would be a term, which belongs in the
 * registrar's dates rather than on the calendar as one entry.
 */
export const LONGEST_SPAN = 70;

/** How many days one entry covers, counting the first. Always at least one. */
export function appointmentDays(a: Appointment): number {
  if (a.at !== null) return 1;
  const days = Math.floor(a.days ?? 1);
  return Math.min(Math.max(days, 1), LONGEST_SPAN);
}

/**
 * One all-day entry as it appears on one day of its span.
 *
 * Shaped for drawing rather than for storage: a five-day span is five of
 * these, one per day, each knowing where it sits in the run. That is what
 * lets a week grid draw a bar with one rounded end on Monday, no ends in the
 * middle, and the other on Friday, without any view having to work out the
 * arithmetic for itself.
 */
export interface Banner {
  id: string;
  title: string;
  meta: string;
  /** An event kind id — what colours it. */
  kind: string;
  /** The day this instance is drawn on. */
  on: string;
  /** Which day of the span this is, 1-based, and how long the whole run is. */
  day: number;
  days: number;
  /** True on the first and last day of the run, for the ends of the bar. */
  first: boolean;
  last: boolean;
  /** The record behind it, where there is one the student owns. */
  from: { kind: 'appointment'; id: string } | null;
}

/**
 * The all-day band for a day: yours, and anything all-day off a connected
 * calendar.
 *
 * The row Google Calendar and Outlook both pin above the first hour, and the
 * one place in this app an entry with no hour can be *drawn* rather than
 * listed. Before this, an all-day event read off a connected calendar landed
 * in a list under the grid beside the "TBD" campus listings — which said the
 * app did not know when it was, when in fact it knew exactly when it was and
 * had nowhere to put it.
 *
 * ## Finding the spans that started earlier
 *
 * A span covering Wednesday may have begun on Monday, and Monday is not the
 * day being asked about. So each entry is checked against every start date
 * within its own length of the day wanted, and `occursOn` decides each — which
 * means a repeating span works without a second rule: a Thursday-to-Sunday
 * fortnightly trip is the repeat saying which Thursdays and the span saying
 * how far each one reaches.
 *
 * The lookback is bounded by that entry's own length rather than by
 * `LONGEST_SPAN`, so the common case — a one-day entry — checks exactly one
 * date and costs what it did before.
 */
export function bannersOn(appointments: Appointment[], feed: FeedEvent[], date: Date): Banner[] {
  const iso = dateToIso(date);
  const out: Banner[] = [];

  for (const a of appointments) {
    if (a.at !== null) continue;
    const days = appointmentDays(a);
    for (let back = 0; back < days; back++) {
      const start = shiftIso(iso, -back);
      if (!occursOn(a.date, a.repeat, start)) continue;
      out.push({
        id: `appointment-${a.id}-${start}`,
        title: a.title,
        meta: a.where || 'Added by you',
        kind: a.kind ?? 'other',
        on: iso,
        day: back + 1,
        days,
        first: back === 0,
        last: back === days - 1,
        from: { kind: 'appointment', id: a.id },
      });
      /*
       * One bar per entry per day, and it is the most recent start that wins.
       *
       * A rule can outrun its own span — daily, three days long, and every
       * occurrence overlaps the two before it. Counting back from the day
       * being drawn means the run found is the one that started most
       * recently, so such an entry reads as a bar that renews each day rather
       * than as three bars stacked on one row saying the same thing.
       */
      break;
    }
  }

  for (const e of feed) {
    if (e.date !== iso || e.at !== null) continue;
    out.push({
      id: `feed-${e.id}`,
      title: e.title,
      meta: e.where || 'From a connected calendar',
      kind: CAMPUS_KIND,
      on: iso,
      day: 1,
      days: 1,
      first: true,
      last: true,
      from: null,
    });
  }

  return out;
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
  /**
   * Your own tasks, which every grid in the app used to leave out.
   *
   * A task has a day and, when you gave it one, an hour — the same shape as a
   * deadline, and it was drawn in exactly one view of five. Handed in here so
   * that the day rail, the day grid, the week grid and the hours tab all get
   * them from the one place, rather than three of them being taught
   * separately and the fourth being forgotten again.
   */
  tasks: PersonalTask[] = [],
): (Block & {
  mine?: boolean;
  kind?: string;
  minutes?: number;
  where?: string;
  from?: { kind: 'appointment' | 'item' | 'task'; id: string };
})[] {
  const classes = blocksFor(cat, date);
  /*
   * Timed ones only. An all-day entry has no hour to be drawn at, and the
   * rail is hours — it goes in the banner above the grid instead, which is
   * what `bannersOn` is for.
   *
   * This is the rule the deadlines and the tasks below already follow, for
   * the mirror-image reason. Their wording names no hour, so putting them on
   * the grid would be inventing one. An all-day entry is not missing an hour;
   * it has all of them, and drawing it at midnight would be asserting it
   * finishes at one in the morning.
   */
  const mine = appointmentsOn(appointments, date)
    .filter((a): a is Appointment & { at: number } => a.at !== null)
    .map((a) => ({
    time: a.time,
    at: a.at,
    // Its own length, so a four-hour shift is drawn as four hours. Every
    // appointment used to be fifty minutes on every grid — see `LONG_ENOUGH`.
    minutes: appointmentLength(a),
    title: a.title,
    meta: a.where || 'Added by you',
    // The place, said rather than left in the line above: with nowhere
    // stated that line reads "Added by you", which is not somewhere to walk.
    where: a.where,
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
      // A deadline is an hour, not a room. Its line names the course, which
      // read as prose sent a walking route to "CORE 2500".
      where: '',
      c: i.c,
      // Dimmer than a class, like office hours: it is a moment rather than a
      // room you have to be in.
      optional: true,
      from: { kind: 'item' as const, id: i.id },
    }));

  /*
   * Your tasks, on the hours they name.
   *
   * The same rule a deadline gets, for the same reason: a task's time is your
   * wording and is never rewritten, so "before work" stays a thing you have
   * all day for and only a stated clock time lands on the grid. The rest are
   * listed beside it — see `tasksOn`, which every view already had and only
   * the month was using.
   *
   * A finished task is off the day entirely rather than drawn with a line
   * through it: an hour you have given back is a gap, and the whole use of a
   * grid is showing where the gaps are.
   */
  const yours = tasks
    .filter((t) => !t.done && t.date === dateToIso(date))
    .map((t) => ({ t, at: readDue(t.time) }))
    .filter((x): x is { t: PersonalTask; at: number } => x.at !== null)
    .map(({ t, at }) => ({
      time: t.time.trim(),
      at,
      title: t.title,
      // The course it is filed against, then the word for what it is. A task
      // with no course says only "Task", which is still more than the blank
      // second line it would otherwise draw.
      meta: [t.courseId ? codeOf(cat, t.courseId) : '', 'Task'].filter(Boolean).join(' · '),
      // As with a deadline: a task is an hour, not a room.
      where: '',
      c: t.courseId,
      mine: true,
      kind: 'task',
      from: { kind: 'task' as const, id: t.id },
    }));

  return [...classes, ...mine, ...standing, ...deadlines, ...yours].sort(byTime);
}

/**
 * A day as blocks an hour grid can draw.
 *
 * Every block states its own length now: a class reads it off the syllabus's
 * meeting line, a commitment carries one, and an appointment has a field for
 * it — an hour where nobody said. Until it did, everything you added was
 * drawn as fifty minutes, so a four-hour shift and a coffee were the same
 * rectangle, which is the one distinction an hour grid exists to make.
 */
export function hoursFor(
  cat: Catalog,
  date: Date,
  appointments: Appointment[],
  commitments: Commitment[] = [],
  /** Deadlines with an hour on them, so the grid can draw and move them too. */
  due: DatedItem[] = [],
  /** Your own tasks, drawn on the hours they name. */
  tasks: PersonalTask[] = [],
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
  from?: { kind: 'appointment' | 'item' | 'task'; id: string };
}[] {
  return railFor(cat, date, appointments, commitments, due, tasks).map((b, i) => ({
    id: `${b.at}-${i}-${b.title}`,
    ...(b.from ? { from: b.from } : {}),
    title: b.title,
    /*
     * Whatever the block states, and only a class falls back to the syllabus.
     *
     * An appointment states its own length now — `railFor` puts it there, so
     * the grid, the rail and the .ics all draw the same block. A task and a
     * deadline still do not: they are a moment rather than a span, and fifty
     * minutes is long enough to read without implying a duration nobody gave.
     *
     * The fallback has to stay behind `b.mine`. A task carries the course it
     * is for, and `lengthOf` reads a length off that course's meeting line —
     * so without the guard a memo to draft for PSCI was drawn seventy-five
     * minutes long because the seminar is.
     */
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
 * One thing on around campus, as an hour grid draws it.
 *
 * The same shape `hoursFor` returns, plus the listing it came from: a tap on
 * the block opens the event, and only the university's own listings have a
 * screen to open — an entry out of a connected .ics is a title and a time and
 * nothing else to read.
 */
export interface CampusHour {
  id: string;
  title: string;
  meta: string;
  at: number;
  minutes: number;
  kind: string;
  c: null;
  /** The campus listing behind this block, where there is one. */
  eventId: string | null;
}

/**
 * What is on around campus, as blocks a grid can draw.
 *
 * The calendar knew about campus events in all four views and drew them on
 * none of them: they were a list under the week, a list under the day, a dot
 * on the month and a ring on the semester bar — so the one question a
 * timetable is for, *does this collide with anything*, could not be asked of
 * the involvement fair at four. A game at six is an hour of a Saturday in
 * exactly the way a shift is, and the grid is where hours live.
 *
 * Two rules keep it honest:
 *
 *  - **Only when a time was stated.** A listing whose time is "TBD" — which
 *    the football schedule is full of until the television window is set —
 *    gets no block, the same way a deadline whose wording names no hour is
 *    listed under the grid rather than drawn at midnight on it. The lists
 *    below the grids still carry every one of them.
 *  - **An hour long, and no claim beyond that.** A listing states when it
 *    starts and not when it ends. An hour is long enough to read the title in
 *    and short enough not to assert how long a fair or a game runs.
 *
 * They are never movable: a campus event is somebody else's date, and the
 * grids refuse a drag on one and say so — see `screens/calendar/Move.tsx`.
 */
export function campusHours(events: DatedEvent[], feed: FeedEvent[], date: Date): CampusHour[] {
  const iso = dateToIso(date);
  const listings = events
    .filter((e) => sameDay(e.date, date))
    .map((e) => ({ e, at: readDue(e.time) }))
    .filter((x): x is { e: DatedEvent; at: number } => x.at !== null)
    .map(({ e, at }) => ({
      id: `campus-${e.id}`,
      title: e.title,
      meta: [e.kind, e.where].filter(Boolean).join(' · '),
      at,
      minutes: 60,
      kind: CAMPUS_KIND,
      c: null,
      eventId: e.id,
    }));

  // An all-day entry from a feed has `at: null` and stays in the list, for the
  // same reason a "TBD" listing does: there is no hour to draw it at.
  const feeds = feed
    .filter((e) => e.date === iso && e.at !== null)
    .map((e) => ({
      id: `feed-${e.id}`,
      title: e.title,
      meta: e.where || 'From a connected calendar',
      at: e.at as number,
      minutes: 60,
      kind: CAMPUS_KIND,
      c: null,
      eventId: null,
    }));

  return [...listings, ...feeds].sort((a, b) => a.at - b.at);
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

/**
 * Minutes between the two times in "1:15–2:30p", or null.
 *
 * Written wide, because this line is prose off a syllabus and there is no
 * house style for it. The narrow version read `a` and `p` and a dash, which
 * covers how this app's own placeholder writes it and not much else: "MWF
 * 9:30 AM - 10:45 AM", "TR 1:15 p.m. – 2:30 p.m.", "MW 2:00pm-3:15pm" and
 * "TR 1:15 PM to 2:30 PM" all failed to match, and every failure here is a
 * seventy-five minute class that `lengthOf` then calls fifty.
 *
 * So the opening meridiem may spell itself out with or without stops, and the
 * separator may be any of the dashes a word processor produces — including the
 * minus sign, which is what a spreadsheet paste leaves behind — or the word
 * "to", as a word rather than as letters inside one.
 *
 * The closing meridiem stays a bare letter. Nothing follows it in the pattern,
 * so "p.m." matches on its `p` and the stops fall outside the match: spelling
 * that half out too would be a clause no input could ever exercise.
 */
export function spanOf(meets: string): number | null {
  const m = meets.match(
    /(\d{1,2})(?::(\d{2}))?\s*(?:([ap])\.?m?\.?)?(?:\s*[–—−-]\s*|\s+to\s+)(\d{1,2})(?::(\d{2}))?\s*([ap])?/i,
  );
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

