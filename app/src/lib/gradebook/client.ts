/**
 * The gradebook of record's reads and writes, typed, over the account service.
 *
 * Every function is one RPC or one table, and
 * `supabase/migrations/20260929310000_gradebook.sql` is the authority: who
 * may enter, moderate or release, the roster, the append-only history,
 * idempotency and passback's gates are all decided there. Row-level security
 * decides what a read returns — a course's authors read drafts, a student
 * reads only their own released rows — so the same `loadBook` serves both
 * halves of the screen and cannot show a student a draft.
 *
 * Every writer here *raises* to refuse, unlike the registration ledger which
 * answers. So a refusal arrives as a thrown `ServiceError` carrying the
 * server's sentence (`answered: true`), and a network failure as one with
 * `answered: false`, whose outcome is unknown and whose retry must keep its
 * key (`lib/attempt.ts`).
 *
 * This is not `lib/grades.ts`, and nothing here reads or writes it.
 */

import { cloud } from '../cloud';
import type { Grant } from '../capabilities';
import { serviceError } from '../attempt';
import { cell } from './views';
import type { Action, Category, Entry, GradeCapability, Gradebook, Item, LetterStep, Mark, RegradeRequest, RegradeResolution, Scheme, Status } from './model';

type Row = Record<string, unknown>;
const text = (v: unknown): string => (v == null ? '' : String(v));
const num = (v: unknown): number => (typeof v === 'number' ? v : Number.parseFloat(text(v)) || 0);
const maybeNum = (v: unknown): number | null => (v == null || v === '' ? null : num(v));
const maybe = (v: unknown): string | null => (v == null || v === '' ? null : String(v));
const rows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);

// ── Who is looking, from their grants ──────────────────────────────────────

/** The three capabilities that make somebody an author of a course's grades — the ones that may read drafts. */
export const AUTHOR_CAPABILITIES: readonly GradeCapability[] = ['grades:enter', 'grades:moderate', 'grades:release'];

/** One course in one term: what a gradebook grant is held over. */
export interface Offering {
  /** "ECON 1020", as the database keys it. */
  course: string;
  /** "2026FA". */
  term: string;
}

export interface CourseGrant extends Offering {
  capabilities: GradeCapability[];
}

export const TERM = /^[0-9]{4}(FA|SP|SU)$/;
const CODE = /^[A-Z]{2,4} [0-9]{3,4}[A-Z]?$/;

/**
 * Course-and-term grants at this school: scope id `<school>/<CODE>/<TERM>`.
 *
 * Grading authority is per term in the migration — a grant on `vu/ECON 1020`
 * with no term authorises nothing in the gradebook — so one without a term,
 * or with anything else after the code, is not read as a course here either.
 */
function courseScoped(grants: readonly Grant[], school: string): (Offering & { capability: string })[] {
  const prefix = `${school}/`;
  const out: (Offering & { capability: string })[] = [];
  for (const g of grants) {
    if (school === '' || g.scopeKind !== 'course' || !g.scopeId.startsWith(prefix)) continue;
    const parts = g.scopeId.slice(prefix.length).split('/');
    if (parts.length !== 2) continue;
    const [course, term] = parts;
    if (!CODE.test(course) || !TERM.test(term)) continue;
    out.push({ course, term, capability: g.capability });
  }
  return out;
}

const SEASON: Record<string, number> = { SP: 1, SU: 2, FA: 3 };

/** Latest term first, then by course: the order a person reaches for them in. */
export function byOffering(a: Offering, b: Offering): number {
  const rank = (t: string) => Number.parseInt(t.slice(0, 4), 10) * 10 + (SEASON[t.slice(4)] ?? 0);
  return rank(b.term) - rank(a.term) || a.course.localeCompare(b.course);
}

/** "ECON 1020/2026FA": one key for one offering. */
export const offeringKey = (o: Offering): string => `${o.course}/${o.term}`;

