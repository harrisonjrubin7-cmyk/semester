import type { IsoDate } from '../kernel';

/**
 * One thing on the person's calendar, whatever it came from.
 *
 * The legacy app draws the same day from five unrelated shapes — a syllabus
 * `Item`, a campus event, a class `Block`, a `PersonalTask`, an `Appointment` —
 * and each screen re-derives "what is on Tuesday" from whichever it knows about.
 * An `Entry` is the one shape a day is made of. The mapping from each legacy
 * shape lives in `acl.ts`; everything here is pure arithmetic over entries.
 *
 * Times are minutes past local midnight, and **null means "no time"**, not
 * midnight. The legacy code encodes "no time" as 1440 in one place and a free
 * text string in another; this is where that stops being everyone's problem.
 */

export const ENTRY_KINDS = ['class', 'deadline', 'task', 'appointment', 'campus'] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

/**
 * Where an entry's date came from, in the vocabulary the rest of the product
 * already uses (`SourceLabel`): the app never presents an estimate as a fact.
 */
export type EntrySource = 'imported' | 'needs_review' | 'entered' | 'estimated';

export interface Entry {
  readonly id: string;
  readonly kind: EntryKind;
  readonly title: string;
  readonly day: IsoDate;
  /** Minutes past local midnight when it starts; null when it has no time. */
  readonly startMin: number | null;
  /** When it ends. Null for a point in time (a deadline) or an unknown length. */
  readonly endMin: number | null;
  readonly courseId: string | null;
  readonly source: EntrySource;
}

/** Kinds that occupy a stretch of the day and can therefore collide. A deadline is a moment, not a block. */
const OCCUPIES: ReadonlySet<EntryKind> = new Set(['class', 'appointment', 'campus']);

const occupies = (e: Entry): e is Entry & { startMin: number; endMin: number } =>
  OCCUPIES.has(e.kind) && e.startMin !== null && e.endMin !== null && e.endMin > e.startMin;

/**
 * Timed entries first, by start; untimed ones after.
 *
 * Ties keep the order the source listed them in (the sort is stable). That is
 * what the legacy checklist does, and the shadow comparison (`today/shadow.ts`)
 * reports any difference in order as a disagreement, so an alphabetical
 * tie-break here would be reported on every day with two untimed deadlines.
 */
export function byStart(a: Entry, b: Entry): number {
  if (a.startMin !== null && b.startMin !== null) return a.startMin - b.startMin;
  if (a.startMin !== null) return -1;
  if (b.startMin !== null) return 1;
  return 0;
}

export const entriesOn = (entries: readonly Entry[], day: IsoDate): Entry[] =>
  entries.filter((e) => e.day === day).sort(byStart);

export interface Clash {
  a: Entry;
  b: Entry;
}

/**
 * Pairs of entries that overlap. Back-to-back is not a clash (one ends at 10:00,
 * the next starts at 10:00); a shared minute is.
 */
export function clashes(entries: readonly Entry[]): Clash[] {
  const blocks = entries.filter(occupies).sort(byStart);
  const out: Clash[] = [];
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      if (blocks[j].startMin >= (blocks[i].endMin as number)) break;
      out.push({ a: blocks[i], b: blocks[j] });
    }
  }
  return out;
}

/** The next timed entry today that has not started, or null. */
export function nextUp(entries: readonly Entry[], day: IsoDate, nowMin: number): Entry | null {
  return (
    entriesOn(entries, day).find((e) => e.startMin !== null && e.startMin >= nowMin && e.kind !== 'task') ?? null
  );
}
