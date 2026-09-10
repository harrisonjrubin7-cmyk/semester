import {
  attendId,
  dayAt,
  empty,
  millis,
  stamp,
  type Attend,
  type Contract,
  type Course,
  type GradeComponent,
  type Item,
  type Meeting,
  type Note,
  type Score,
  type Term,
} from '@semester/contract';
import type { Persisted } from '../shape';
import type { CourseModule, Item as AppItem, Note as AppNote } from '../../lib/types';
import { creditHoursOr0 } from '../../lib/credits';
import { key as gradeKey } from '../../lib/grades';

/**
 * The app's state, in and out of the shared contract.
 *
 * ## Where the conversion happens
 *
 * Here, at the boundary, and nowhere else. The plan is explicit that Phase 1
 * changes no screens: the in-memory state keeps its shape, and only what
 * crosses the wire is the contract's. Every mismatch in the mapping table —
 * `credits` as a string, dates as `{month, day, year}` tuples, grades keyed by
 * position — is resolved in this file, once.
 *
 * ## What this does not do
 *
 * It does not touch `Unit` or `Card`. The contract declares both, because the
 * desktop client will want them, but the app holds them nested inside a
 * generated guide and nothing in the app edits a single card. Splitting them
 * out would cost the import pipeline and five study formats to buy joins
 * nobody makes yet — the `sync-per-record` branch argued this at length and it
 * is still right for these two types. When something edits one card, this is
 * the file that grows.
 *
 * The one-way types are the same story from the other side: `state.grades` is
 * the app's own map and `toContract` reads it, but `fromContract` writes it
 * back only where a `Score` carries a component the app knows.
 */

/** How the app names itself in `origin`. Diagnostics only, never precedence. */
const ORIGIN = 'app' as const;

/**
 * The term a course belongs to, as a stable id.
 *
 * The app has no term record — a term is a string like `'2026FA'` on the
 * course. So the string *is* the id. That is a derived id, and it is safe for
 * the same reason `attendId` is: a term code is a fact, not an edited field,
 * and two devices naming the same term must agree or the courses split into
 * two terms that look identical.
 */
function termId(code: string): string {
  return `term:${code}`;
}

/* ── Out of the app, into the contract ─────────────────────────────────── */

/**
 * Read the app's state as contract records.
 *
 * `at` is the timestamp given to records the app has no better time for. Most
 * of the app's records carry no `updatedAt` of their own — that is the gap
 * this contract closes — so on the first conversion they all take the moment
 * of conversion, which is correct: that is when this device last knew they
 * were true.
 */
export function toContract(state: Persisted, at: number = Date.now()): Contract {
  const now = stamp(at);
  const out = empty();
  const seenTerms = new Set<string>();

  for (const mod of state.courses) {
    const code = mod.course.term ?? '';
    if (code && !seenTerms.has(code)) {
      seenTerms.add(code);
      out.terms.push(term(code, state, now));
    }
    out.courses.push(course(mod, now));
    for (const item of mod.items) out.items.push(toItem(item, mod, now));
    out.scores.push(...scores(mod, state, now));
  }

  for (const n of state.notes) out.notes.push(toNote(n));
  for (const a of state.attendance) out.attendance.push(toAttend(a, now));

  return out;
}

function term(code: string, state: Persisted, now: string): Term {
  return {
    id: termId(code),
    updatedAt: now,
    origin: ORIGIN,
    name: code,
    status: state.archivedTerms.includes(code) ? 'archived' : 'current',
  };
}

function course(mod: CourseModule, now: string): Course {
  const c = mod.course;
  return {
    id: c.id,
    updatedAt: now,
    origin: ORIGIN,
    termId: termId(c.term ?? ''),
    code: c.code,
    title: c.name,
    professor: c.prof,
    /*
     * A number here, whatever the syllabus said.
     *
     * The app keeps `credits` as the string it read — "3", "3.0", "Three (3)"
     * — which is right for showing and useless for adding up, and adding up is
     * what a degree audit does. 0 is the honest answer for a line with none,
     * rather than NaN travelling.
     *
     * The reading is `lib/credits.ts` rather than `parseFloat`, which takes
     * the leading number and stops: it read the "Three (3)" this comment
     * offers as an example as none at all, and "2026 Spring · 3 credits" as
     * two thousand and twenty-six. What crosses this wire is what a degree
     * audit divides by.
     */
    credits: creditHoursOr0(c.credits),
    meetings: meetings(mod),
    grading: grading(mod),
    /*
     * The stance and its wording, flattened to one line.
     *
     * The app holds `ai?: {stance, note}` and treats *absent* as a no — an
     * unread policy is not a permissive one. That reading has to survive the
     * crossing, so an unset policy becomes 'unstated' rather than an empty
     * string a reader could mistake for "no restrictions".
     */
    aiPolicy: c.ai ? `${c.ai.stance}: ${c.ai.note}` : 'unstated',
    source: c.source,
  };
}

