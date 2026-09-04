/**
 * A start-of-day and an end-of-day report.
 *
 * The app already knows everything either one needs — what is due, what meets,
 * what you ticked, what you drilled, what went by. What it never did was put
 * it in one place at the two moments it is worth reading: before the day
 * starts, and after it ends.
 *
 * ## Counted, not guessed
 *
 * Every figure in both reports is computed here from the store. Claude is
 * handed the finished counts and asked for two or three sentences of
 * judgement — what to do first, what is quietly slipping — and told never to
 * restate a number differently or invent one. That is the same split the
 * analysis screen uses, for the same reason: a report whose numbers are
 * unreliable is worse than no report, because it gets believed for a week
 * before anybody checks.
 *
 * The reports also work with no Claude at all. The counts and the lists are
 * the substance; the paragraph is the garnish.
 */

import type { Catalog } from '../data/catalog';
import type { Appointment, DatedItem, PersonalTask } from './types';
import type { Commitment } from './activities';
import { blocksOn, hoursOf } from './activities';
import { blocksFor } from '../data/catalog';
import { decorateItem } from './date';
import { overdueCount, type DoneMap } from './standing';
import { tally, type Reviews } from './review';

export interface DayInput {
  catalog: Catalog;
  now: Date;
  done: DoneMap;
  tasks: PersonalTask[];
  appointments: Appointment[];
  commitments: Commitment[];
  reviews: Reviews;
}

export interface Morning {
  dueToday: DatedItem[];
  classes: { time: string; title: string; where: string }[];
  commitments: { time: string; title: string }[];
  overdue: number;
  /** The next deadline after today, when there is one. */
  next: DatedItem | null;
  /** Open tasks of your own dated today or earlier. */
  tasks: PersonalTask[];
}

/** The ISO date, for keying a report to the day it covers. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * What today asks of you.
 *
 * Classes come from the timetable rather than the calendar feed, so a day with
 * no imported calendar is still right. Cancelled ones are left out: a report
 * that lists a class you are not going to is a report you stop reading.
 */
export function morning(input: DayInput): Morning {
  const { catalog, now, done } = input;
  const dated = datedFor(input);
  const dueToday = dated.filter((i) => i.isToday && !done[i.id]);
  const ahead = dated.filter((i) => !i.isPast && !i.isToday);

  const classes = blocksFor(catalog, now)
    .filter((b) => !b.canceled)
    .map((b) => ({ time: b.time, title: b.title, where: b.meta }));

  const commitments = blocksOn(input.commitments, now).map((b) => ({
    time: b.time,
    title: b.title,
  }));

  const key = dayKey(now);
  const tasks = input.tasks.filter((t) => !t.done && t.date !== null && t.date <= key);

  return {
    dueToday,
    classes,
    commitments,
    overdue: overdueCount(dated, done),
    next: ahead[0] ?? null,
    tasks,
  };
}

export interface Evening {
  /** Deadlines you ticked today. */
  ticked: DatedItem[];
  /** Deadlines that were due today and are still not ticked. */
  missed: DatedItem[];
  tasksDone: number;
  tasksLeft: number;
  cardsSeen: number;
  /** How often you have been right on the cards you have answered. */
  accuracy: number;
  overdue: number;
  /** Tomorrow, so the last thing read at night is the first thing needed. */
  tomorrow: DatedItem[];
  tomorrowClasses: { time: string; title: string }[];
}

export function evening(input: DayInput): Evening {
  const { catalog, now, done } = input;
  const dated = datedFor(input);
  const today = dated.filter((i) => i.isToday);
  const counts = tally(input.reviews);

  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrow = dated.filter((i) => sameDay(i.date, next) && !done[i.id]);

  return {
    ticked: today.filter((i) => done[i.id]),
    missed: today.filter((i) => !done[i.id]),
    tasksDone: input.tasks.filter((t) => t.done).length,
    tasksLeft: input.tasks.filter((t) => !t.done).length,
    cardsSeen: counts.cards,
    accuracy: counts.pct,
    overdue: overdueCount(dated, done),
    tomorrow,
    tomorrowClasses: blocksFor(catalog, next)
      .filter((b) => !b.canceled)
      .map((b) => ({ time: b.time, title: b.title })),
  };
}