/** The course-terms this person authors grades for, each with what they may do there. */
export function authoredCourses(grants: readonly Grant[], school: string): CourseGrant[] {
  const by = new Map<string, { offering: Offering; caps: Set<GradeCapability> }>();
  for (const g of courseScoped(grants, school)) {
    if (!(AUTHOR_CAPABILITIES as readonly string[]).includes(g.capability) && g.capability !== 'grades:export') continue;
    const key = offeringKey(g);
    const held = by.get(key) ?? { offering: { course: g.course, term: g.term }, caps: new Set<GradeCapability>() };
    held.caps.add(g.capability as GradeCapability);
    by.set(key, held);
  }
  return [...by.values()]
    .filter(({ caps }) => AUTHOR_CAPABILITIES.some((c) => caps.has(c)))
    .map(({ offering, caps }) => ({ ...offering, capabilities: [...caps].sort() }))
    .sort(byOffering);
}

/** The course-terms this person is graded in: a live `grades:receive` over that course and term. */
export function gradedCourses(grants: readonly Grant[], school: string): Offering[] {
  const by = new Map<string, Offering>();
  for (const g of courseScoped(grants, school)) {
    if (g.capability === 'grades:receive') by.set(offeringKey(g), { course: g.course, term: g.term });
  }
  return [...by.values()].sort(byOffering);
}

/** "2026FA" for a date: August to December is fall, January to May spring, the rest summer. */
export function termOf(now: Date): string {
  const m = now.getMonth();
  const season = m >= 7 ? 'FA' : m <= 4 ? 'SP' : 'SU';
  return `${now.getFullYear()}${season}`;
}

// ── Reading one course ─────────────────────────────────────────────────────

export interface LoadedBook {
  course: string;
  term: string;
  /** Null until somebody with grades:release sets one. */
  scheme: Scheme | null;
  schemeVersion: number;
  items: Item[];
  entries: Entry[];
  regrades: RegradeRequest[];
  resolutions: RegradeResolution[];
}

function readCategories(v: unknown): Category[] {
  return rows(v).map((c) => ({ key: text(c.key), name: text(c.name), weight: num(c.weight), dropLowest: num(c.drop_lowest) }));
}

function readLetters(v: unknown): LetterStep[] {
  return rows(v).map((l) => ({ letter: text(l.letter), min: num(l.min) }));
}

const MARKS: readonly Mark[] = ['late', 'excused', 'incomplete', 'missing'];
const STATUSES: readonly Status[] = ['draft', 'moderated', 'released'];
const ACTIONS: readonly Action[] = ['entered', 'changed', 'moderated', 'released', 'regraded'];

export function readEntry(r: Row): Entry {
  return {
    id: text(r.id),
    itemId: text(r.item_id),
    studentId: text(r.student_id),
    version: num(r.version),
    score: maybeNum(r.score),
    mark: MARKS.includes(r.mark as Mark) ? (r.mark as Mark) : null,
    comment: text(r.comment),
    status: STATUSES.includes(r.status as Status) ? (r.status as Status) : 'draft',
    action: ACTIONS.includes(r.action as Action) ? (r.action as Action) : 'entered',
    gradedBy: text(r.graded_by),
    actor: text(r.actor),
    reason: text(r.reason),
    regradeId: maybe(r.regrade_id),
    operation: text(r.operation),
    at: text(r.created_at),
  };
}

export function readItem(r: Row): Item {
  return {
    id: text(r.id),
    categoryKey: text(r.category_key),
    title: text(r.title),
    pointsPossible: num(r.points_possible),
    lineItem: maybe(r.line_item),
  };
}

/**
 * Everything row-level security lets this caller read about one course and
 * term: the latest scheme, the items, every visible version of every grade,
 * and the regrade requests with their answers.
 */
