/**
 * What is on a day, as the domain understands it.
 *
 * Every dated thing a student has — a class, an appointment of their own, a
 * deadline, a task — reaches the calendar as an `Entry`, whatever it was
 * before. The legacy calendar screen reads four stores and four shapes; this
 * is the one shape the rest of the system can rely on.
 */
export type EntryKind = 'class' | 'appointment' | 'deadline' | 'task';

/**
 * How much to trust it, in the app's own labels (the same words as
 * `lib/source-label`, narrowed to the ones a calendar entry can carry). An
 * entry the student typed is theirs; one read off a syllabus and confirmed is
 * imported; one nobody has checked says so.
 */
export type Provenance = 'student_entered' | 'imported' | 'needs_review';

export interface Entry {
  readonly id: string;
  readonly title: string;
  readonly kind: EntryKind;
  /** The calendar day, `YYYY-MM-DD`. */
  readonly on: string;
  /** Minutes past midnight, or `null` for an all-day entry. */
  readonly startMin: number | null;
  /** Minutes it takes up. Zero for an instant, such as a deadline: it marks a moment and occupies none. */
  readonly durationMin: number;
  readonly provenance: Provenance;
  /** Finished. A done entry is still on the calendar, and not on what is left today. */
  readonly done: boolean;
}

const ORDER: Record<EntryKind, number> = { class: 0, appointment: 1, task: 2, deadline: 3 };

/**
 * One day's entries in the order a person reads a day: all-day first, then by
 * the hour, and — so the list does not reshuffle between two renders with the
 * same input — by kind, then title, then id.
 */
export function agendaFor(entries: readonly Entry[], on: string): Entry[] {
  return entries
    .filter((e) => e.on === on)
    .sort(
      (a, b) =>
        (a.startMin ?? -1) - (b.startMin ?? -1) ||
        ORDER[a.kind] - ORDER[b.kind] ||
        a.title.localeCompare(b.title) ||
        a.id.localeCompare(b.id),
    );
}

export interface Conflict {
  readonly first: Entry;
  readonly second: Entry;
}

const endOf = (e: Entry): number => (e.startMin ?? 0) + e.durationMin;

/**
 * Pairs of timed entries that occupy the same minutes.
 *
 * One ending as another begins is not a conflict — a class that ends at ten
 * and an appointment at ten are back to back, which is a day, not a clash.
 * All-day entries and instants occupy no hour, so they cannot overlap one.
 */
export function conflictsIn(entries: readonly Entry[]): Conflict[] {
  const timed = entries.filter((e) => e.startMin !== null && e.durationMin > 0);
  const sorted = [...timed].sort((a, b) => a.startMin! - b.startMin! || a.id.localeCompare(b.id));
  const out: Conflict[] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length && sorted[j].startMin! < endOf(sorted[i]); j++) {
      out.push({ first: sorted[i], second: sorted[j] });
    }
  }
  return out;
}

const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const leap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Whether `value` is a real calendar day written `YYYY-MM-DD`. 2026-02-30 is not. */
export function isRealDay(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= (mo === 2 && leap(y) ? 29 : DAYS[mo - 1]);
}