/** Every deadline, dated against this clock, soonest first. */
function datedFor(input: DayInput): DatedItem[] {
  return input.catalog.items
    .map((i) => decorateItem(i, input.now))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** How many hours of commitments fall on this weekday. */
export function committedToday(list: Commitment[], date: Date): number {
  const fixed = blocksOn(list, date).length;
  if (fixed > 0) {
    return (
      list
        .filter((c) => c.active && c.at !== null && c.days.includes(date.getDay()))
        .reduce((n, c) => n + c.minutes, 0) / 60
    );
  }
  // Nothing scheduled today, so a share of anything stated by the week.
  return list.filter((c) => c.active && c.at === null).reduce((n, c) => n + hoursOf(c), 0) / 7;
}

// ── What Claude is told ──────────────────────────────────────────────────

export const MORNING_SYSTEM = [
  'You write two or three sentences at the start of a university student’s day, from counts',
  'that have already been computed. You are not summarising; you are advising.',
  '',
  '· Say what to do first and why that one. Nearest deadline is not always the answer — a',
  '  quiz that cannot be made up beats a paper that can be handed in late.',
  '· Name one thing that is quietly slipping if the numbers show one: something overdue, cards',
  '  piling up, a day with no room in it.',
  '· No pep talk, no "you’ve got this", no restating the list back. They can read the list.',
  '· Never restate a number differently from how it is given and never invent one. If something',
  '  important is missing, say which.',
].join('\n');

export const EVENING_SYSTEM = [
  'You write two or three sentences at the end of a university student’s day, from counts that',
  'have already been computed.',
  '',
  '· Start with what actually got done. It is the part people discount, and the checklist has',
  '  already hidden it.',
  '· Then the one thing worth carrying into tomorrow — not a list, the one thing.',
  '· If nothing got done, say so plainly and without either scolding or false comfort. A day',
  '  with a job, three classes and no ticked boxes is a normal day, not a failure.',
  '· Never restate a number differently from how it is given and never invent one.',
].join('\n');

/**
 * Their name, for the brief to use — or an instruction not to reach for one.
 *
 * A model given no name and a second-person report will sometimes invent an
 * address for it, and being called the wrong name by your own study app is a
 * small, memorable thing to be annoyed by. So the absence is stated rather
 * than left for it to fill.
 */
export function nameNote(name: string): string {
  const clean = name.trim();
  return clean
    ? `Address them as ${clean}, at most once, and only if it reads naturally.`
    : 'You do not know their name. Do not invent one and do not use a placeholder.';
}

export function morningBrief(m: Morning, code: (id: string) => string): string {
  const lines = [
    `Due today, not yet done: ${
      m.dueToday.length === 0
        ? 'nothing'
        : m.dueToday.map((i) => `${code(i.c)} ${i.title} (${i.kind}, ${i.dueTime})`).join('; ')
    }`,
    `Classes today: ${m.classes.length === 0 ? 'none' : m.classes.map((c) => `${c.time} ${c.title}`).join('; ')}`,
  ];
  if (m.commitments.length) {
    lines.push(`Also on today: ${m.commitments.map((c) => `${c.time} ${c.title}`).join('; ')}`);
  }
  if (m.tasks.length) {
    lines.push(`Your own tasks due: ${m.tasks.map((t) => t.title).join('; ')}`);
  }
  lines.push(`Overdue and unticked: ${m.overdue}`);
  if (m.next) {
    lines.push(`Next deadline after today: ${code(m.next.c)} ${m.next.title}, ${m.next.dueShort}`);
  }
  return lines.join('\n');
}

export function eveningBrief(e: Evening, code: (id: string) => string): string {
  const lines = [
    `Ticked off today: ${
      e.ticked.length === 0 ? 'nothing' : e.ticked.map((i) => `${code(i.c)} ${i.title}`).join('; ')
    }`,
    `Was due today and still not ticked: ${
      e.missed.length === 0 ? 'nothing' : e.missed.map((i) => `${code(i.c)} ${i.title}`).join('; ')
    }`,
    `Your own tasks: ${e.tasksDone} done, ${e.tasksLeft} open`,
    `Cards answered at least once, all time: ${e.cardsSeen}, right ${e.accuracy}% of the time`,
    `Overdue and unticked across the semester: ${e.overdue}`,
    `Due tomorrow: ${
      e.tomorrow.length === 0
        ? 'nothing'
        : e.tomorrow.map((i) => `${code(i.c)} ${i.title} (${i.dueTime})`).join('; ')
    }`,
    `Classes tomorrow: ${
      e.tomorrowClasses.length === 0
        ? 'none'
        : e.tomorrowClasses.map((c) => `${c.time} ${c.title}`).join('; ')
    }`,
  ];
  return lines.join('\n');
}

/** The headline above a morning report, before any model has spoken. */
export function morningLine(m: Morning): string {
  if (m.dueToday.length === 0 && m.classes.length === 0) {
    return m.overdue > 0
      ? `Nothing due and no classes — a day to clear the ${m.overdue} that went by.`
      : 'Nothing due and no classes today.';
  }
  const bits: string[] = [];
  if (m.dueToday.length) {
    bits.push(`${m.dueToday.length} due`);
  }
  if (m.classes.length) bits.push(`${m.classes.length} ${m.classes.length === 1 ? 'class' : 'classes'}`);
  if (m.commitments.length) bits.push(`${m.commitments.length} committed`);
  return `${bits.join(', ')}.`;
}

/** The headline above an evening report. */
export function eveningLine(e: Evening): string {
  const n = e.ticked.length + e.tasksDone;
  if (n === 0) {
    return e.missed.length > 0
      ? `Nothing ticked, and ${e.missed.length} that was due today still is.`
      : 'Nothing was due, and nothing was ticked.';
  }
  return `${n} finished today.`;
}
