/**
 * The data contract, version 1. One module, two consumers.
 *
 * Not a copy in each client. The whole reason the two shapes drifted is that
 * each read the same course files independently and each grew its own idea of
 * what a course was; a schema that lives in one place and is imported cannot
 * drift, and a schema that is copied always does.
 *
 * `docs/data-contract.md` is the prose half — what each rule is for, the
 * mapping to what the app holds today, and the three places where the contract
 * as first written would have broken something that works. Read it before
 * changing anything here.
 *
 * ## What this module is not
 *
 * It is not the app's in-memory state and it is not a database schema. It is
 * the shape records take *on the wire and at rest*, so two clients agree. Each
 * client keeps its own state shape and converts at the boundary — that is what
 * the adapters are for, and it is why Phase 1 changes no screens.
 */

export const CONTRACT_VERSION = 1;

/* ── The envelope ──────────────────────────────────────────────────────── */

/**
 * What every record carries, whatever it is.
 *
 * `deletedAt` rather than removal, everywhere. A union merge cannot express a
 * deletion — nothing in the data distinguishes "this device never had it" from
 * "the other device deleted it" — so a note deleted on a phone comes back from
 * a laptop the next time they meet. A tombstone is the only thing that can say
 * *deleted* rather than *absent*.
 */
export interface Envelope {
  id: string;
  /** ISO 8601, UTC. The only thing precedence is decided by. */
  updatedAt: string;
  /** ISO 8601, UTC. Present means deleted; the row stays. */
  deletedAt?: string;
  /**
   * Which client created it.
   *
   * Diagnostics only, and this is load-bearing: the moment `origin` decides a
   * conflict, one client silently wins every race and the other's edits
   * disappear in a way nobody can see. Precedence is `updatedAt`, alone.
   */
  origin: 'app' | 'web';
}

export type Status = 'todo' | 'done' | 'dropped';
export type TermStatus = 'planned' | 'current' | 'archived';
export type AttendStatus = 'present' | 'absent' | 'excused' | 'cancelled';

/* ── The types ─────────────────────────────────────────────────────────── */

/**
 * An academic term.
 *
 * Note the name. `app/src/lib/types.ts` also exports a `Term`, and it is a
 * glossary entry — `{t, d}`, a word and its definition, used by the study
 * guides. The collision is real and the app's one is renamed `Definition` as
 * part of adopting this. Two different things must not share a name across a
 * boundary whose entire job is agreeing what things are.
 */
export interface Term extends Envelope {
  name: string;
  /** ISO date, YYYY-MM-DD. Absent when the student never said. */
  startsOn?: string;
  endsOn?: string;
  status: TermStatus;
}

export interface Course extends Envelope {
  termId: string;
  code: string;
  title: string;
  professor: string;
  /**
   * A number, not a string.
   *
   * The app stores `credits` as the string the syllabus used, because a
   * syllabus says "3" or "3.0" or "Three (3)" and the importer kept whatever
   * it read. That is fine for showing and wrong for adding up, which is what
   * the website's degree audit does. Parsed at the boundary; the original text
   * survives in the app's own record, not here.
   */
  credits: number;
  /**
   * The meeting pattern, structured.
   *
   * The app holds `meets` as one free-text line — "MWF 10:10–11:00, Buttrick
   * 101". Structured here because a calendar cannot render a sentence.
   */
  meetings: Meeting[];
  grading: GradeComponent[];
  /** What the syllabus says about AI, as the student recorded it. */
  aiPolicy: string;
  /** Where this came from — a filename, a feed, or 'manual'. */
  source: string;
}

export interface Meeting {
  /** 0 = Sunday, matching `Date.getDay()`. */
  day: number;
  /** Local wall time, HH:MM, 24-hour. Not UTC: a class is at 10:10 wherever you are. */
  from: string;
  to: string;
  where: string;
}

export interface GradeComponent {
  /**
   * A stable id, and the reason this type exists at all.
   *
   * The app keys a grade by the component's *position* in the syllabus —
   * `` `${courseId}:${index}` ``. Re-import a syllabus with a category
   * inserted at the top and every stored grade silently moves to the wrong
   * component. An id fixes it; the name alone would not, because two
   * components can be called "Quizzes".
   */
  id: string;
  name: string;
  /** Percent of the final grade. 30 means 30%. */
  weight: number;
  /** How many of these are dropped, lowest first. */
  drops?: number;
}

