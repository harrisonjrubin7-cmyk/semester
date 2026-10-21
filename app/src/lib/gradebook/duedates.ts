/**
 * When each gradebook item is due, and when it is due for one student once
 * their extension is approved.
 *
 * `supabase/migrations/20261021130000_gradebook_due_dates.sql` is the
 * authority. `gradebook_set_due` sets or clears an item's date: it needs
 * `grades:release` (whoever adds items), names the version read, and spends a
 * key on the gradebook ledger. `gradebook_due_dates` is security invoker and
 * answers one row per item (`studentId` null), in the order items were
 * added, plus one row per student with
 * an approved extension on it — row-level security decides which students a
 * caller sees: a student their own, the course's request readers everyone's.
 *
 * Like `requests.ts`, kept apart from `client.ts` and not called by
 * `loadBook`: a school without the migration has neither function nor
 * column, and its gradebook must keep working. That reads as
 * `available: false`, "not set up here yet", not as an error.
 */

import { cloud } from '../cloud';
import { serviceError, ServiceError } from '../attempt';
import { formatDateTime } from '../locale';
import { isRealDate } from '../datefield';
import { dueSaid, notSetUp, StaleRequest } from './requests';

type Row = Record<string, unknown>;
const maybe = (v: unknown): string | null => (v == null || v === '' ? null : String(v));

export interface DueRow {
  itemId: string;
  title: string;
  /** Null on the item's own row; a student's id on their extension's row. */
  studentId: string | null;
  /** The item's own date, an ISO instant, or null when none is set. */
  itemDue: string | null;
  /** How many times the item's date has been set: what a change must name. */
  version: number;
  /** `YYYY-MM-DD`, the day an approved extension granted. */
  grantedDue: string | null;
  requestId: string | null;
  /** The date that applies: the item's, or the granted day's end when that is later. */
  effectiveDue: string | null;
  /** True only when the granted day is later than the item's own date. */
  extended: boolean;
}

export interface LoadedDueDates {
  /** False when this school's database has no due dates yet (the migration is not applied there). */
  available: boolean;
  rows: DueRow[];
}

export interface DueReceipt {
  item: string;
  due: string | null;
  version: number;
}

export const DUE_NOT_SET_UP_SAID = 'Due dates in the gradebook are not set up at your school yet.';

export function readDueRow(r: Row): DueRow {
  return {
    itemId: String(r.item_id ?? ''),
    title: String(r.title ?? ''),
    studentId: maybe(r.student_id),
    itemDue: maybe(r.item_due),
    version: Number(r.due_version) || 0,
    grantedDue: maybe(r.granted_due),
    requestId: maybe(r.request_id),
    effectiveDue: maybe(r.effective_due),
    extended: r.extended === true,
  };
}

/** Every due date this caller may read on one course and term. */
export async function loadDueDates(course: string, term: string): Promise<LoadedDueDates> {
  const db = await cloud();
  const { data, error } = await db.rpc('gradebook_due_dates', { want_course: course, want_term: term });
  if (notSetUp(error)) return { available: false, rows: [] };
  if (error) throw serviceError(error, 'Could not load the due dates.');
  return { available: true, rows: (Array.isArray(data) ? (data as Row[]) : []).map(readDueRow) };
}

function refusal(error: { code?: string; message?: string } | null, fallback: string): ServiceError {
  if (notSetUp(error)) return new ServiceError(DUE_NOT_SET_UP_SAID, true);
  const e = serviceError(error, fallback);
  return error?.code === '40001' ? new StaleRequest(e.message) : e;
}

/** Sets, changes or clears (`due` null) one item's due date, naming the version read. */
export async function setDue(itemId: string, due: string | null, expect: number, key: string): Promise<DueReceipt> {
  const db = await cloud();
  const { data, error } = await db.rpc('gradebook_set_due', { want_item: itemId, want_due: due, want_expect: expect, want_key: key });
  if (error) throw refusal(error, 'The due date was not saved.');
  const r = data && typeof data === 'object' ? (data as Row) : {};
  return { item: String(r.item ?? itemId), due: maybe(r.due), version: Number(r.version) || 0 };
}

// ── Reading the rows ───────────────────────────────────────────────────────

/** Each item's own row, by item id. */
export function itemDates(rows: readonly DueRow[]): Map<string, DueRow> {
  return new Map(rows.filter((r) => r.studentId === null).map((r) => [r.itemId, r]));
}

/** Every student's extension row on one item. */
export const extensionsOn = (rows: readonly DueRow[], itemId: string): DueRow[] =>
  rows.filter((r) => r.itemId === itemId && r.studentId !== null);

/** The row that applies to one student on one item: their extension's, else the item's own. */
export function dueFor(rows: readonly DueRow[], itemId: string, studentId: string): DueRow | undefined {
  return rows.find((r) => r.itemId === itemId && r.studentId === studentId) ?? rows.find((r) => r.itemId === itemId && r.studentId === null);
}

/** "Fri, Nov 6, 2026, 11:59 PM" in the reader's own zone, or "No due date set". */
export function whenSaid(iso: string | null): string {
  if (!iso) return 'No due date set';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'No due date set';
  return formatDateTime(d, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * What a row says in words, so the extension never rests on colour: the
 * applying date, and whether an approved extension moved it.
 */
export function dueLine(row: DueRow | undefined): { date: string; label: string | null } {
  if (!row) return { date: 'No due date set', label: null };
  if (row.extended && row.grantedDue) return { date: `Extended to ${dueSaid(row.grantedDue)}`, label: row.itemDue ? `Originally due ${whenSaid(row.itemDue)}` : 'The item has no due date of its own' };
  return { date: whenSaid(row.itemDue), label: null };
}

// ── The instructor's form: a local day and time ↔ an instant ───────────────

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The instant a local `YYYY-MM-DD` day and `HH:MM` time name, in this device's zone, as ISO. */
export function toInstant(day: string, time: string): string | null {
  if (!isRealDate(day) || !TIME.test(time)) return null;
  const d = new Date(`${day}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** The local day and time an instant falls on, for the form. */
export function fromInstant(iso: string | null): { day: string; time: string } {
  if (!iso) return { day: '', time: '23:59' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: '', time: '23:59' };
  const two = (n: number) => String(n).padStart(2, '0');
  return { day: `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`, time: `${two(d.getHours())}:${two(d.getMinutes())}` };
}

/** Why a due date cannot be saved yet, or null when it can. The server checks the same range. */
export function dueProblem(day: string, time: string): string | null {
  if (!isRealDate(day)) return 'Choose the day it is due.';
  if (!TIME.test(time)) return 'Choose the time it is due.';
  const year = Number(day.slice(0, 4));
  if (year < 2000 || year > 2099) return 'Choose a day between 2000 and 2099.';
  return null;
}
