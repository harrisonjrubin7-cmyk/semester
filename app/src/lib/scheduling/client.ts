/**
 * Campus spaces, bookings and timetable runs, typed, over the account service.
 *
 * `supabase/migrations/20261001080000_scheduling.sql` is the authority: who
 * saves a space, who may request a booking and who decides it, that no two
 * confirmed bookings of a space overlap, and that a timetable run is verified by
 * the database and published by someone other than who saved it, all only while
 * the school runs `scheduling` in Core (`lib/modulemode.ts`). This file asks.
 * `lib/timetable/solver.ts` proposes; a person publishes.
 */

import { cloud } from '../cloud';
import type { Grant } from '../capabilities';
import { serviceError } from '../attempt';
import type { Assignment, Conflict, SectionInput } from '../timetable/solver';

type Row = Record<string, unknown>;
const text = (v: unknown): string => (v == null ? '' : String(v));
const rows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);

export type SchedulingCapability = 'space:manage' | 'space:approve' | 'timetable:run' | 'timetable:publish';

/** The scheduling capabilities this person holds over exactly their school. */
export function schedulingCapabilities(grants: readonly Grant[], school: string): Set<SchedulingCapability> {
  const held = new Set<SchedulingCapability>();
  if (school === '') return held;
  for (const g of grants) {
    if (g.scopeKind === 'school' && g.scopeId === school && (g.capability.startsWith('space:') || g.capability.startsWith('timetable:'))) held.add(g.capability as SchedulingCapability);
  }
  return held;
}

export interface Space { id: string; code: string; name: string; building: string; capacity: number; features: string[]; bookable: boolean; retired: boolean }

export async function loadSpaces(school: string): Promise<Space[]> {
  const db = await cloud();
  const { data, error } = await db.from('campus_spaces').select('id,code,name,building,capacity,features,bookable,retired_at').eq('tenant_id', school).order('code');
  if (error) throw serviceError(error, 'The spaces could not be read.');
  return rows(data).map((r) => ({
    id: text(r.id), code: text(r.code), name: text(r.name), building: text(r.building), capacity: Number(r.capacity) || 0,
    features: Array.isArray(r.features) ? (r.features as unknown[]).map(text) : [], bookable: r.bookable === true, retired: r.retired_at != null,
  }));
}

export type BookingStatus = 'requested' | 'confirmed' | 'declined' | 'cancelled';
export type BookingPurpose = 'meeting' | 'event' | 'study' | 'class' | 'exam';

export interface Booking {
  id: string;
  spaceId: string;
  title: string;
  purpose: BookingPurpose;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  mine: boolean;
  note: string;
}

export async function loadBookings(school: string, me: string): Promise<Booking[]> {
  const db = await cloud();
  const { data, error } = await db.from('space_bookings').select('id,space_id,requester,title,purpose,starts_at,ends_at,status,note')
    .eq('tenant_id', school).order('starts_at', { ascending: true });
  if (error) throw serviceError(error, 'The bookings could not be read.');
  return rows(data).map((r) => ({
    id: text(r.id), spaceId: text(r.space_id), title: text(r.title), purpose: text(r.purpose) as BookingPurpose, startsAt: text(r.starts_at), endsAt: text(r.ends_at),
    status: text(r.status) as BookingStatus, mine: me !== '' && text(r.requester) === me, note: text(r.note),
  }));
}

/** A local date and time as typed (`2026-10-05`, `14:30`) to an ISO instant, or null. */
export function toInstant(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const d = new Date(`${date}T${time.padStart(5, '0')}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Whether two bookings of the same space overlap in time (touching ends do not). */
export const overlaps = (a: Pick<Booking, 'startsAt' | 'endsAt'>, b: Pick<Booking, 'startsAt' | 'endsAt'>): boolean =>
  Date.parse(a.startsAt) < Date.parse(b.endsAt) && Date.parse(b.startsAt) < Date.parse(a.endsAt);

export interface RunRow { id: string; term: string; savedAt: string; conflicts: Conflict[]; assignments: number; published: boolean; mine: boolean }

export async function loadRuns(school: string, me: string): Promise<RunRow[]> {
  const db = await cloud();
  const [runs, pubs] = await Promise.all([
    db.from('timetable_runs').select('id,term,saved_at,conflicts,proposal,saved_by').eq('tenant_id', school).order('saved_at', { ascending: false }).limit(30),
    db.from('timetable_publications').select('run_id').eq('tenant_id', school),
  ]);
  if (runs.error) throw serviceError(runs.error, 'The runs could not be read.');
  if (pubs.error) throw serviceError(pubs.error, 'The publications could not be read.');
  const published = new Set(rows(pubs.data).map((p) => text(p.run_id)));
  return rows(runs.data).map((r) => ({
    id: text(r.id), term: text(r.term), savedAt: text(r.saved_at), conflicts: Array.isArray(r.conflicts) ? (r.conflicts as Conflict[]) : [],
    assignments: Array.isArray((r.proposal as Row | null)?.assignments) ? ((r.proposal as Row).assignments as unknown[]).length : 0,
    published: published.has(text(r.id)), mine: me !== '' && text(r.saved_by) === me,
  }));
}

// ── The writers ──────────────────────────────────────────────────────────

async function call(name: string, args: Record<string, unknown>, fallback: string): Promise<Row> {
  const db = await cloud();
  const { data, error } = await db.rpc(name, args);
  if (error) throw serviceError(error, fallback);
  return (data ?? {}) as Row;
}

export const saveSpace = (s: { code: string; name: string; building: string; capacity: number; features: string[]; bookable: boolean }, key: string) =>
  call('space_save', { want_code: s.code, want_name: s.name, want_building: s.building, want_capacity: s.capacity, want_features: s.features, want_bookable: s.bookable, want_key: key }, 'The space was not saved.');
export const retireSpace = (code: string, key: string) => call('space_retire', { want_code: code, want_key: key }, 'The space was not retired.');
export const requestBooking = (space: string, purpose: 'meeting' | 'event' | 'study', title: string, starts: string, ends: string, key: string) =>
  call('space_booking_request', { want_space: space, want_purpose: purpose, want_title: title, want_starts: starts, want_ends: ends, want_key: key }, 'The booking was not requested.');
export const makeBooking = (space: string, purpose: BookingPurpose, title: string, starts: string, ends: string, key: string) =>
  call('space_booking_make', { want_space: space, want_purpose: purpose, want_title: title, want_starts: starts, want_ends: ends, want_key: key }, 'The booking was not made.');
export const decideBooking = (id: string, confirm: boolean, note: string, key: string) =>
  call('space_booking_decide', { want_booking: id, want_confirm: confirm, want_note: note, want_key: key }, 'The booking was not decided.');
export const cancelBooking = (id: string, key: string) => call('space_booking_cancel', { want_booking: id, want_key: key }, 'The booking was not cancelled.');

export async function saveRun(term: string, sections: readonly SectionInput[], assignments: readonly Assignment[], key: string): Promise<{ id: string; conflicts: number }> {
  const input = { sections: sections.map((s) => ({ course: s.course, section: s.section, enrolment: s.enrolment, instructor: s.instructor, needs: s.needs })) };
  const r = await call('timetable_run_save', { want_term: term, want_input: input, want_proposal: { assignments }, want_key: key }, 'The run was not saved.');
  return { id: text(r.id), conflicts: Array.isArray(r.conflicts) ? r.conflicts.length : 0 };
}
export const publishRun = (id: string, key: string) => call('timetable_publish', { want_run: id, want_key: key }, 'The timetable was not published.');