/**
 * The meeting pattern, structured.
 *
 * From `mod.schedule`, which is already structured, rather than by parsing
 * `course.meets` — that field is one line of prose out of a syllabus and
 * parsing it would be guessing where the app already has the answer.
 */
function meetings(mod: CourseModule): Meeting[] {
  /*
   * One block, several days — so one block becomes several meetings.
   *
   * `RecurringBlock` holds `days: number[]` and a start in minutes past
   * midnight, with no end time at all: the app renders "9:05a" and a title and
   * never needed a duration. The contract wants a `to`, and there is no honest
   * source for one, so it is the start plus the app's own default block
   * length rather than a guess dressed up as data.
   */
  const out: Meeting[] = [];
  for (const b of mod.schedule ?? []) {
    if (b.optional) continue;
    for (const day of b.days) {
      out.push({
        day,
        from: clock(b.at),
        to: clock(b.at + BLOCK_MINUTES),
        where: b.meta || mod.course.room || '',
      });
    }
  }
  return out;
}

/**
 * The grading components, each with an id at last.
 *
 * The id is derived from the course and the component's *name*, not its
 * position. That is the fix for the bug in the mapping table: a re-imported
 * syllabus that inserts a category at the top shifts every position by one,
 * and a score keyed by position silently moves to the wrong component. A name
 * moves with its component.
 *
 * Two components with the same name in one course would collide; the index is
 * appended only when that happens, so the common case stays stable and the
 * rare one stays distinct.
 */
function grading(mod: CourseModule): GradeComponent[] {
  const rows = mod.course.grading ?? [];
  const seen = new Map<string, number>();
  return rows.map((r, i) => {
    const name = r.what ?? `Component ${i + 1}`;
    const n = seen.get(name) ?? 0;
    seen.set(name, n + 1);
    return {
      id: `${mod.course.id}:${slug(name)}${n > 0 ? `:${i}` : ''}`,
      name,
      weight: Number.parseFloat(r.pct) || 0,
    };
  });
}

/**
 * How long a class runs, when nothing says.
 *
 * Fifty minutes is the commonest US class hour and the app's schedule holds no
 * end time to read. It is an assumption, named here rather than buried, and
 * the moment `RecurringBlock` grows a real duration this constant goes.
 */
const BLOCK_MINUTES = 50;

/** Minutes past midnight as HH:MM, 24-hour. */
function clock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
}

/**
 * One dated obligation.
 *
 * The date is the interesting part. The app holds `{month: 0-based, day,
 * year?}` and a `dueTime` that is whatever the syllabus said — "11:59pm", but
 * also "in class" and "before lecture". The contract wants ISO, and the plan
 * says convert at the boundary.
 *
 * So: `dueAt` is the calendar day pinned to noon UTC (see `dayAt` for why
 * noon), and the syllabus's own wording travels in `dueText` rather than being
 * thrown away or turned into a clock time nobody was given.
 *
 * ## And the date it used to be on
 *
 * A deadline the student has moved carries `movedFrom` — the date the syllabus
 * actually gave. Sending only the date in force would hand a second client a
 * date the document does not state, beside the quote and page it came from,
 * with nothing saying which to believe. So it crosses as `statedDueAt`.
 *
 * Nothing comes the other way yet: `fromContract` reads notes and grades back
 * and does not rebuild courses, so there is no return path for this to be lost
 * on. When there is one, it has to write `movedFrom` back — the note below in
 * `fromContract` says so.
 */
function toItem(item: AppItem, mod: CourseModule, now: string): Item {
  const year = item.year ?? new Date().getFullYear();
  const moved = item.movedFrom;
  return {
    id: item.id,
    updatedAt: now,
    origin: ORIGIN,
    courseId: mod.course.id,
    kind: item.kind,
    title: item.title,
    dueAt: dayAt(year, item.month, item.day),
    ...(moved
      ? { statedDueAt: dayAt(moved.year ?? item.year ?? year, moved.month, moved.day) }
      : {}),
    dueText: item.dueTime || undefined,
    weight: Number.parseFloat(item.weight) || undefined,
    status: 'todo',
    source: mod.course.source,
  };
}

/**
 * The grades map, as records.
 *
 * `state.grades` is `Record<'courseId:index', string>` — a flat map of typed
 * strings keyed by position. Each becomes a `Score` against the component id
 * derived above, and the string is parsed: "17/20" and "85%" and "85" are all
 * things a student types into that box, and `lib/grades.ts` already reads all
 * three, so this reads them the same way rather than inventing a fourth.
 */
