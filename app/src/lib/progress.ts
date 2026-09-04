/**
 * Where you actually are inside a reading.
 *
 * `lib/reading.ts` answers how big a reading is and which evening it should
 * happen on. It has nothing to say once you have started, and a two-hundred
 * page book is a single unticked box for a fortnight — which is the exact
 * shape of the problem: a checkbox is a terrible instrument for anything that
 * takes more than one sitting. You are either "not done" for eleven days and
 * then done, or you tick it early and lie to yourself.
 *
 * A page number is a better instrument, and it is one somebody already has in
 * front of them.
 *
 * ## The pace is measured, and refused until it can be
 *
 * Two marks in the same sitting are a rate: forty pages between 8:10 and 9:05
 * is forty-four pages an hour, for this person, in this book. Two marks a day
 * apart are not a rate, they are two facts about two days, and treating the
 * gap as reading time would produce two pages an hour. So only pairs inside
 * one sitting count, and where there are none the app says it cannot say yet
 * rather than reaching for a number.
 *
 * There is no default reading speed here and there will not be one. Every
 * published figure — 250 words a minute, an hour per chapter — is an average
 * over people and material, and applying it to *this* student reading *this*
 * anthropology chapter produces a confident number with nothing behind it.
 * The refusal is the same one `lib/pace.ts` makes.
 *
 * ## What it will not do
 *
 * It will not tell you whether you are behind. "Behind" needs a schedule the
 * app would have to invent — nothing says a reading has to be done evenly
 * across the days before it. What it says instead is how much is left, how
 * long that has taken you per page so far, and how many days there are. Those
 * three facts are enough for anybody to draw the conclusion themselves, and
 * the conclusion is theirs.
 */

/** What the numbers count. Both appear on syllabi; neither converts. */
export type Unit = 'pages' | 'chapters' | 'percent';

export interface Mark {
  /** Epoch ms. */
  at: number;
  /** How far through, in `unit`. */
  done: number;
}

export interface Progress {
  /** The deadline this belongs to. */
  id: string;
  unit: Unit;
  /** How much there is. Zero when nobody has said. */
  total: number;
  /** Every reading recorded, oldest first. */
  marks: Mark[];
  /** Epoch ms of the last change, for merging two devices' copies. */
  updated: number;
}

/**
 * The longest gap between two marks that can still be one sitting.
 *
 * Ninety minutes. Long enough to cover a break for coffee, short enough that
 * two marks either side of a night's sleep are never mistaken for a very slow
 * hour. Getting this wrong in the generous direction is what would produce the
 * two-pages-an-hour figure this file exists to avoid.
 */
export const ONE_SITTING = 90 * 60 * 1000;

/** Fewer marks than this in one sitting and there is nothing to measure. */
export const ENOUGH = 2;

export function newProgress(id: string, unit: Unit, total: number, at: number): Progress {
  return { id, unit, total: Math.max(0, Math.round(total)), marks: [], updated: at };
}

/**
 * A new position, recorded.
 *
 * Going backwards is allowed and kept: somebody who re-read a chapter is at
 * page 20 again, and rejecting that would make the field argue with the person
 * using it.
 *
 * A mark identical to the last is dropped only when it lands in the same
 * sitting, so tapping Save twice does not create a zero-length leg. The same
 * number a day later is kept and is the opposite of noise: it is somebody
 * picking the book up again at the page they left it, which is the only way
 * the *next* mark can be a measurable rate. Dropping it unconditionally meant
 * every session after the first was unmeasurable.
 */
export function mark(p: Progress, done: number, at: number): Progress {
  const where = Math.max(0, Math.round(done));
  const last = p.marks[p.marks.length - 1];
  if (last && last.done === where && at - last.at <= ONE_SITTING) return p;
  return { ...p, marks: [...p.marks, { at, done: where }], updated: at };
}

/** How far through, or 0 when nothing has been recorded. */
export function far(p: Progress): number {
  return p.marks.length > 0 ? p.marks[p.marks.length - 1].done : 0;
}

/** How much is left. Null when nobody has said how much there is. */
export function left(p: Progress): number | null {
  if (p.total <= 0) return null;
  return Math.max(0, p.total - far(p));
}

/** Where along it is, 0–100. Null without a total. */
export function pct(p: Progress): number | null {
  if (p.total <= 0) return null;
  return Math.min(100, Math.round((far(p) / p.total) * 100));
}

export function finished(p: Progress): boolean {
  return p.total > 0 && far(p) >= p.total;
}

export interface Pace {
  /** Units an hour. */
  perHour: number;
  /** How many sittings it rests on. */
  from: number;
  /** Minutes actually spent reading, across those sittings. */
  minutes: number;
}

/**
 * Units an hour, from marks inside one sitting only.
 *
 * Pairs a day apart are two facts about two days, not a rate. Backwards moves
 * are skipped rather than counted as negative reading.
 */
