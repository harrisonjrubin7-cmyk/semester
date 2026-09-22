/**
 * The queue a report lands in, and the four things somebody can do with one.
 *
 * `public.reports` has taken reports since 1 September and, until
 * `20260921214500_report_status.sql`, **nobody could read one** — not unread,
 * unreadable, by anybody, through any client. That migration gave the table a
 * status and a select policy for `private.is_app_admin()`. Its own header says
 * what it deliberately left undone:
 *
 * > §58's *"Review reports through admin interface"*, which no screen provides
 * > yet, and which is the remaining half.
 *
 * This is that half. `screens/Moderation.tsx` draws it.
 *
 * ## The database is the gate, and the screen is not
 *
 * There is no client-side administrator check here, and there must not be one.
 * `public.app_admins` has no select policy, so a browser cannot read whether
 * the account it is signed in as is on that list — which is exactly what makes
 * the policy un-spoofable. The queue read is sent by everybody and answered
 * only for an administrator; an ordinary account gets an empty list, the same
 * nothing it had before the migration.
 *
 * That means **an empty queue and an account with no business here look
 * identical from the device**, and the screen says so rather than guessing. A
 * client that guessed would either accuse an administrator of having no
 * reports or tell an ordinary student the queue is empty, and the second is
 * the kind of sentence somebody repeats to a third party.
 *
 * ## A status this build does not recognise is still shown
 *
 * `status` is typed `string` rather than the four-value union, and rows carry
 * whatever the column holds. The check constraint allows four values *today*;
 * a later migration may allow a fifth, and an older build meeting it must not
 * do either of the two things a union would make natural — drop the row, or
 * read it as `open`. Dropping it hides a report, which is the fault this whole
 * file exists to fix. Reading it as `open` is worse: it reports somebody
 * else's decision as undone.
 *
 * So an unknown status is displayed as it is stored, and all four transitions
 * are offered, because moving it somewhere known is the one useful thing left.
 */

import { cloud } from './cloud';

/** The four the check constraint allows, in the order work passes through them. */
export type ReportStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';

export const REPORT_STATUSES: ReportStatus[] = [
  'open',
  'under_review',
  'resolved',
  'dismissed',
];

/** The two that mean somebody has finished with it. */
const FINISHED: string[] = ['resolved', 'dismissed'];

/** One row of `public.reports`, as a client may read it. */
export interface Report {
  id: string;
  /** The account that filed it. */
  reporter: string;
  /** The message, or null where it has since been deleted. */
  message_id: string | null;
  /** The account it is about, or null where that account is gone. */
  about: string | null;
  reason: string;
  /** What the message said, kept because a deleted message reads as nothing. */
  copy: string;
  created_at: string;
  /** Deliberately not the union. See the header. */
  status: string;
}

export function isKnownStatus(status: string): status is ReportStatus {
  return (REPORT_STATUSES as string[]).includes(status);
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'open':
      return 'Open';
    case 'under_review':
      return 'Under review';
    case 'resolved':
      return 'Resolved';
    case 'dismissed':
      return 'Dismissed';
    default:
      // As stored. A word this build has never heard of is somebody else's
      // decision, and inventing a friendlier name for it would hide that.
      return status;
  }
}

/** Whether this one is still somebody's to deal with. */
export function unfinished(report: Report): boolean {
  return !FINISHED.includes(report.status);
}

/**
 * Where a report can go from here: the other three.
 *
 * All four when the status is one this build does not know, because the row
 * cannot otherwise be moved into a state anything here understands.
 */
export function nextFor(status: string): ReportStatus[] {
  if (!isKnownStatus(status)) return [...REPORT_STATUSES];
  return REPORT_STATUSES.filter((s) => s !== status);
}

/**
 * The queue's order: unfinished first, newest first inside that.
 *
 * The same order `reports_open_first` indexes, and for the same reason — the
 * ordinary question is "what is not dealt with", and a resolved report from
 * September should not sit above an open one from this morning.
 */
export function queueOrder(rows: readonly Report[]): Report[] {
  return [...rows].sort((a, b) => {
    const open = Number(unfinished(b)) - Number(unfinished(a));
    if (open !== 0) return open;
    return Date.parse(b.created_at) - Date.parse(a.created_at);
  });
}

/** How many sit at each status. Every status present in the rows gets a key. */
export function counts(rows: readonly Report[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of REPORT_STATUSES) out[s] = 0;
  for (const r of rows) out[r.status] = (out[r.status] ?? 0) + 1;
  return out;
}