function scores(mod: CourseModule, state: Persisted, now: string): Score[] {
  const parts = grading(mod);
  const out: Score[] = [];
  parts.forEach((part, i) => {
    const raw = state.grades[gradeKey(mod.course.id, i)];
    if (!raw || !raw.trim()) return;
    const got = readScore(raw);
    if (!got) return;
    out.push({
      id: `${part.id}:score`,
      updatedAt: now,
      origin: ORIGIN,
      courseId: mod.course.id,
      component: part.id,
      earned: got.earned,
      possible: got.possible,
    });
  });
  return out;
}

/** "17/20", "85%", "85" — the three things a student types. */
export function readScore(raw: string): { earned: number; possible: number } | null {
  const text = raw.trim();
  const over = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(text);
  if (over) {
    const possible = Number(over[2]);
    return possible > 0 ? { earned: Number(over[1]), possible } : null;
  }
  const pct = /^(\d+(?:\.\d+)?)\s*%?$/.exec(text);
  if (pct) return { earned: Number(pct[1]), possible: 100 };
  return null;
}

function toNote(n: AppNote): Note {
  return {
    id: n.id,
    // A note is the one app record that already knows when it changed.
    updatedAt: stamp(n.updated || n.created),
    origin: ORIGIN,
    courseId: n.courseId ?? undefined,
    kind: 'note',
    title: n.title,
    body: n.body,
  };
}

/*
 * `Sitting` is not converted, and that is a finding rather than an omission.
 *
 * The contract's `Sitting` is a work session — `startedAt`, `endedAt`,
 * `focusMs`. The app's `Sitting`, in `lib/sitting.ts`, is a *marked practice
 * paper*: `got`, `outOf`, `pct`, `code`, and `missed` — the questions kept for
 * the drill deck. They share a name and nothing else.
 *
 * Mapping one onto the other would fit `at` into `startedAt` and `minutes`
 * into `focusMs` and drop the marks on the floor, which is the drill deck and
 * the grade projection both losing their source. The rules for this work say
 * no screen loses a feature, so it is left unmapped and raised instead.
 *
 * Two ways out, and the choice is not mine: give the contract a `Paper` type
 * for what the app actually has, or decide practice papers are client-local
 * and never sync. `docs/data-contract.md` §6 carries it as an open decision.
 *
 * The app's live stopwatch — `lib/session.ts`, also called `Sitting` — is the
 * closer match to the contract's type, but it is a single in-flight timer
 * rather than a list of finished sessions, so there is nothing yet to sync.
 */

/**
 * One class meeting.
 *
 * The id stays derived — `courseId:date` — and that is the exception the
 * contract names rather than a slip. See `attendId`.
 */
function toAttend(a: Persisted['attendance'][number], now: string): Attend {
  return {
    // Rebuilt from the parts rather than passed through, so a record whose id
    // and fields ever disagreed comes out consistent.
    id: attendId(a.courseId, a.date),
    updatedAt: stamp(a.at || Date.parse(now)),
    origin: ORIGIN,
    courseId: a.courseId,
    on: a.date,
    status: a.mark,
  };
}

/* ── Back into the app ─────────────────────────────────────────────────── */

/**
 * Fold contract records into the app's state.
 *
 * Only the fields the contract owns. Anything the app holds that the contract
 * does not — the look, navigation, the guide, everything in §4 of
 * `docs/data-contract.md` — is left exactly as it was, because a record
 * arriving from another client must not be able to change this device's
 * theme.
 *
 * Tombstoned records are dropped on the way in. That is the deletion
 * propagating: the row is gone from the app's list even though the tombstone
 * stays in the synced set.
 *
 * Notes and grades only. Courses and their items do not come back this way,
 * which is why nothing here reads `dueAt` or `statedDueAt` — whoever adds that
 * path has to map `statedDueAt` onto `movedFrom`, or a deadline somebody moved
 * returns from another device claiming the syllabus set the new date.
 */
export function fromContract(state: Persisted, c: Contract): Persisted {
  const notes = c.notes
    .filter((n) => !n.deletedAt)
    .map((n): AppNote => {
      const had = state.notes.find((x) => x.id === n.id);
      return {
        id: n.id,
        title: n.title ?? had?.title ?? '',
        body: n.body,
        created: had?.created ?? millis(n.updatedAt),
        updated: millis(n.updatedAt),
        courseId: n.courseId ?? null,
        // Files are device-local blobs in their own store; a note arriving
        // from another client cannot bring them, and must not claim to.
        fileIds: had?.fileIds ?? [],
      };
    });

  const grades = { ...state.grades };
  for (const mod of state.courses) {
    const parts = grading(mod);
    parts.forEach((part, i) => {
      const score = c.scores.find((s) => s.component === part.id && !s.deletedAt);
      if (!score) return;
      grades[gradeKey(mod.course.id, i)] =
        score.possible === 100 ? String(score.earned) : `${score.earned}/${score.possible}`;
    });
  }

  return { ...state, notes, grades };
}
