/**
 * Events and RSVPs, typed, over the account service.
 *
 * `supabase/migrations/20261001090000_events.sql` is the authority: any member
 * proposes an event hosted by a community or a course, the events office
 * publishes or declines it (never its own proposal), an event that names a space
 * books it, and an RSVP past the capacity is the waitlist in the order the server
 * received it, all only while the school runs `events` in Core
 * (`lib/modulemode.ts`). This file asks.
 */

import { cloud } from '../cloud';
import type { Grant } from '../capabilities';
import { serviceError } from '../attempt';

type Row = Record<string, unknown>;
const text = (v: unknown): string => (v == null ? '' : String(v));
const rows = (data: unknown): Row[] => (Array.isArray(data) ? (data as Row[]) : []);

/** Whether this person holds `events:manage` over exactly their school. */
export function canManageEvents(grants: readonly Grant[], school: string): boolean {
  return school !== '' && grants.some((g) => g.capability === 'events:manage' && g.scopeKind === 'school' && g.scopeId === school);
}

export type HostKind = 'office' | 'community' | 'course';
export const HOST_WORDS: Record<HostKind, string> = { office: 'An office', community: 'A community', course: 'A course' };
export type RsvpStatus = 'going' | 'waitlisted' | 'cancelled';

export interface EventRow {
  id: string;
  hostKind: HostKind;
  hostRef: string;
  title: string;
  description: string;
  location: string;
  spaceId: string | null;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  mine: boolean;
  /** `proposed` until a manager decides, then `published` or `declined`; `cancelled` after. */
  state: 'proposed' | 'published' | 'declined' | 'cancelled';
  cancelReason: string;
  myStatus: RsvpStatus | null;
  going: number | null;
  waitlisted: number | null;
}

export async function loadEvents(school: string, me: string): Promise<EventRow[]> {
  const db = await cloud();
  const { data, error } = await db.from('campus_events').select('id,host_kind,host_ref,title,description,location,space_id,starts_at,ends_at,capacity,proposer')
    .eq('tenant_id', school).order('starts_at', { ascending: true });
  if (error) throw serviceError(error, 'The events could not be read.');
  const list = rows(data);
  if (list.length === 0) return [];
  const ids = list.map((r) => text(r.id));
  const [dec, can, rs] = await Promise.all([
    db.from('event_decisions').select('event_id,decision').in('event_id', ids),
    db.from('event_cancellations').select('event_id,reason').in('event_id', ids),
    db.from('event_rsvps').select('event_id,version,status').eq('member', me).in('event_id', ids),
  ]);
  for (const x of [dec, can, rs]) if (x.error) throw serviceError(x.error, 'The events could not be read.');
  const decision = new Map(rows(dec.data).map((d) => [text(d.event_id), text(d.decision)]));
  const cancelled = new Map(rows(can.data).map((c) => [text(c.event_id), text(c.reason)]));
  const mineStatus = new Map<string, { v: number; s: RsvpStatus }>();
  for (const r of rows(rs.data)) {
    const v = Number(r.version) || 0;
    if (!mineStatus.has(text(r.event_id)) || v > (mineStatus.get(text(r.event_id))?.v ?? 0)) mineStatus.set(text(r.event_id), { v, s: text(r.status) as RsvpStatus });
  }
  const out: EventRow[] = list.map((r) => {
    const id = text(r.id);
    const state = cancelled.has(id) ? 'cancelled' as const : decision.get(id) === 'published' ? 'published' as const : decision.get(id) === 'declined' ? 'declined' as const : 'proposed' as const;
    return {
      id, hostKind: (['office', 'community', 'course'].includes(text(r.host_kind)) ? text(r.host_kind) : 'community') as HostKind, hostRef: text(r.host_ref), title: text(r.title),
      description: text(r.description), location: text(r.location), spaceId: r.space_id == null ? null : text(r.space_id), startsAt: text(r.starts_at), endsAt: text(r.ends_at),
      capacity: r.capacity == null ? null : Number(r.capacity), mine: me !== '' && text(r.proposer) === me, state, cancelReason: cancelled.get(id) ?? '',
      myStatus: mineStatus.get(id)?.s ?? null, going: null, waitlisted: null,
    };
  });
  // Counts for the events a member can join; no one is named.
  await Promise.all(out.filter((e) => e.state === 'published').map(async (e) => {
    const { data: c } = await db.rpc('event_headcount', { want_event: e.id });
    const k = (c ?? {}) as Row;
    e.going = Number(k.going) || 0;
    e.waitlisted = Number(k.waitlisted) || 0;
  }));
  return out;
}

/** The words for where a person stands on an event. */
export function standing(e: Pick<EventRow, 'myStatus' | 'capacity' | 'going'>): string {
  if (e.myStatus === 'going') return 'You are going.';
  if (e.myStatus === 'waitlisted') return 'You are on the waitlist; you move up when a place frees.';
  if (e.capacity !== null && e.going !== null && e.going >= e.capacity) return 'Full: you would join the waitlist.';
  return '';
}

// ── The writers ──────────────────────────────────────────────────────────

async function call(name: string, args: Record<string, unknown>, fallback: string): Promise<Row> {
  const db = await cloud();
  const { data, error } = await db.rpc(name, args);
  if (error) throw serviceError(error, fallback);
  return (data ?? {}) as Row;
}

export interface NewEvent { hostKind: HostKind; hostRef: string; title: string; description: string; location: string; space: string; starts: string; ends: string; capacity: number | null }

export const proposeEvent = (e: NewEvent, key: string) =>
  call('event_propose', {
    want_host_kind: e.hostKind, want_host_ref: e.hostRef, want_title: e.title, want_description: e.description, want_location: e.location, want_space: e.space,
    want_starts: e.starts, want_ends: e.ends, want_capacity: e.capacity, want_key: key,
  }, 'The event was not proposed.');
export const publishDirect = (e: Omit<NewEvent, 'hostKind'>, key: string) =>
  call('event_publish_direct', {
    want_host_ref: e.hostRef, want_title: e.title, want_description: e.description, want_location: e.location, want_space: e.space,
    want_starts: e.starts, want_ends: e.ends, want_capacity: e.capacity, want_key: key,
  }, 'The event was not published.');
export const decideEvent = (id: string, publish: boolean, note: string, key: string) =>
  call('event_decide', { want_event: id, want_publish: publish, want_note: note, want_key: key }, 'The event was not decided.');
export const cancelEvent = (id: string, reason: string, key: string) => call('event_cancel', { want_event: id, want_reason: reason, want_key: key }, 'The event was not cancelled.');
export async function rsvp(id: string, going: boolean, key: string): Promise<RsvpStatus> {
  const r = await call('event_rsvp', { want_event: id, want_going: going, want_key: key }, 'Your RSVP was not saved.');
  return (['going', 'waitlisted', 'cancelled'].includes(text(r.status)) ? text(r.status) : 'cancelled') as RsvpStatus;
}
