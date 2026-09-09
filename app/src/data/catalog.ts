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
import { sameDay } from '../lib/date';
import { readTerm, termSpan, yearFor } from '../lib/term';

// ── The catalog ───────────────────────────────────────────────────────────
//
// A course used to be a TypeScript module compiled into the app, which was
// right while the app held one person's four courses and wrong the moment it
// held anyone else's. Now a course is data: it arrives from an account, or from
// a syllabus someone uploaded ten seconds ago, and the catalog is whatever that
// account currently holds.
//
// Everything below is a pure function of a list of modules, so the same code
// serves a signed-in student with eleven courses, a new account with none, and
// the sample semester.

export interface Catalog {
  modules: CourseModule[];
  courses: Course[];
  byId: Record<CourseId, Course>;
  moduleById: Record<CourseId, CourseModule>;
  guides: Record<CourseId, Guide>;
  figures: Record<CourseId, FigureMap>;
  extraFigures: Record<CourseId, Figure[]>;
  examples: Record<CourseId, Example[]>;
  podcast: Record<CourseId, CoursePodcast>;
  lessons: Record<CourseId, Record<number, Lesson>>;
  planMinutes: Record<CourseId, string>;
  frameLabels: Record<CourseId, string>;
  /**
   * When each course's recurring schedule is drawn between. See `teachingSpan`.
   *
   * Computed here rather than in `blocksFor`, which is called once per day by
   * the loops that fill a week or a fortnight — this is a fact about a course
   * and not about a date.
   */
  teaches: Record<CourseId, { from: number; to: number }>;
  /** Every dated obligation across every course. */
  items: Item[];
  /** The filter chips: the first word of each course code. */
  shortCodes: string[];
  short: Record<CourseId, string>;
  /** True when there is nothing in it — the state a new account starts in. */
  empty: boolean;
}

const index = <T,>(modules: CourseModule[], pick: (m: CourseModule) => T): Record<CourseId, T> =>
  Object.fromEntries(modules.map((m) => [m.course.id, pick(m)]));

export function buildCatalog(modules: CourseModule[]): Catalog {
  return {
    modules,
    courses: modules.map((m) => m.course),
    byId: index(modules, (m) => m.course),
    moduleById: index(modules, (m) => m),
    guides: index(modules, (m) => m.guide),
    figures: index(modules, (m) => m.figures ?? {}),
    extraFigures: index(modules, (m) => m.extraFigures ?? []),
    examples: index(modules, (m) => m.examples ?? []),
    podcast: index(modules, (m) => m.podcast ?? { blurb: '', editions: [] }),
    lessons: index(modules, (m) => m.lessons ?? {}),
    planMinutes: index(modules, (m) => m.planMinutes),
    frameLabels: index(modules, (m) => m.frameLabel),
    teaches: index(modules, teachingSpan),
    // The one place a year is decided. Every screen downstream reads
    // `item.date` and knows nothing about terms, which is the point.
    items: modules.flatMap((m) => {
      const term = readTerm(m.course.term);
      return m.items.map((i) => ({ ...i, year: i.year ?? yearFor(term, i.month) }));
    }),
    shortCodes: modules.map((m) => m.course.code.split(/\s+/)[0]),
    short: index(modules, (m) => m.course.code.split(/\s+/)[0]),
    empty: modules.length === 0,
  };
}

/** The catalog of an account with nothing in it yet. */
export const EMPTY_CATALOG = buildCatalog([]);

export function codeOf(cat: Catalog, id: CourseId): string {
  return cat.byId[id]?.code ?? id.toUpperCase();
}

/**
 * When a course's weekly pattern is drawn between.
 *
 * The season's own window (`termSpan`), widened to hold every dated
 * obligation the syllabus gave — because the syllabus is the better evidence
 * wherever the two disagree, and a course whose final sits outside the season
 * is a course still being taught on the day of it.
 *
 * Only the *recurring* pattern is bounded by this. A dated exception — a
 * make-up session, a review class — is a specific day somebody wrote down,
 * and a written-down day needs no window to justify it.
 */
export function teachingSpan(mod: CourseModule): { from: number; to: number } {
  const term = readTerm(mod.course.term);
  const span = termSpan(term);

  let last = span.to;
  for (const i of mod.items) {
    // End of that day, so a deadline on the last day of teaching does not
    // stop the classes held that morning being drawn.
    const at = new Date(i.year ?? yearFor(term, i.month), i.month, i.day, 23, 59, 59, 999).getTime();
    if (at > last) last = at;
  }
  return { from: span.from, to: last };
}

/**
 * The rail for one day: every course's recurring classes, with that date's
 * exceptions applied, in time order.
 */
export function blocksFor(cat: Catalog, date: Date): Block[] {
  const dow = date.getDay();
  const at = date.getTime();
  const blocks: Block[] = [];

  for (const mod of cat.modules) {
    const term = readTerm(mod.course.term);
    const todays = (mod.exceptions ?? []).filter((e) =>
      sameDay(new Date(yearFor(term, e.month), e.month, e.day), date),
    );

    // A term that has ended stops teaching. See `teachingSpan` — without this
    // a Fall course met on every Monday there has ever been, so the app told
    // somebody in February that their September class started in five
    // minutes.
    const span = cat.teaches[mod.course.id] ?? teachingSpan(mod);
    const teaching = at >= span.from && at <= span.to;

    for (const b of mod.schedule) {
      if (!teaching) continue;
      if (!b.days.includes(dow)) continue;
      // An exception applies to the block it names; an unnamed one applies to
      // real classes only, so cancelling a lecture leaves office hours alone.
      const ex = todays.find((e) => !e.extra && (e.title ? e.title === b.title : !b.optional));
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
export function classNote(cat: Catalog, date: Date, c: CourseId | null): string | undefined {
  if (!c) return undefined;
  const mod = cat.moduleById[c];
  if (!mod) return undefined;
  const term = readTerm(mod.course.term);
  return (mod.exceptions ?? []).find(
    (e) => sameDay(new Date(yearFor(term, e.month), e.month, e.day), date) && e.note,
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

/**
 * The unit to drill first, or `null` when there is nothing to drill.
 *
 * `null` rather than a unit that isn't there. `blankCourse` gives a course
 * typed in by hand a real guide with no units in it — deliberately, so that
 * every study screen can read `guide.units` without a null check of its own —
 * and this held up the other end of that bargain badly: with no units it
 * still answered `{ index: 0, unit: guide.units[0] }`, and `units[0]` of an
 * empty array is `undefined`. The one caller read `.name` off it, so adding a
 * course by hand and opening Study put the error screen in front of somebody
 * who had done nothing wrong.
 *
 * A type that can say "none" is the fix rather than a check at the call site:
 * the next caller would have had the same crash waiting for it.
 */
export function weakestUnit(guide: Guide): { index: number; unit: Guide['units'][number] } | null {
  if (guide.units.length === 0) return null;
  let worst = 0;
  guide.units.forEach((u, i) => {
    if (u.mastery < guide.units[worst].mastery) worst = i;
  });
  return { index: worst, unit: guide.units[worst] };
}
