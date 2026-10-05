import { cloud, cloudConfigured } from './cloud';
import { dateToIso, isoToDate } from './date';
import { formatDate } from './locale';
import type { RecordRow } from './integration/school-records';
import { newOpportunity, type Kind, type Opportunity } from './opportunities';

/**
 * Verified listings — jobs, internships, scholarships and programs a student
 * did not have to find and type in.
 *
 * Two sources, one shape:
 *
 * - **Moderated listings** in `public.opportunities`. A publisher holding
 *   `opportunity:publish` drafts one; only a moderator holding
 *   `opportunity:moderate` publishes it; a student reads published rows for
 *   their school. "Verified" means exactly that a moderator approved it —
 *   `supabase/listings.check.sql` walks the lifecycle.
 * - **The career office's feed** — `internship` and `job` rows the school's
 *   career system syncs into `canonical_entity_references` (#779), under the
 *   same flag and consent as Today's "From your school".
 *
 * Eligibility is the office's text, shown as they wrote it. Nothing here reads
 * it, compares it to the student, or says "you qualify". Links that are not
 * https are dropped.
 */

export type ListingKind = 'job' | 'internship' | 'scholarship' | 'program';

export const LISTING_KINDS: readonly { id: ListingKind; label: string }[] = [
  { id: 'job', label: 'Jobs' },
  { id: 'internship', label: 'Internships' },
  { id: 'scholarship', label: 'Scholarships' },
  { id: 'program', label: 'Programs' },
];

export interface Listing {
  id: string;
  kind: ListingKind;
  title: string;
  /** Who stands behind it: the publisher's scope, or the school's career office. */
  from: string;
  body: string;
  url: string | null;
  deadline: string | null;
  /** The office's own words, never evaluated. */
  eligibility: string[];
  source: 'moderated' | 'career_feed';
}

const https = (v: unknown) => (typeof v === 'string' && /^https:\/\//i.test(v) ? v : null);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const KIND_SET = new Set<string>(LISTING_KINDS.map((k) => k.id));

/**
 * Eligibility, as lines of the office's text. A `text` field is shown as is; any
 * other key is shown as "key: value" exactly. Never interpreted.
 */
export function eligibilityLines(v: unknown): string[] {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return [];
  const o = v as Record<string, unknown>;
  const lines: string[] = [];
  if (typeof o.text === 'string' && o.text.trim()) lines.push(o.text.trim());
  for (const [k, x] of Object.entries(o)) {
    if (k === 'text') continue;
    const value = Array.isArray(x) ? x.map(String).join(', ') : typeof x === 'object' && x !== null ? JSON.stringify(x) : String(x);
    lines.push(`${k.replace(/_/g, ' ')}: ${value}`);
  }
  return lines.slice(0, 12);
}

export function readModerated(v: unknown): Listing | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.kind !== 'string' || !KIND_SET.has(o.kind) || !str(o.title).trim()) return null;
  return {
    id: `moderated:${o.id}`,
    kind: o.kind as ListingKind,
    title: str(o.title).trim(),
    from: str(o.publisher_scope_id) || 'A verified publisher',
    body: str(o.body),
    url: https(o.url),
    deadline: typeof o.deadline === 'string' ? o.deadline : null,
    eligibility: eligibilityLines(o.eligibility),
    source: 'moderated',
  };
}

/** The career office's synced internships and jobs, from the school-records rows. */
export function fromCareerFeed(rows: readonly RecordRow[]): Listing[] {
  return rows
    .filter((r) => r.canonical_entity_type === 'internship' || r.canonical_entity_type === 'job')
    .filter((r) => str(r.display.title).trim())
    .map((r) => ({
      id: `career:${r.id}`,
      kind: r.canonical_entity_type as ListingKind,
      title: str(r.display.title).trim(),
      from: str(r.display.employer) || r.source_of_truth,
      body: '',
      url: https(r.display.source_url) ?? https(r.source_url),
      deadline: str(r.display.deadline_at) || null,
      eligibility: [],
      source: 'career_feed' as const,
    }));
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whether a deadline has passed. A bare date is a calendar day where the
 * student is, so it lasts until their midnight — parsed as UTC it would vanish
 * hours early west of Greenwich and linger into the next day east of it. A
 * timestamp is an instant and compares as one.
 */
export function deadlinePassed(deadline: string | null, now: Date): boolean {
  if (!deadline) return false;
  if (DATE_ONLY.test(deadline)) return deadline < dateToIso(now);
  const t = Date.parse(deadline);
  return Number.isFinite(t) && t < now.getTime();
}

/** Soonest deadline first; open-ended last; past deadlines dropped. */
export function arrange(listings: readonly Listing[], now: Date): Listing[] {
  const t = (l: Listing) => {
    if (!l.deadline) return Number.POSITIVE_INFINITY;
    const at = DATE_ONLY.test(l.deadline) ? isoToDate(l.deadline).getTime() : Date.parse(l.deadline);
    return Number.isFinite(at) ? at : Number.POSITIVE_INFINITY;
  };
  return listings.filter((l) => !deadlinePassed(l.deadline, now)).sort((a, b) => t(a) - t(b) || a.title.localeCompare(b.title));
}

const TRACK_KIND: Record<ListingKind, Kind> = {
  job: 'job',
  internship: 'experience',
  scholarship: 'funding',
  program: 'experience',
};

/**
 * The tracker entry's id for a listing, so the Tracker can tell it already has
 * one whether or not the listing has a link.
 */
export const trackId = (l: Listing): string => `listing:${l.id}`.slice(0, 80);

/** A deadline as a calendar date: a bare date as written, an instant in local time. */
export function deadlineDay(deadline: string): string {
  return DATE_ONLY.test(deadline) ? deadline : dateToIso(new Date(deadline));
}

/** A deadline to show. A bare date is never parsed as UTC midnight. */
export function deadlineLabel(deadline: string): string {
  return formatDate(isoToDate(deadlineDay(deadline)));
}

/**
 * A date picked in the desk, as the instant it ends. `deadline` is a
 * timestamptz, and a bare date stored there becomes UTC midnight — the start
 * of the day, and the evening before for anyone west of Greenwich. The end of
 * the day where the office picked it is the deadline the office meant.
 */
export function deadlineForStorage(day: string): string | null {
  if (!DATE_ONLY.test(day)) return null;
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59).toISOString();
}