export interface Item extends Envelope {
  courseId: string;
  kind: string;
  title: string;
  /**
   * When it is due, ISO 8601 UTC.
   *
   * The app holds `{month (0-based), day, year?}` plus `dueTime` as free text
   * — *"exactly as the syllabus words it"*, which is deliberate: a syllabus
   * says "in class" or "before lecture" and the app refuses to invent a clock
   * time it was not given.
   *
   * So this is the date at local midnight when there is no real time, and the
   * original wording travels in `dueText` rather than being thrown away.
   * Rendering `T00:00:00Z` as "midnight" would be a downgrade the student can
   * see.
   */
  dueAt?: string;
  /** The syllabus's own words for the time, when it gave no clock time. */
  dueText?: string;
  startAt?: string;
  effortMin?: number;
  /** Percent of the final grade, where the syllabus says. */
  weight?: number;
  status: Status;
  source: string;
  /** The uid from an imported calendar feed, so re-imports match rather than duplicate. */
  externalUid?: string;
}

export interface Score extends Envelope {
  courseId: string;
  /** `GradeComponent.id`, not its position. */
  component: string;
  /** The specific piece, when the score is for one. */
  itemId?: string;
  earned: number;
  possible: number;
}

export interface Unit extends Envelope {
  courseId: string;
  title: string;
  body: string;
  order: number;
}

export interface Card extends Envelope {
  unitId: string;
  front: string;
  back: string;
  /** How sure the student said they were, last time. */
  sure?: number;
  outcome?: 'right' | 'wrong';
}

export interface Note extends Envelope {
  courseId?: string;
  kind: string;
  body: string;
  title?: string;
}

export interface Sitting extends Envelope {
  itemId?: string;
  courseId?: string;
  startedAt: string;
  endedAt: string;
  focusMs: number;
}

export interface Attend extends Envelope {
  courseId: string;
  /** ISO date, YYYY-MM-DD. One class meeting. */
  on: string;
  status: AttendStatus;
}

/** Every contract type, by name. The adapters iterate this rather than a list. */
export interface Contract {
  terms: Term[];
  courses: Course[];
  items: Item[];
  scores: Score[];
  units: Unit[];
  cards: Card[];
  notes: Note[];
  sittings: Sitting[];
  attendance: Attend[];
}

export const KINDS = [
  'terms',
  'courses',
  'items',
  'scores',
  'units',
  'cards',
  'notes',
  'sittings',
  'attendance',
] as const satisfies readonly (keyof Contract)[];

export type Kind = (typeof KINDS)[number];

export function empty(): Contract {
  return {
    terms: [],
    courses: [],
    items: [],
    scores: [],
    units: [],
    cards: [],
    notes: [],
    sittings: [],
    attendance: [],
  };
}

/* ── Ids ───────────────────────────────────────────────────────────────── */

/**
 * A new id. uuid v4, the same in both clients.
 *
 * `crypto.randomUUID` where it exists — every browser this app supports has
 * it, and Node has had it since 19. The fallback is for a stale WebView and is
 * still a real v4 from `getRandomValues`, not `Math.random`: an id collision
 * here merges two students' records on a shared account.
 */