/**
 * The sentence over the list.
 *
 * It leads with what is not dealt with, because that is the number somebody
 * opened this to find, and it never says the queue is empty without saying the
 * other thing that produces an empty queue. See the header.
 */
export function queueLine(rows: readonly Report[]): string {
  if (rows.length === 0) {
    return 'Nothing here. The server sends reports only to an administrator, so this is either an empty queue or an account that is not one — from here they look the same.';
  }
  const waiting = rows.filter(unfinished).length;
  const done = rows.length - waiting;
  if (waiting === 0) {
    return `Nothing waiting. ${done} ${done === 1 ? 'report has' : 'reports have'} been dealt with.`;
  }
  const first = `${waiting} ${waiting === 1 ? 'report is' : 'reports are'} waiting.`;
  return done === 0 ? first : `${first} ${done} dealt with.`;
}

export interface Repeat {
  /** The account reported. */
  about: string;
  /** How many distinct accounts have reported it. */
  reporters: number;
  /** How many reports in total. */
  reports: number;
}

/**
 * Accounts two or more *different* people have reported.
 *
 * The one thing a queue can say that a single report cannot. One complaint is
 * a complaint; four from four people is a pattern, and it is the difference
 * between a disagreement and somebody a room needs protecting from.
 *
 * Distinct reporters rather than rows on purpose: ten reports from one account
 * about somebody they are arguing with is not evidence of anything, and
 * counting rows would put it at the top of the list.
 */
export function repeats(rows: readonly Report[]): Repeat[] {
  const by = new Map<string, { reporters: Set<string>; reports: number }>();
  for (const r of rows) {
    if (!r.about) continue;
    const seen = by.get(r.about) ?? { reporters: new Set<string>(), reports: 0 };
    seen.reporters.add(r.reporter);
    seen.reports += 1;
    by.set(r.about, seen);
  }
  return [...by.entries()]
    .filter(([, v]) => v.reporters.size > 1)
    .map(([about, v]) => ({ about, reporters: v.reporters.size, reports: v.reports }))
    .sort((a, b) => b.reporters - a.reporters || b.reports - a.reports);
}

/** How long ago it was filed, in words. */
export function ageLine(createdAt: string, now: number): string {
  const at = Date.parse(createdAt);
  if (Number.isNaN(at)) return '';
  const days = Math.floor((now - at) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'Last week';
  return `${Math.floor(days / 7)} weeks ago`;
}

/**
 * An account id, shortened for a row.
 *
 * A uuid is what the table holds — `reports.about` is a foreign key into
 * `auth.users` and there is no name here to show instead. The first segment is
 * enough to tell two rows apart and to match against the full id somewhere
 * that has it; the row is labelled as an account so nobody reads it as a name.
 */
export function shortId(id: string | null): string {
  if (!id) return 'a deleted account';
  return id.split('-')[0] || id.slice(0, 8);
}

/** Stored values made safe, the way every other reader in this app does it. */
export function readReport(raw: unknown): Report | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.reason !== 'string') return null;
  return {
    id: row.id,
    reporter: typeof row.reporter === 'string' ? row.reporter : '',
    message_id: typeof row.message_id === 'string' ? row.message_id : null,
    about: typeof row.about === 'string' ? row.about : null,
    reason: row.reason,
    copy: typeof row.copy === 'string' ? row.copy : '',
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
    // Whatever the column holds. See the header on why this is not narrowed.
    status: typeof row.status === 'string' ? row.status : 'open',
  };
}

/**
 * The queue, as the server will answer it.
 *
 * No filter on status: a screen that fetched only `open` could never show
 * somebody what they resolved this morning, and the whole table is a handful
 * of rows for as long as this is one university.
 */
export async function queue(): Promise<Report[]> {
  const { data, error } = await (await cloud())
    .from('reports')
    .select('id,reporter,message_id,about,reason,copy,created_at,status')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return queueOrder((data ?? []).map(readReport).filter((r): r is Report => r !== null));
}

/**
 * Move one along.
 *
 * `status` is the only column the API role may write — the grant is narrowed
 * to it in the migration, because row-level security chooses rows and has
 * nothing to say about columns, and a moderation tool whose operator can edit
 * the complaint is worse than no tool.
 */
export async function moveTo(id: string, status: ReportStatus): Promise<void> {
  const { error } = await (await cloud()).from('reports').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}