export function pace(p: Progress): Pace | null {
  let units = 0;
  let ms = 0;
  let sittings = 0;
  for (let i = 1; i < p.marks.length; i++) {
    const a = p.marks[i - 1];
    const b = p.marks[i];
    const gap = b.at - a.at;
    if (gap <= 0 || gap > ONE_SITTING) continue;
    const moved = b.done - a.done;
    if (moved <= 0) continue;
    units += moved;
    ms += gap;
    sittings += 1;
  }
  if (sittings < ENOUGH - 1 || ms <= 0 || units <= 0) return null;
  return {
    perHour: Math.round((units / (ms / 3_600_000)) * 10) / 10,
    from: sittings,
    minutes: Math.round(ms / 60_000),
  };
}

/** Minutes to finish at your measured pace. Null when there is no pace. */
export function minutesLeft(p: Progress): number | null {
  const rate = pace(p);
  const remaining = left(p);
  if (!rate || remaining === null || rate.perHour <= 0) return null;
  return Math.round((remaining / rate.perHour) * 60);
}

function unitWord(unit: Unit, n: number): string {
  if (unit === 'percent') return '%';
  if (unit === 'chapters') return n === 1 ? 'chapter' : 'chapters';
  return n === 1 ? 'page' : 'pages';
}

/** "40 of 96 pages" — where it is, without saying anything about it. */
export function farLine(p: Progress): string {
  const at = far(p);
  if (p.marks.length === 0) return 'Not started.';
  if (p.total <= 0) {
    return `At ${at}${p.unit === 'percent' ? '%' : ` ${unitWord(p.unit, at)}`}.`;
  }
  if (p.unit === 'percent') return `${at}% of the way through.`;
  return `${at} of ${p.total} ${unitWord(p.unit, p.total)}.`;
}

/**
 * How much is left and, where there is evidence, how long that is.
 *
 * Never how long it *should* take, and never whether you are behind — see the
 * header. Where the app cannot say, it says so, because a blank line reads as
 * "nothing to report" and this is the opposite.
 */
export function leftLine(p: Progress): string {
  const remaining = left(p);
  if (remaining === null) return 'No length set, so nothing to count down.';
  if (remaining === 0) return 'Finished.';
  const rate = pace(p);
  const unit = unitWord(p.unit, remaining);
  const head = p.unit === 'percent' ? `${remaining}% left` : `${remaining} ${unit} left`;
  if (!rate) {
    return `${head}. No pace measured yet — two marks in one sitting is enough.`;
  }
  const mins = minutesLeft(p);
  if (mins === null) return `${head}.`;
  const time =
    mins < 60
      ? `${mins} min`
      : `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
  return `${head}, about ${time} at your ${rate.perHour} ${unitWord(p.unit, 2)} an hour.`;
}

/**
 * What is left per day between now and the deadline.
 *
 * A division, offered rather than prescribed. It is deliberately not called
 * "behind" or "on track": nothing says a reading has to be spread evenly, and
 * the app inventing that schedule and then judging somebody against it would
 * be inventing both halves.
 */
export function perDayLine(p: Progress, daysAway: number): string {
  const remaining = left(p);
  if (remaining === null || remaining === 0) return '';
  if (daysAway < 0) return 'The day for it has gone.';
  if (daysAway === 0) return 'Due today, so it is all today.';
  const per = Math.ceil(remaining / (daysAway + 1));
  return `${per} ${unitWord(p.unit, per)} a day to spread it to the ${daysAway === 1 ? 'deadline tomorrow' : `deadline in ${daysAway} days`}.`;
}

/** Every reading started and not finished, most recently touched first. */
export function open(all: Record<string, Progress>): Progress[] {
  return Object.values(all)
    .filter((p) => p.marks.length > 0 && !finished(p))
    .sort((a, b) => b.updated - a.updated);
}

/**
 * A starting length read out of what `lib/reading.ts` already found.
 *
 * Pages first, because a page count is what somebody can check against the
 * thing in front of them. Zero means nobody has said, and the field asks.
 */
export function suggestTotal(e: { pages: number; chapters: number }): {
  unit: Unit;
  total: number;
} {
  if (e.pages > 0) return { unit: 'pages', total: e.pages };
  if (e.chapters > 0) return { unit: 'chapters', total: e.chapters };
  return { unit: 'pages', total: 0 };
}

/** A stored map made safe to render from. */
export function readProgress(raw: unknown): Record<string, Progress> {
  if (!raw || typeof raw !== 'object') return {};
  const units = new Set<Unit>(['pages', 'chapters', 'percent']);
  const out: Record<string, Progress> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const p = value as Partial<Progress>;
    if (!p || typeof p !== 'object') continue;
    const marks = Array.isArray(p.marks)
      ? p.marks
          .filter((m) => typeof m?.at === 'number' && typeof m?.done === 'number')
          // Sorted on the way in, because `pace` reads consecutive pairs and a
          // list merged from two devices arrives in neither device's order.
          .sort((a, b) => a.at - b.at)
      : [];
    out[id] = {
      id,
      unit: units.has(p.unit as Unit) ? (p.unit as Unit) : 'pages',
      total: typeof p.total === 'number' && p.total > 0 ? Math.round(p.total) : 0,
      marks,
      updated: typeof p.updated === 'number' ? p.updated : 0,
    };
  }
  return out;
}
