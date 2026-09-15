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
  StudyCard,
} from '../lib/types';
import { sameDay } from '../lib/date';
import { readTerm, yearFor } from '../lib/term';

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
 * The rail for one day: every course's recurring classes, with that date's
 * exceptions applied, in time order.
 */
export function blocksFor(cat: Catalog, date: Date): Block[] {
  const dow = date.getDay();
  const blocks: Block[] = [];

  for (const mod of cat.modules) {
    const term = readTerm(mod.course.term);
    const todays = (mod.exceptions ?? []).filter((e) =>
      sameDay(new Date(yearFor(term, e.month), e.month, e.day), date),
    );

    for (const b of mod.schedule) {
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

export interface DeckCard {
  q: string;
  a: string;
  unit: string;
  /** The unit's index in `guide.units`, or `-1` for the guide's own self-test. */
  ui: number;
}

/**
 * Every card in a guide, once — the drill and quiz pool.
 *
 * A guide's self-test recaps, so it asks some of the units' questions a second
 * time in its own words. All four shipped guides do it: five questions across
 * them are written twice, once in the unit that teaches the thing and again at
 * the end of the guide. That is the source's editing, not a slip — CORE's
 * ten-question self-quiz and BUS's twelve-question one are ported whole — and
 * the guide is right to read that way.
 *
 * A deck is not. A card's identity is its question (`cardKey` in `lib/review`
 * hashes nothing else), so those two entries are one card with one review row,
 * and flattening both into one deck put the same question in front of somebody
 * twice in a sitting — the second time already answered, because answering the
 * first wrote the row they share. It also added one to every deck-size figure
 * the app prints, so ECON's 68 questions were 67 cards called 68.
 *
 * So the repeat is collapsed here, at the one place the whole-guide decks and
 * counts are built, rather than at each of the twelve callers that would
 * otherwise each have to remember. The unit's copy is the one kept: it is
 * where the card is taught, and it carries the unit name a drill prints under
 * the question. Nothing is lost from the guide itself — the field guide
 * renders `guide.selfTest` directly, in the self-test's own wording.
 *
 * A deck scoped to one unit takes {@link unitCards} instead, which is faithful:
 * see there for why the self-test still deals all ten.
 */
export function allCards(guide: Guide): DeckCard[] {
  const out: DeckCard[] = [];
  const seen = new Set<string>();
  const add = (c: StudyCard, unit: string, ui: number) => {
    if (seen.has(c.q)) return;
    seen.add(c.q);
    out.push({ q: c.q, a: c.a, unit, ui });
  };
  guide.units.forEach((u, ui) => u.cards.forEach((c) => add(c, u.name, ui)));
  guide.selfTest?.forEach((c) => add(c, 'Self-test', -1));
  return out;
}

/**
 * The cards one unit holds, in the guide's order — `-1` being the self-test,
 * which the field guide drills with a button of its own.
 *
 * Faithful where {@link allCards} collapses, and deliberately so. A question
 * the self-test recaps belongs to both decks: drilling unit 5 should ask it,
 * and so should drilling the self-test, because each is a pass over its own
 * material and neither repeats itself. Filtering the collapsed list by `ui`
 * instead would have deleted the card from whichever of the two lost the
 * tie — dealing eight cards under a button that says ten.
 *
 * The repeat only matters when both are in the same deck, and only `allCards`
 * builds that one.
 */
export function unitCards(guide: Guide, ui: number): DeckCard[] {
  const from = ui === -1 ? guide.selfTest : guide.units[ui]?.cards;
  const name = ui === -1 ? 'Self-test' : (guide.units[ui]?.name ?? '');
  return (from ?? []).map((c) => ({ q: c.q, a: c.a, unit: name, ui }));
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