export function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((n) => n.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * The one id that is derived, and why the rule bends here.
 *
 * The plan says never to derive an id from content. `Attend` is the exception,
 * and `app/src/lib/attend.ts` had already worked out why:
 *
 *   > two devices marking the same class produce the same id, `union` keeps
 *   > the newer `at`, and a duplicate can never become a second absence.
 *
 * A uuid would make two records out of one class meeting, and the merge could
 * not tell they were the same fact. The rule exists to stop ids moving when
 * content is edited; a (course, day) pair is not edited, it either happened or
 * it did not. So: derived, deliberately, and nowhere else.
 */
export function attendId(courseId: string, on: string): string {
  return `${courseId}:${on}`;
}

/* ── Time ──────────────────────────────────────────────────────────────── */

/** Now, as the contract writes it. */
export function stamp(at: number = Date.now()): string {
  return new Date(at).toISOString();
}

/** ISO 8601 UTC back to epoch milliseconds. NaN-safe: bad input is 0. */
export function millis(iso: string | undefined): number {
  if (!iso) return 0;
  const n = Date.parse(iso);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * A calendar day in the local zone, as ISO 8601 UTC.
 *
 * Deliberately *not* `new Date(y, m, d).toISOString()` at midnight local —
 * that is what makes a deadline land on the day before for anybody west of
 * UTC. The date is what the syllabus said; it is pinned to noon UTC so that
 * every zone from UTC-11 to UTC+13 reads back the same calendar day.
 */
export function dayAt(year: number, month0: number, day: number): string {
  return new Date(Date.UTC(year, month0, day, 12, 0, 0)).toISOString();
}

/** The calendar day an ISO timestamp falls on, as YYYY-MM-DD. */
export function dayOf(iso: string): string {
  const at = new Date(millis(iso));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${at.getUTCFullYear()}-${p(at.getUTCMonth() + 1)}-${p(at.getUTCDate())}`;
}

/* ── Merging ───────────────────────────────────────────────────────────── */

/**
 * Which of two versions of one record wins.
 *
 * Later `updatedAt` takes it. Equal timestamps keep the one already held,
 * because a tie means the two are the same edit arriving twice far more often
 * than it means a genuine conflict, and churning the record would mark it
 * dirty and send it round again.
 *
 * A tombstone does not win by being a tombstone. A deletion at 10:00 loses to
 * an edit at 10:05 — the student edited it after deleting it, which means they
 * changed their mind, and resurrecting is recoverable where deleting is not.
 */
export function later<T extends Envelope>(mine: T, theirs: T): T {
  return millis(theirs.updatedAt) > millis(mine.updatedAt) ? theirs : mine;
}

/**
 * Merge two sets of records by id.
 *
 * Returns the merged list and the ids where both sides had changed since they
 * last agreed — the plan's test 5 requires that a simultaneous edit is *not
 * silently lost*, and the only way to report it is to know it happened.
 */
export function merge<T extends Envelope>(
  mine: T[],
  theirs: T[],
  /** When the two last agreed, ISO. Edits on both sides after this collide. */
  since = '',
): { records: T[]; collided: string[] } {
  const floor = millis(since);
  const byId = new Map<string, T>();
  for (const r of mine) byId.set(r.id, r);

  const collided: string[] = [];
  for (const t of theirs) {
    const m = byId.get(t.id);
    if (!m) {
      byId.set(t.id, t);
      continue;
    }
    if (floor > 0 && millis(m.updatedAt) > floor && millis(t.updatedAt) > floor) {
      collided.push(t.id);
    }
    byId.set(t.id, later(m, t));
  }
  return { records: [...byId.values()], collided };
}

/**
 * Records changed since a moment — what a push sends.
 *
 * Tombstones are included, which is the whole point: a deletion is a change
 * and has to travel like one.
 */
export function changedSince<T extends Envelope>(records: T[], since: string): T[] {
  const floor = millis(since);
  return records.filter((r) => millis(r.updatedAt) > floor);
}

/**
 * Drop tombstones older than a cutoff.
 *
 * A tombstone cannot be kept forever — it is a row whose only job is to say a
 * row is gone — but it must outlive the slowest device, or that device's copy
 * comes back the next time it syncs. Ninety days is longer than a term, which
 * is the longest anybody plausibly leaves a phone in a drawer and still
 * expects it to be right.
 */
export const TOMBSTONE_DAYS = 90;

export function sweep<T extends Envelope>(records: T[], now: number = Date.now()): T[] {
  const cutoff = now - TOMBSTONE_DAYS * 24 * 60 * 60 * 1000;
  return records.filter((r) => !r.deletedAt || millis(r.deletedAt) > cutoff);
}

/** The live records — everything not tombstoned. What a screen renders. */
export function alive<T extends Envelope>(records: T[]): T[] {
  return records.filter((r) => !r.deletedAt);
}
