import type { Block, CourseId } from '../lib/types';
import { SEMESTER_YEAR, sameDay } from '../lib/date';

interface RecurringBlock {
  /** Days of the week this repeats on, 0 = Sunday. */
  days: number[];
  at: number;
  time: string;
  title: string;
  meta: string;
  c: CourseId | null;
  optional?: boolean;
}

/**
 * The weekly rhythm, from the meeting patterns on the syllabi.
 *
 * The prototype hard-coded a single day's rail because its clock was pinned to
 * Thursday Sep 3. With a live date the rail has to be generated, so the pattern
 * lives here and the one-off colour of that particular Thursday lives in
 * {@link EXCEPTIONS} below — on Sep 3 the two combine into exactly the rail the
 * design drew.
 */
const WEEKLY: RecurringBlock[] = [
  {
    days: [1, 3, 5],
    at: 9 * 60 + 5,
    time: '9:05a',
    title: 'ECON 1020',
    meta: 'Section 9:05 · Dr. Stromme',
    c: 'econ',
  },
  {
    days: [4],
    at: 10 * 60 + 30,
    time: '10:30a',
    title: 'Trounstine office hours',
    meta: 'Commons 363A · optional',
    c: null,
    optional: true,
  },
  {
    days: [2, 4],
    at: 11 * 60,
    time: '11:00a',
    title: 'BUS 1600',
    meta: 'Alumni Hall 201 · Dr. Hogue',
    c: 'bus',
  },
  {
    days: [2, 4],
    at: 13 * 60 + 15,
    time: '1:15p',
    title: 'CORE 2500',
    meta: 'Garland · Prof. Torres Colón',
    c: 'core',
  },
  {
    days: [2, 4],
    at: 14 * 60 + 45,
    time: '2:45p',
    title: 'PSCI 1104',
    meta: 'Garland 162 · Prof. Trounstine',
    c: 'psci',
  },
];

interface Exception {
  month: number;
  day: number;
  /** Replaces the recurring block for this course, matched by `c`. */
  c?: CourseId;
  meta?: string;
  canceled?: boolean;
  /** A one-off block that exists only on this date. */
  extra?: Omit<Block, 'canceled'>;
}

/** The specific Thursday the design was drawn against. */
const EXCEPTIONS: Exception[] = [
  { month: 8, day: 3, c: 'bus', meta: 'Alumni Hall 201 · guest speaker: Ryan' },
  { month: 8, day: 3, c: 'core', meta: 'Garland · From Child Play to Sport' },
  { month: 8, day: 3, c: 'psci', meta: 'Prof. Trounstine at APSA', canceled: true },
  {
    month: 8,
    day: 3,
    extra: {
      at: 19 * 60,
      time: '7:00p',
      title: 'Group call — ECOALF',
      meta: 'Added by you · due 11:59p',
      c: 'bus',
    },
  },
];

/** What the hero's supporting line says when a class has something special on. */
export const CLASS_NOTES: Record<string, string> = {
  '2026-8-3-bus': 'Guest speaker: Ryan · Promotion & Advertising · read MM ch. 19',
  '2026-8-3-core': 'From Child Play to Sport — What Do We Lose, What Do We Gain?',
};

export function classNote(date: Date, c: CourseId | null): string | undefined {
  if (!c) return undefined;
  return CLASS_NOTES[`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${c}`];
}

/** The rail for one day: the recurring classes, with that date's exceptions applied. */
export function blocksFor(date: Date): Block[] {
  const dow = date.getDay();
  const todaysExceptions = EXCEPTIONS.filter((e) =>
    sameDay(new Date(SEMESTER_YEAR, e.month, e.day), date),
  );

  const blocks: Block[] = WEEKLY.filter((b) => b.days.includes(dow)).map((b) => {
    const ex = todaysExceptions.find((e) => e.c && e.c === b.c);
    return {
      time: b.time,
      at: b.at,
      title: ex?.canceled ? `${b.title} — canceled` : b.title,
      meta: ex?.meta ?? b.meta,
      c: b.c,
      canceled: ex?.canceled,
      optional: b.optional,
    };
  });

  for (const e of todaysExceptions) {
    if (e.extra) blocks.push({ ...e.extra });
  }

  return blocks.sort((a, b) => a.at - b.at);
}
