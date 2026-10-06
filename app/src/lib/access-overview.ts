import type { SupabaseClient } from '@supabase/supabase-js';
import { cloud } from './cloud';

/**
 * Everyone who can see something of yours right now, in one list.
 *
 * Five features each let a student open a door for somebody — a support
 * window, an advisor share, an athletic-support share, a family grant and a
 * school-recorded guardian link — and each has its own screen to end it. Nothing
 * said how many were open at once, which is the question a student asks before
 * they decide what to close. This reads those five tables for the signed-in
 * student and says it.
 *
 * It is a read and nothing else: RLS already limits every one of these tables to
 * the student's own rows, and each is asked for `student_id = me` as well, so a
 * policy that later widens (a guardian reads their own link) cannot pull a
 * different person's row into this list. Ending anything stays on the screen
 * that made it.
 *
 * A source that fails to load is reported as failed and not as empty. "Nobody
 * can see this" is the one wrong answer that is worse than "we could not tell".
 */

export type AccessKind = 'support-window' | 'advisor' | 'athletic-support' | 'family' | 'guardian';

export interface AccessEntry {
  id: string;
  kind: AccessKind;
  /** What the person can see, in the student's words. */
  what: string;
  /** Null for a link that has no end date (a guardian link lasts until the school ends it). */
  endsAt: string | null;
}

export interface KindWords {
  label: string;
  /** Where the student ends it. */
  where: string;
}

export const KIND_WORDS: Record<AccessKind, KindWords> = {
  'support-window': { label: 'Support window', where: 'Support access, above' },
  advisor: { label: 'Advisor share', where: 'Sharing with your advisor' },
  'athletic-support': { label: 'Athletic support share', where: 'Athlete share' },
  family: { label: 'Family access', where: 'Family' },
  guardian: { label: 'Guardian link', where: 'your school, which records and ends it' },
};

export const KIND_ORDER: AccessKind[] = ['support-window', 'advisor', 'athletic-support', 'family', 'guardian'];

type Row = Record<string, unknown>;
type Source = {
  kind: AccessKind;
  table: string;
  columns: string;
  /** Turns a row into an entry; null when the row is not live access. */
  entry: (row: Row, now: number) => AccessEntry | null;
};

const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const when = (v: unknown): number | null => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? Date.parse(v) : null);

/** Not revoked, and not past its expiry. A row with no readable expiry is not shown as live. */
function live(row: Row, now: number): number | null {
  if (row.revoked_at) return null;
  const ends = when(row.expires_at);
  return ends !== null && ends > now ? ends : null;
}

const iso = (ms: number) => new Date(ms).toISOString();

/** The family grant scopes read as the words a student ticked. */
const FAMILY_CATEGORIES: Record<string, string> = {
  finances: 'finances',
  aid: 'financial aid',
  housing: 'housing',
  calendar: 'calendar',
  academic: 'academics',
  emergency: 'emergency details',
  travel: 'travel',
  'health-admin': 'health admin',
  career: 'career',
  communication: 'messages',
};

export function familyWhat(category: unknown): string {
  const key = text(category);
  return `Your ${FAMILY_CATEGORIES[key] ?? 'shared items'}, only the items you named`;
}

const GUARDIAN_RIGHTS: Record<string, string> = {
  full: 'Your school record, and can act on it',
  view_only: 'Your school record, to read',
};

const SOURCES: Source[] = [
  {
    kind: 'support-window',
    table: 'support_access_grant',
    columns: 'id, expires_at, revoked_at',
    entry: (r, now) => {
      const ends = live(r, now);
      return ends === null ? null : { id: text(r.id), kind: 'support-window', what: 'Your learning progress, for a short window', endsAt: iso(ends) };
    },
  },
  {
    kind: 'advisor',
    table: 'advisor_shares',
    columns: 'id, title, expires_at, revoked_at',
    entry: (r, now) => {
      const ends = live(r, now);
      return ends === null ? null : { id: text(r.id), kind: 'advisor', what: text(r.title) || 'A summary you shared', endsAt: iso(ends) };
    },
  },
  {
    kind: 'athletic-support',
    table: 'support_shares',
    columns: 'id, expires_at, revoked_at',
    entry: (r, now) => {
      const ends = live(r, now);
      return ends === null ? null : { id: text(r.id), kind: 'athletic-support', what: 'The athlete summary you previewed and sent', endsAt: iso(ends) };
    },
  },
  {
    kind: 'family',
    table: 'family_grants',
    // A grant nobody accepted is not access yet, so `accepted_at` is read too.
    columns: 'id, category, accepted_at, expires_at, revoked_at',
    entry: (r, now) => {
      const accepted = when(r.accepted_at);
      const ends = live(r, now);
      if (ends === null || accepted === null || accepted > now) return null;
      return { id: text(r.id), kind: 'family', what: familyWhat(r.category), endsAt: iso(ends) };
    },
  },
  {
    kind: 'guardian',
    table: 'guardian_links',
    columns: 'id, rights, ended_at',
    entry: (r) => {
      // `none` is recorded and reads nothing, so it is not access.
      const what = GUARDIAN_RIGHTS[text(r.rights)];
      if (!what || r.ended_at) return null;
      return { id: text(r.id), kind: 'guardian', what, endsAt: null };
    },
  },
];

export interface AccessOverview {
  entries: AccessEntry[];
  /** Kinds that could not be read. These are unknown, not empty. */
  failed: AccessKind[];
}

/** Soonest ending first, the open-ended ones last, then by kind so the order is stable. */
export function sortEntries(entries: AccessEntry[]): AccessEntry[] {
  return [...entries].sort((a, b) => {
    const ea = a.endsAt === null ? Infinity : Date.parse(a.endsAt);
    const eb = b.endsAt === null ? Infinity : Date.parse(b.endsAt);
    if (ea !== eb) return ea < eb ? -1 : 1;
    return KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.id.localeCompare(b.id);
  });
}

/** Reads each source for this student. One failing does not hide the others. */
export async function loadAccessOverview(studentId: string, now: number = Date.now()): Promise<AccessOverview> {
  return readAccessOverview(await cloud(), studentId, now);
}

/** The read itself, with the client handed in so a test can stand one in at the edge. */
export async function readAccessOverview(db: Pick<SupabaseClient, 'from'>, studentId: string, now: number): Promise<AccessOverview> {
  const results = await Promise.all(
    SOURCES.map(async (s) => {
      const { data, error } = await db.from(s.table).select(s.columns).eq('student_id', studentId).limit(500);
      if (error) return { kind: s.kind, failed: true as const };
      const entries = ((data ?? []) as unknown as Row[]).map((r) => s.entry(r, now)).filter((e): e is AccessEntry => e !== null);
      return { kind: s.kind, failed: false as const, entries };
    }),
  );
  return {
    entries: sortEntries(results.flatMap((r) => (r.failed ? [] : r.entries))),
    failed: results.filter((r) => r.failed).map((r) => r.kind),
  };
}