/** A tracker entry for a listing: its title, who, deadline, and the listing's URL as the source. */
export function trackerEntry(l: Listing): Opportunity {
  return {
    ...newOpportunity(TRACK_KIND[l.kind]),
    id: trackId(l),
    title: l.title.slice(0, 160),
    org: l.from.slice(0, 160),
    deadline: l.deadline && Number.isFinite(Date.parse(l.deadline)) ? deadlineDay(l.deadline) : '',
    source: l.url ?? '',
  };
}

export const LISTING_COLUMNS = 'id, kind, title, body, url, deadline, eligibility, publisher_scope_id';

export async function loadModerated(): Promise<Listing[]> {
  if (!cloudConfigured) return [];
  const db = await cloud();
  const { data: user } = await db.auth.getUser();
  if (!user.user?.id) return [];
  const { data, error } = await db
    .from('opportunities')
    .select(LISTING_COLUMNS)
    .eq('status', 'published')
    .in('kind', LISTING_KINDS.map((k) => k.id))
    // Soonest deadline first, so a cap drops the far-off and open-ended ones,
    // never the listing closing this week — and long-past ones not at all, or
    // they would fill the cap first. A day of slack; `arrange` makes the cut.
    .or(`deadline.is.null,deadline.gte.${new Date(Date.now() - 86_400_000).toISOString()}`)
    .order('deadline', { ascending: true, nullsFirst: false })
    .limit(200);
  if (error) return [];
  return (data ?? []).map(readModerated).filter((l): l is Listing => l !== null);
}

/** A listing waiting for a moderator, with everything a student will see. */
export interface QueuedListing {
  id: string; kind: string; title: string; body: string; deadline: string | null;
  status: string; url: string | null; publisher_scope_id: string; eligibility: unknown;
}

/** How many waiting listings one load holds. One more is asked for, to know if there are more. */
export const QUEUE_LIMIT = 200;
/** Everything a student will see, so a moderator reviews all of it before publishing. */
export const QUEUE_COLUMNS = 'id, kind, title, body, deadline, status, url, publisher_scope_id, eligibility';

/**
 * The moderator's queue: only what is waiting, oldest first. Filtering after a
 * cap let newer drafts and published rows push an older submission out of the
 * only place it can be published or removed.
 */
export async function loadReviewQueue(client?: Awaited<ReturnType<typeof cloud>>): Promise<{ rows: QueuedListing[]; more: boolean }> {
  const db = client ?? (await cloud());
  const { data, error } = await db.from('opportunities')
    .select(QUEUE_COLUMNS)
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true })
    .limit(QUEUE_LIMIT + 1);
  if (error) throw new Error(error.message);
  const got = (data ?? []) as unknown as QueuedListing[];
  return { rows: got.slice(0, QUEUE_LIMIT), more: got.length > QUEUE_LIMIT };
}

/**
 * Publish or remove a listing — the only change a moderator can make.
 * `moderate_opportunity` (20260928110700) writes `status` alone; a moderator
 * has no update policy on the table, so nothing else they could send lands.
 */
export async function moderateListing(
  id: string,
  status: 'published' | 'removed',
  client?: Awaited<ReturnType<typeof cloud>>,
): Promise<void> {
  const db = client ?? (await cloud());
  const { error } = await db.rpc('moderate_opportunity', { want: id, want_status: status });
  if (error) throw new Error(error.message);
}
