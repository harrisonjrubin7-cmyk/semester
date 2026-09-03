import type {
  Block,
  Course,
  CourseId,
  CourseModule,
  CoursePodcast,
  Example,
  Figure,
  FigureMap,
  Guide,
  Item,
  Lesson,
} from '../lib/types';
import { SEMESTER_YEAR, sameDay } from '../lib/date';

// ── The register ──────────────────────────────────────────────────────────
//
// To add a course: create `courses/<id>/` with an `index.ts` exporting a
// CourseModule, then add it to this array. That is the whole procedure — no
// shared data file is edited, and no type widened, so a new course cannot
// knock an existing one out of step. `pipeline/new-course.mjs` does both steps
// for you.

import econ from './courses/econ';
import psci from './courses/psci';
import core from './courses/core';
import bus from './courses/bus';

export const CATALOG: CourseModule[] = [econ, psci, core, bus];

// ── Derived lookups ───────────────────────────────────────────────────────
// Everything below is computed from CATALOG, so it can never disagree with it.

export const COURSES: Course[] = CATALOG.map((m) => m.course);

export const MODULE_BY_ID: Record<CourseId, CourseModule> = Object.fromEntries(
  CATALOG.map((m) => [m.course.id, m]),
);

export const COURSE_BY_ID: Record<CourseId, Course> = Object.fromEntries(
  CATALOG.map((m) => [m.course.id, m.course]),
);

export const GUIDES: Record<CourseId, Guide> = Object.fromEntries(
  CATALOG.map((m) => [m.course.id, m.guide]),
);

export const FIGURES: Record<CourseId, FigureMap> = Object.fromEntries(
  CATALOG.map((m) => [m.course.id, m.figures ?? {}]),
);

export const EXTRA_FIGURES: Record<CourseId, Figure[]> = Object.fromEntries(
  CATALOG.map((m) => [m.course.id, m.extraFigures ?? []]),
);

export const EXAMPLES: Record<CourseId, Example[]> = Object.fromEntries(
  CATALOG.map((m) => [m.course.id, m.examples ?? []]),
);

export const PODCAST: Record<CourseId, CoursePodcast> = Object.fromEntries(
  CATALOG.map((m) => [m.course.id, m.podcast ?? { blurb: '', editions: [] }]),
);

/** Narrated lessons, keyed by course then by unit index. */
export const LESSONS: Record<CourseId, Record<number, Lesson>> = Object.fromEntries(
  CATALOG.map((m) => [m.course.id, m.lessons ?? {}]),
);

export const PLAN_MIN: Record<CourseId, string> = Object.fromEntries(
  CATALOG.map((m) => [m.course.id, m.planMinutes]),
);

export const FRAME_LABELS: Record<CourseId, string> = Object.fromEntries(
  CATALOG.map((m) => [m.course.id, m.frameLabel]),
);

/** Every dated obligation across every course. */
export const ITEMS: Item[] = CATALOG.flatMap((m) => m.items);

export function codeOf(id: CourseId): string {
  return COURSE_BY_ID[id]?.code ?? id.toUpperCase();
}

/**
 * The short code the filter chips use — the first word of the course code, so
 * "ECON 1020" becomes "ECON". Derived rather than declared, so a new course
 * needs no entry anywhere.
 */
export const COURSE_SHORT: Record<CourseId, string> = Object.fromEntries(
  CATALOG.map((m) => [m.course.id, m.course.code.split(/\s+/)[0]]),
);

export const SHORT_CODES: string[] = CATALOG.map((m) => m.course.code.split(/\s+/)[0]);

/**
 * The rail for one day: every course's recurring classes, with that date's
 * exceptions applied, in time order.
 */
export function blocksFor(date: Date): Block[] {
  const dow = date.getDay();
  const blocks: Block[] = [];

  for (const mod of CATALOG) {
    const todays = (mod.exceptions ?? []).filter((e) =>
      sameDay(new Date(SEMESTER_YEAR, e.month, e.day), date),
    );

    for (const b of mod.schedule) {
      if (!b.days.includes(dow)) continue;
      // An exception applies to the block it names; an unnamed one applies to
      // real classes only, so cancelling a lecture leaves office hours alone.
      const ex = todays.find(
        (e) => !e.extra && (e.title ? e.title === b.title : !b.optional),
      );
      blocks.push({
        time: b.time,
        at: b.at,
        title: ex?.canceled ? `${b.title} — canceled` : b.title,
        meta: ex?.meta ?? b.meta,
        c: b.optional ? null : mod.course.id,
        canceled: ex?.canceled,
        optional: b.optional,
      });
    }

    for (const e of todays) {
      if (e.extra) blocks.push({ ...e.extra, c: mod.course.id });
    }
  }

  return blocks.sort((a, b) => a.at - b.at);
}

/** The line the next-class card shows when a date has something special on. */
export function classNote(date: Date, c: CourseId | null): string | undefined {
  if (!c) return undefined;
  const mod = MODULE_BY_ID[c];
  if (!mod) return undefined;
  return (mod.exceptions ?? []).find(
    (e) => sameDay(new Date(SEMESTER_YEAR, e.month, e.day), date) && e.note,
  )?.note;
}

/** Every card in a guide, flattened, with its unit index — the drill and quiz pool. */
export function allCards(guide: Guide) {
  const out: { q: string; a: string; unit: string; ui: number }[] = [];
  guide.units.forEach((u, ui) => {
    u.cards.forEach((c) => out.push({ q: c.q, a: c.a, unit: u.name, ui }));
  });
  guide.selfTest?.forEach((c) => {
    out.push({ q: c.q, a: c.a, unit: 'Self-test', ui: -1 });
  });
  return out;
}

export function weakestUnit(guide: Guide) {
  let worst = 0;
  guide.units.forEach((u, i) => {
    if (u.mastery < guide.units[worst].mastery) worst = i;
  });
  return { index: worst, unit: guide.units[worst] };
}