export async function loadBook(course: string, term: string): Promise<LoadedBook> {
  const db = await cloud();
  const [schemes, items, entries, regrades, resolutions] = await Promise.all([
    db.from('gradebook_schemes').select('version,categories,letters,moderation_required').eq('course_code', course).eq('term', term).order('version', { ascending: false }).limit(1),
    db.from('gradebook_items').select('id,category_key,title,points_possible,line_item,created_at').eq('course_code', course).eq('term', term).order('created_at'),
    db.from('grade_entries').select('id,item_id,student_id,version,score,mark,comment,status,action,graded_by,actor,reason,regrade_id,operation,created_at').eq('course_code', course).eq('term', term).order('version'),
    db.from('regrade_requests').select('id,item_id,student_id,contested_entry,reason,filed_at').eq('course_code', course).eq('term', term).order('filed_at'),
    db.from('regrade_resolutions').select('request_id,outcome,note,entry_id,resolved_by,resolved_at'),
  ]);
  const failed = schemes.error ?? items.error ?? entries.error ?? regrades.error ?? resolutions.error;
  if (failed) throw serviceError(failed, 'Could not load this gradebook.');
  const s = rows(schemes.data)[0];
  const requests = rows(regrades.data).map((r) => ({
    id: text(r.id),
    itemId: text(r.item_id),
    studentId: text(r.student_id),
    contestedEntry: text(r.contested_entry),
    reason: text(r.reason),
    at: text(r.filed_at),
  }));
  const ids = new Set(requests.map((r) => r.id));
  return {
    course,
    term,
    scheme: s ? { categories: readCategories(s.categories), letters: readLetters(s.letters), moderationRequired: s.moderation_required === true } : null,
    schemeVersion: s ? num(s.version) : 0,
    items: rows(items.data).map(readItem),
    entries: rows(entries.data).map(readEntry),
    regrades: requests,
    resolutions: rows(resolutions.data)
      .filter((r) => ids.has(text(r.request_id)))
      .map((r) => ({
        requestId: text(r.request_id),
        outcome: r.outcome === 'changed' ? 'changed' : 'upheld',
        note: text(r.note),
        entryId: maybe(r.entry_id),
        resolvedBy: text(r.resolved_by),
        at: text(r.resolved_at),
      })),
  };
}

/** As the pure model's `Gradebook`, so `lib/gradebook/` reads it: `current`, `studentView`, `finalGrade`. */
export function asGradebook(b: LoadedBook): Gradebook {
  return {
    course: b.course,
    term: b.term,
    scheme: b.scheme ?? { categories: [], letters: [{ letter: 'F', min: 0 }], moderationRequired: false },
    items: b.items,
    // The roster is not readable by a client; the students with a grade are the ones the table can show.
    roster: new Set(b.entries.map((e) => e.studentId)),
    entries: b.entries,
    regrades: b.regrades,
    resolutions: b.resolutions,
    operations: {},
  };
}

// ── The instructor's writers ───────────────────────────────────────────────

/** Returns the new scheme's version. */
export async function setScheme(course: string, term: string, scheme: Scheme, key: string): Promise<number> {
  const db = await cloud();
  const { data, error } = await db.rpc('gradebook_set_scheme', {
    want_course: course,
    want_term: term,
    want_categories: scheme.categories.map((c) => ({ key: c.key, name: c.name, weight: c.weight, drop_lowest: c.dropLowest })),
    want_letters: scheme.letters.map((l) => ({ letter: l.letter, min: l.min })),
    want_moderation: scheme.moderationRequired,
    want_key: key,
  });
  if (error) throw serviceError(error, 'The grading scheme was not saved.');
  return num(data);
}

/** Returns the new item's id. */
export async function addItem(
  course: string,
  term: string,
  item: { categoryKey: string; title: string; pointsPossible: number; lineItem: string | null },
  key: string,
): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('gradebook_add_item', {
    want_course: course,
    want_term: term,
    want_category: item.categoryKey,
    want_title: item.title,
    want_points: item.pointsPossible,
    want_line_item: item.lineItem,
    want_key: key,
  });
  if (error) throw serviceError(error, 'The item was not added.');
  return text(data);
}

export interface ScoreEntry {
  itemId: string;
  studentId: string;
  score: number | null;
  mark: Mark | null;
  comment: string;
  /** Required by the server once the grade has been released. */
  reason: string;
}

/** Returns the new draft's version. */
export async function enterScore(e: ScoreEntry, key: string): Promise<number> {
  const db = await cloud();
  const { data, error } = await db.rpc('gradebook_enter', {
    want_item: e.itemId,
    want_student: e.studentId,
    want_score: e.score,
    want_mark: e.mark,
    want_comment: e.comment,
    want_reason: e.reason,
    want_key: key,
  });
  if (error) throw serviceError(error, 'The score was not saved.');
  return num(data);
}

export async function moderate(itemId: string, studentId: string, key: string): Promise<number> {
  const db = await cloud();
  const { data, error } = await db.rpc('gradebook_moderate', { want_item: itemId, want_student: studentId, want_key: key });
  if (error) throw serviceError(error, 'The grade was not moderated.');
  return num(data);
}

