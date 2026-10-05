import type { Catalog } from '../data/catalog';
import { eventDays, runsOver, type AthleticEvent, type AthleticsLibrary } from './athletics';
import { cloud } from './cloud';
import { dateToIso, decorateItem } from './date';
import { obj } from './device-library';
import { ATHLETE_SHAREABLE, SHARE_MAX_DAYS, daysBetween, endProblem, type AthleteShareable } from './sharing';
import { SOURCE_TEXT, type SourceLabel } from './source';

/**
 * An athlete's share with athletic academic support: the screen side of
 * `supabase/migrations/20260928308000_support_shares.sql` (D-037 slice 5,
 * D-039 for the server).
 *
 * Everything shared is built here, from what is already on the device, into
 * the exact object the preview shows and the server stores. Nothing is
 * computed about the athlete — no count of absences, no "at risk", no trend
 * (design §1) — and nothing is filled in that the app does not hold.
 *
 * ## Two of the six are not offered yet, and say why
 *
 * The design lists absence notices "marked draft or sent" and travel-pack
 * progress. Semester keeps neither: an absence email is opened in the mail
 * app and never reported back, and a pack is a download, not a checklist.
 * Offering them would mean sharing a status the app made up, so the picker
 * shows them switched off with that reason, until there is a record to share.
 */

export interface TravelShare {
  title: string;
  kind: string;
  from: string;
  to: string;
  /** Course codes with a class meeting inside the trip. */
  misses: string[];
}

export interface MissedShare {
  course: string;
  /** "Fri Oct 9 · Lecture", from the syllabus the app holds. */
  classes: string[];
}

export interface DeadlineShare {
  course: string;
  title: string;
  due: string;
  /** Where the date came from (design §4): the syllabus, checked or not. */
  source: string;
}

export interface CourseShare {
  code: string;
  name: string;
}

export interface SupportPayload {
  sharedAs: string;
  travel?: TravelShare[];
  missed?: MissedShare[];
  courses?: CourseShare[];
  deadlines?: DeadlineShare[];
}

/** Items the app has a record of, and the reason for those it does not. */
export const NOT_RECORDED: Partial<Record<AthleteShareable, string>> = {
  absence: 'Not recorded in Semester yet: an absence email opens in your mail app, and Semester never learns whether it was sent.',
  pack: 'Not recorded in Semester yet: a travel pack is a download, and Semester keeps no done list for it.',
};

export const OFFERED = ATHLETE_SHAREABLE.filter(([k]) => !NOT_RECORDED[k]).map(([k]) => k);

/** Away trips — competitions and travel — that end on or after `from` and start by `to`. */
export function tripsIn(lib: AthleticsLibrary, from: string, to: string): AthleticEvent[] {
  return lib.events
    .filter((e) => (e.kind === 'Competition' || e.kind === 'Travel') && e.end.slice(0, 10) >= from && e.start.slice(0, 10) <= to)
    .sort((a, b) => a.start.localeCompare(b.start));
}

/**
 * The payload for the items chosen, over the trips between today and the
 * share's end. Only chosen keys appear; an item chosen with nothing in it is
 * an empty list, so the preview can say "nothing" rather than hide it.
 */
export function supportPayload(
  chosen: readonly AthleteShareable[],
  sharedAs: string,
  lib: AthleticsLibrary,
  catalog: Catalog,
  today: string,
  ends: string,
  now: Date,
): SupportPayload {
  const want = new Set(chosen.filter((k) => !NOT_RECORDED[k]));
  const code = (id: string) => catalog.byId[id]?.code ?? id.toUpperCase();
  const trips = tripsIn(lib, today, ends);
  const out: SupportPayload = { sharedAs: sharedAs.trim() };

  if (want.has('travel')) {
    out.travel = trips.map((e) => ({
      title: e.title,
      kind: e.kind,
      from: e.start.slice(0, 10),
      to: e.end.slice(0, 10),
      misses: runsOver(catalog, eventDays(e), now)
        .filter((m) => m.classes.length > 0)
        .map((m) => code(m.course)),
    }));
  }

  if (want.has('missed')) {
    const by = new Map<string, string[]>();
    for (const e of trips) {
      for (const m of runsOver(catalog, eventDays(e), now)) {
        if (!m.classes.length) continue;
        const c = code(m.course);
        by.set(c, [...(by.get(c) ?? []), ...m.classes]);
      }
    }
    out.missed = [...by].map(([course, classes]) => ({ course, classes: [...new Set(classes)] }));
  }

  if (want.has('courses')) {
    out.courses = catalog.courses.map((c) => ({ code: c.code, name: c.name }));
  }

  if (want.has('deadlines')) {
    const days = new Set(trips.flatMap((e) => eventDays(e)));
    out.deadlines = catalog.items
      .map((i) => ({ i, day: dateToIso(decorateItem(i, now).date) }))
      .filter(({ day }) => days.has(day))
      .sort((a, b) => a.day.localeCompare(b.day))
      .map(({ i, day }) => {
        // The same rule as Today's actions: a date checked against its
        // syllabus is imported; one that is not still needs review.
        const label: SourceLabel = i.checked?.confirmed === true ? 'imported' : 'needs_review';
        return { course: code(i.c), title: i.title, due: day, source: SOURCE_TEXT[label] };
      });
  }

  return out;
}

/** Why this share cannot be made as it stands, or [] when it can. */
export function supportProblems(chosen: readonly AthleteShareable[], sharedAs: string, email: string, ends: string, today: string): string[] {
  const out: string[] = [];
  if (!chosen.some((k) => !NOT_RECORDED[k])) out.push('Choose at least one thing to share.');
  if (!sharedAs.trim()) out.push('Say how they will see your name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) out.push('Enter the address they use for Semester.');
  const end = endProblem(ends, today);
  if (end) out.push(end);
  return out;
}

/** The last moment of the end day, in the student's own zone, capped at the server's 200 days. */
export function endsAt(ends: string, today: string): string {
  const days = Math.min(daysBetween(today, ends), SHARE_MAX_DAYS);
  const d = new Date(`${today}T23:59:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ── The athlete's side ──────────────────────────────────────────────────

export async function shareWithSupport(email: string, payload: SupportPayload, ends: string, today: string): Promise<void> {
  const { error } = await (await cloud()).rpc('share_with_support', {
    staff_email: email.trim(),
    share_payload: payload,
    share_expires: endsAt(ends, today),
  });
  if (error) throw new Error(error.message);
}

export interface MySupportShare {
  id: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  reads: string[];
}

/** The athlete's own shares with the times each was opened. RLS returns only theirs. */
export async function mySupportShares(): Promise<MySupportShare[]> {
  const db = await cloud();
  const shares = await db.from('support_shares').select('id, created_at, expires_at, revoked_at').order('created_at', { ascending: false });
  if (shares.error) throw new Error(shares.error.message);
  const reads = await db.from('support_share_events').select('share_id, read_at').order('read_at', { ascending: false }).limit(500);
  if (reads.error) throw new Error(reads.error.message);
  const by = new Map<string, string[]>();
  for (const r of (reads.data ?? []) as Record<string, unknown>[]) {
    const id = String(r.share_id);
    by.set(id, [...(by.get(id) ?? []), String(r.read_at)]);
  }
  return ((shares.data ?? []) as Record<string, unknown>[]).map((s) => ({
    id: String(s.id),
    createdAt: String(s.created_at),
    expiresAt: String(s.expires_at),
    revokedAt: typeof s.revoked_at === 'string' ? s.revoked_at : null,
    reads: by.get(String(s.id)) ?? [],
  }));
}

/** Stop a share. Takes effect at the staff member's next look. */
export async function revokeSupportShare(id: string): Promise<void> {
  const { error } = await (await cloud()).from('support_shares').update({ revoked_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

// ── The staff side ──────────────────────────────────────────────────────

export interface SupportListing {
  id: string;
  sharedAs: string;
  expiresAt: string;
}

/** Names and dates only. Listing is not a read and is not logged. */
export async function listSupportShares(): Promise<SupportListing[]> {
  const { data, error } = await (await cloud()).rpc('list_support_shares');
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []).filter(obj).map((r) => ({
    id: String(r.id),
    sharedAs: String(r.shared_as ?? ''),
    expiresAt: String(r.expires_at ?? ''),
  }));
}

/** Open one share. The athlete sees that you did. */
export async function readSupportShare(id: string): Promise<SupportPayload> {
  const { data, error } = await (await cloud()).rpc('read_support_share', { want_share: id });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return readPayload(obj(row) ? row.payload : null);
}

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const rows = (v: unknown) => (Array.isArray(v) ? v.filter(obj) : []);

/** A payload off the wire, rebuilt field by field: only what the preview could show. */
export function readPayload(v: unknown): SupportPayload {
  if (!obj(v)) return { sharedAs: '' };
  const out: SupportPayload = { sharedAs: typeof v.sharedAs === 'string' ? v.sharedAs : '' };
  if ('travel' in v)
    out.travel = rows(v.travel).map((t) => ({ title: String(t.title ?? ''), kind: String(t.kind ?? ''), from: String(t.from ?? ''), to: String(t.to ?? ''), misses: strings(t.misses) }));
  if ('missed' in v) out.missed = rows(v.missed).map((m) => ({ course: String(m.course ?? ''), classes: strings(m.classes) }));
  if ('courses' in v) out.courses = rows(v.courses).map((c) => ({ code: String(c.code ?? ''), name: String(c.name ?? '') }));
  if ('deadlines' in v)
    out.deadlines = rows(v.deadlines).map((d) => ({ course: String(d.course ?? ''), title: String(d.title ?? ''), due: String(d.due ?? ''), source: String(d.source ?? '') }));
  return out;
}