export async function release(itemId: string, key: string): Promise<{ released: number; held: number }> {
  const db = await cloud();
  const { data, error } = await db.rpc('gradebook_release', { want_item: itemId, want_key: key });
  if (error) throw serviceError(error, 'The grades were not released.');
  const r = data && typeof data === 'object' ? (data as Row) : {};
  return { released: num(r.released), held: num(r.held) };
}

/** Returns the new draft version's id when the grade was changed, or null when it was upheld. */
export async function resolveRegrade(
  input: { requestId: string; outcome: 'upheld' | 'changed'; score: number | null; mark: Mark | null; note: string },
  key: string,
): Promise<string | null> {
  const db = await cloud();
  const { data, error } = await db.rpc('gradebook_resolve_regrade', {
    want_request: input.requestId,
    want_outcome: input.outcome,
    want_score: input.score,
    want_mark: input.mark,
    want_note: input.note,
    want_key: key,
  });
  if (error) throw serviceError(error, 'The regrade request was not resolved.');
  return maybe(data);
}

export type PassbackReason = 'queued' | 'kill-switch' | 'module-off' | 'flag-off' | 'no-line-item';

/** What `gradebook_queue_passback` answered, in words. */
export function passbackSaid(queued: number, reason: string): string {
  switch (reason) {
    case 'queued':
      return queued === 0
        ? 'Nothing new to send: every released score on this item is already queued.'
        : `${queued} released ${queued === 1 ? 'score is' : 'scores are'} queued to send to your learning system.`;
    case 'kill-switch':
      return 'Grade passback is paused at your school right now. Nothing was queued.';
    case 'module-off':
      return 'Your school has not connected its learning system to Semester, so nothing was queued.';
    case 'flag-off':
      return 'Your school has not turned on grade passback. Nothing was queued.';
    case 'no-line-item':
      return 'This item has no learning-system column to send to. Nothing was queued.';
    default:
      return 'Nothing was queued.';
  }
}

export async function queuePassback(itemId: string, key: string): Promise<{ queued: number; reason: string; said: string }> {
  const db = await cloud();
  const { data, error } = await db.rpc('gradebook_queue_passback', { want_item: itemId, want_key: key });
  if (error) throw serviceError(error, 'Passback was not queued.');
  const r = data && typeof data === 'object' ? (data as Row) : {};
  const queued = num(r.queued);
  const reason = text(r.reason);
  return { queued, reason, said: passbackSaid(queued, reason) };
}

// ── Export ─────────────────────────────────────────────────────────────────

export interface ExportRow {
  studentId: string;
  itemId: string;
  categoryKey: string;
  title: string;
  pointsPossible: number;
  score: number | null;
  mark: string | null;
  releasedAt: string;
}

/** `gradebook_export`: each student's latest released version of each item, and nothing unreleased. */
export async function exportRows(course: string, term: string): Promise<ExportRow[]> {
  const db = await cloud();
  const { data, error } = await db.rpc('gradebook_export', { want_course: course, want_term: term });
  if (error) throw serviceError(error, 'The export could not be read.');
  return rows(data).map((r) => ({
    studentId: text(r.student_id),
    itemId: text(r.item_id),
    categoryKey: text(r.category_key),
    title: text(r.title),
    pointsPossible: num(r.points_possible),
    score: maybeNum(r.score),
    mark: maybe(r.mark),
    releasedAt: text(r.released_at),
  }));
}

/** The export as RFC 4180 CSV, every cell through `cell` so nothing in it runs as a formula. */
export function exportCsv(course: string, term: string, list: readonly ExportRow[]): string {
  const head = ['course', 'term', 'student_id', 'item_id', 'category', 'item', 'points_possible', 'score', 'mark', 'released_at'].join(',');
  const body = list.map((r) =>
    [course, term, r.studentId, r.itemId, r.categoryKey, r.title, r.pointsPossible, r.score, r.mark, r.releasedAt].map((v) => cell(v)).join(','),
  );
  return `${[head, ...body].join('\r\n')}\r\n`;
}

// ── The student's writer ───────────────────────────────────────────────────

/** Returns the request's id. The server holds one open request per item. */
export async function fileRegrade(itemId: string, reason: string, key: string): Promise<string> {
  const db = await cloud();
  const { data, error } = await db.rpc('gradebook_file_regrade', { want_item: itemId, want_reason: reason, want_key: key });
  if (error) throw serviceError(error, 'The regrade request was not sent.');
  return text(data);
}
